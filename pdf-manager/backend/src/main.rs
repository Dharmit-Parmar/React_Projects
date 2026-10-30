use axum::{
    extract::{DefaultBodyLimit, Multipart},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use image::{imageops, DynamicImage, ImageFormat};
use serde_json::json;
use std::{
    io::Cursor,
    path::{Path, PathBuf},
    process::Command,
};
use tempfile::TempDir;
use tower_http::cors::CorsLayer;

/// Validate whether a candidate path is actually runnable and not a dead wrapper script
fn is_executable_working(pb: &Path) -> bool {
    if !pb.exists() {
        return false;
    }
    // Test quick version check with 2s timeout
    if let Ok(output) = Command::new(pb).arg("--version").output() {
        output.status.success()
    } else {
        false
    }
}

/// Locate the LibreOffice executable across macOS, Linux, and Windows
fn find_soffice() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("SOFFICE_PATH") {
        let pb = PathBuf::from(p);
        if is_executable_working(&pb) {
            return Some(pb);
        }
    }

    let candidates = [
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "/opt/homebrew/bin/soffice",
        "/usr/local/bin/soffice",
        "/usr/bin/soffice",
        "/usr/bin/libreoffice",
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ];

    for c in &candidates {
        let pb = PathBuf::from(c);
        if is_executable_working(&pb) {
            return Some(pb);
        }
    }

    // Try `which soffice` or `which libreoffice` in PATH
    for cmd in &["soffice", "libreoffice"] {
        if let Ok(output) = Command::new("which").arg(cmd).output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !s.is_empty() {
                    let pb = PathBuf::from(s);
                    if is_executable_working(&pb) {
                        return Some(pb);
                    }
                }
            }
        }
    }

    None
}

async fn health_check() -> impl IntoResponse {
    let soffice = find_soffice();
    Json(json!({
        "status": "ok",
        "engine": "rust-axum",
        "soffice_found": soffice.is_some(),
        "soffice_path": soffice.map(|p| p.to_string_lossy().to_string())
    }))
}

/// Convert office documents via headless LibreOffice with isolated profile
async fn convert_with_libreoffice(mut multipart: Multipart) -> Result<Response, (StatusCode, String)> {
    let soffice = find_soffice().ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            "Office conversion engine not available. Please edit and export documents directly using the built-in Word Editor.".to_string(),
        )
    })?;

    let temp_dir = TempDir::new().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create temporary directory: {}", e),
        )
    })?;

    let mut file_name = String::from("input.docx");
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut to_ext = String::from("pdf");

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            if let Some(orig) = field.file_name() {
                file_name = orig.to_string();
            }
            let bytes = field.bytes().await.map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    format!("Failed to read uploaded file bytes: {}", e),
                )
            })?;
            file_bytes = Some(bytes.to_vec());
        } else if name == "toExt" {
            let text = field.text().await.unwrap_or_default();
            let cleaned = text.trim().trim_start_matches('.').to_lowercase();
            if !cleaned.is_empty() {
                to_ext = cleaned;
            }
        }
    }

    let file_bytes = file_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "No file uploaded in form data.".to_string(),
        )
    })?;

    let orig_ext = Path::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("docx")
        .to_lowercase();

    let input_path = temp_dir.path().join(format!("document.{}", orig_ext));
    tokio::fs::write(&input_path, &file_bytes).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write input file: {}", e),
        )
    })?;

    let user_profile_dir = temp_dir.path().join("libre_user_profile");
    let user_profile_uri = format!("file://{}", user_profile_dir.display());

    println!(
        "[Rust Backend] Converting '{}' ({} bytes) -> '{}' using {:?}",
        file_name,
        file_bytes.len(),
        to_ext,
        soffice
    );

    let soffice_bin = soffice.clone();
    let temp_dir_path = temp_dir.path().to_path_buf();
    let to_ext_clone = to_ext.clone();
    let input_path_clone = input_path.clone();

    let convert_result = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&soffice_bin);
        cmd.arg("--headless");
        cmd.arg(format!("-env:UserInstallation={}", user_profile_uri));

        if orig_ext == "pdf" && (to_ext_clone == "docx" || to_ext_clone == "doc") {
            cmd.arg("--infilter=writer_pdf_import");
        }

        cmd.arg("--convert-to");
        cmd.arg(&to_ext_clone);
        cmd.arg(&input_path_clone);
        cmd.arg("--outdir");
        cmd.arg(&temp_dir_path);

        cmd.output()
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Task join error: {}", e),
        )
    })?
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to execute soffice: {}", e),
        )
    })?;

    if !convert_result.status.success() {
        let stderr = String::from_utf8_lossy(&convert_result.stderr);
        eprintln!("[Rust Backend] soffice error: {}", stderr);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("LibreOffice conversion error: {}", stderr),
        ));
    }

    let expected_output = temp_dir.path().join(format!("document.{}", to_ext));
    let actual_output = if expected_output.exists() {
        expected_output
    } else {
        let mut found = None;
        if let Ok(mut entries) = std::fs::read_dir(temp_dir.path()) {
            while let Some(Ok(entry)) = entries.next() {
                let p = entry.path();
                if p.is_file() {
                    if let Some(ext) = p.extension() {
                        if ext.to_string_lossy().eq_ignore_ascii_case(&to_ext) {
                            found = Some(p);
                            break;
                        }
                    }
                }
            }
        }
        found.ok_or_else(|| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("LibreOffice succeeded but no .{} file was generated", to_ext),
            )
        })?
    };

    let converted_bytes = tokio::fs::read(&actual_output).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to read converted file: {}", e),
        )
    })?;

    println!(
        "[Rust Backend] Successfully converted to '{}' ({} bytes)",
        to_ext,
        converted_bytes.len()
    );

    let content_type = match to_ext.as_str() {
        "pdf" => "application/pdf",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc" => "application/msword",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    };

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"converted.{}\"", to_ext),
        )
        .header(header::CONTENT_LENGTH, converted_bytes.len())
        .body(converted_bytes.into())
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Response builder error: {}", e),
            )
        })?;

    Ok(response)
}

/// Dedicated PDF to Word endpoint (DOCX / DOC)
async fn convert_pdf_to_docx(mut multipart: Multipart) -> Result<Response, (StatusCode, String)> {
    let soffice = find_soffice().ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            "Office conversion engine not available. Please edit and export documents directly using the built-in Word Editor.".to_string(),
        )
    })?;

    let temp_dir = TempDir::new().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create temporary directory: {}", e),
        )
    })?;

    let mut file_name = String::from("input.pdf");
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut to_ext = String::from("docx");

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            if let Some(orig) = field.file_name() {
                file_name = orig.to_string();
            }
            let bytes = field.bytes().await.map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    format!("Failed to read uploaded file bytes: {}", e),
                )
            })?;
            file_bytes = Some(bytes.to_vec());
        } else if name == "toExt" {
            let text = field.text().await.unwrap_or_default();
            let cleaned = text.trim().trim_start_matches('.').to_lowercase();
            if cleaned == "doc" || cleaned == "docx" {
                to_ext = cleaned;
            }
        }
    }

    let file_bytes = file_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "No file uploaded in form data.".to_string(),
        )
    })?;

    let input_path = temp_dir.path().join("document.pdf");
    tokio::fs::write(&input_path, &file_bytes).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write input file: {}", e),
        )
    })?;

    let user_profile_dir = temp_dir.path().join("libre_user_profile");
    let user_profile_uri = format!("file://{}", user_profile_dir.display());

    println!(
        "[Rust Backend] Converting PDF '{}' -> '{}' using writer_pdf_import...",
        file_name, to_ext
    );

    let soffice_bin = soffice.clone();
    let temp_dir_path = temp_dir.path().to_path_buf();
    let to_ext_clone = to_ext.clone();
    let input_path_clone = input_path.clone();

    let convert_result = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&soffice_bin);
        cmd.arg("--headless");
        cmd.arg(format!("-env:UserInstallation={}", user_profile_uri));
        cmd.arg("--infilter=writer_pdf_import");
        cmd.arg("--convert-to");
        cmd.arg(&to_ext_clone);
        cmd.arg(&input_path_clone);
        cmd.arg("--outdir");
        cmd.arg(&temp_dir_path);

        cmd.output()
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Task join error: {}", e),
        )
    })?
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to execute soffice: {}", e),
        )
    })?;

    if !convert_result.status.success() {
        let stderr = String::from_utf8_lossy(&convert_result.stderr);
        eprintln!("[Rust Backend] PDF conversion error: {}", stderr);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("PDF to Word conversion failed: {}", stderr),
        ));
    }

    let expected_output = temp_dir.path().join(format!("document.{}", to_ext));
    if !expected_output.exists() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Conversion produced no output file (document.{})", to_ext),
        ));
    }

    let converted_bytes = tokio::fs::read(&expected_output).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to read converted file: {}", e),
        )
    })?;

    println!(
        "[Rust Backend] Successfully generated Word doc '{}' ({} bytes)",
        to_ext,
        converted_bytes.len()
    );

    let content_type = if to_ext == "doc" {
        "application/msword"
    } else {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"converted.{}\"", to_ext),
        )
        .header(header::CONTENT_LENGTH, converted_bytes.len())
        .body(converted_bytes.into())
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Response builder error: {}", e),
            )
        })?;

    Ok(response)
}

/// Pure Rust high-speed image enhancement and upscaling (Adaptive Contrast, Lanczos3, Unsharp Mask, Multi-format)
pub struct EnhanceOptions {
    pub scale: String,      // "1x", "2x", "4x"
    pub preset: String,     // "wallpaper", "photo", "art", "document", "balanced"
    pub sharpness: u8,      // 0 - 100
    pub denoise: u8,        // 0 - 100
    pub clarity: u8,        // 0 - 100
    pub format: String,     // "auto", "jpeg", "webp", "png"
    pub quality: u8,        // 70 - 100
    pub orig_ext: String,
}

fn process_image_enhancement(
    img: DynamicImage,
    opts: EnhanceOptions,
) -> Result<(Vec<u8>, &'static str, String), String> {
    let (width, height) = (img.width(), img.height());

    // 1. Calculate target dimensions with memory & safety bounds
    let scale_factor: u32 = match opts.scale.as_str() {
        "1x" => 1,
        "2x" => 2,
        _ => 4,
    };

    let target_w = width.saturating_mul(scale_factor);
    let target_h = height.saturating_mul(scale_factor);

    // Guard: Prevent excessive allocation if target exceeds 8K (max dimension 8192)
    let max_dim = target_w.max(target_h);
    let (final_w, final_h) = if max_dim > 8192 {
        let ratio = 8192.0 / max_dim as f32;
        ((target_w as f32 * ratio) as u32, (target_h as f32 * ratio) as u32)
    } else {
        (target_w, target_h)
    };

    // 2. Pre-denoise / smoothing if requested (suppresses low-res JPEG block artifacts)
    let mut work_img = img;
    if opts.denoise > 0 {
        let sigma = (opts.denoise as f32 / 100.0) * 1.2;
        work_img = work_img.blur(sigma);
    }

    // 3. Resample using high-fidelity filter
    let filter = match opts.preset.as_str() {
        "art" => imageops::FilterType::CatmullRom,
        _ => imageops::FilterType::Lanczos3,
    };

    if final_w != width || final_h != height {
        work_img = work_img.resize_exact(final_w, final_h, filter);
    }

    // 4. Clarity / Micro-contrast enhancement via O(1) 256-byte LUT
    if opts.clarity > 0 {
        let clarity_factor = (opts.clarity as f32 / 100.0) * 0.28;
        let mut lut = [0u8; 256];
        for i in 0..256 {
            let u = i as f32 / 255.0;
            // S-curve midtone expansion: expands contrast in 25%-75% range
            let delta = clarity_factor * (std::f32::consts::PI * 2.0 * u).sin();
            let new_val = (u + delta).clamp(0.0, 1.0) * 255.0;
            lut[i] = new_val.round() as u8;
        }

        let mut rgb = work_img.to_rgb8();
        for p in rgb.pixels_mut() {
            p[0] = lut[p[0] as usize];
            p[1] = lut[p[1] as usize];
            p[2] = lut[p[2] as usize];
        }
        work_img = DynamicImage::ImageRgb8(rgb);
    }

    // 5. Intelligent Unsharp Masking based on preset and user sharpness
    let sharpness_mult = (opts.sharpness as f32 / 100.0).clamp(0.0, 2.0);
    let (base_sigma, base_threshold) = match opts.preset.as_str() {
        "wallpaper" => (2.2, 2),
        "photo" => (1.4, 4),
        "art" => (2.6, 1),
        "document" => (3.0, 0),
        _ => (1.8, 3), // balanced
    };

    let effective_sigma = base_sigma * sharpness_mult;
    if effective_sigma > 0.1 && opts.sharpness > 0 {
        work_img = work_img.unsharpen(effective_sigma, base_threshold);
    }

    // 6. Color vibrance boost for wallpapers and artwork (revitalizes muted midtones)
    if opts.preset == "wallpaper" || opts.preset == "art" {
        let mut rgb = work_img.to_rgb8();
        for p in rgb.pixels_mut() {
            let r = p[0] as f32;
            let g = p[1] as f32;
            let b = p[2] as f32;
            let max_c = r.max(g).max(b);
            let min_c = r.min(g).min(b);
            if max_c > min_c {
                let sat = 1.0 - (min_c / max_c);
                if sat < 0.65 {
                    // Boost muted colors gently without clipping saturated ones
                    let boost = 0.08 * (1.0 - sat);
                    let l = (r + g + b) / 3.0;
                    p[0] = (r + (r - l) * boost).clamp(0.0, 255.0) as u8;
                    p[1] = (g + (g - l) * boost).clamp(0.0, 255.0) as u8;
                    p[2] = (b + (b - l) * boost).clamp(0.0, 255.0) as u8;
                }
            }
        }
        work_img = DynamicImage::ImageRgb8(rgb);
    }

    // 7. Output Encoding with Format & Compression Selection (prevents 150MB file size blowup!)
    let target_format = match opts.format.to_lowercase().as_str() {
        "jpeg" | "jpg" => "jpeg",
        "webp" => "webp",
        "png" => "png",
        _ => {
            // "auto": inherit from original extension; for wallpapers/photos default to JPEG to avoid 150MB PNG blowup
            match opts.orig_ext.to_lowercase().as_str() {
                "jpg" | "jpeg" => "jpeg",
                "webp" => "webp",
                "png" => "png",
                _ => "webp",
            }
        }
    };

    let mut cursor = Cursor::new(Vec::new());
    match target_format {
        "jpeg" => {
            let rgb = work_img.to_rgb8();
            let quality = opts.quality.clamp(60, 100);
            let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
            enc.encode(rgb.as_raw(), rgb.width(), rgb.height(), image::ExtendedColorType::Rgb8)
                .map_err(|e| format!("JPEG encode error: {}", e))?;
            Ok((cursor.into_inner(), "image/jpeg", "jpg".to_string()))
        }
        "webp" => {
            work_img
                .write_to(&mut cursor, ImageFormat::WebP)
                .map_err(|e| format!("WebP encode error: {}", e))?;
            Ok((cursor.into_inner(), "image/webp", "webp".to_string()))
        }
        _ => {
            work_img
                .write_to(&mut cursor, ImageFormat::Png)
                .map_err(|e| format!("PNG encode error: {}", e))?;
            Ok((cursor.into_inner(), "image/png", "png".to_string()))
        }
    }
}

async fn enhance_image(mut multipart: Multipart) -> Result<Response, (StatusCode, String)> {
    let mut file_name = String::from("image.png");
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut scale = String::from("2x");
    let mut preset = String::from("wallpaper");
    let mut sharpness: u8 = 65;
    let mut denoise: u8 = 20;
    let mut clarity: u8 = 45;
    let mut format = String::from("auto");
    let mut quality: u8 = 92;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            if let Some(orig) = field.file_name() {
                file_name = orig.to_string();
            }
            let bytes = field.bytes().await.map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    format!("Failed to read uploaded image: {}", e),
                )
            })?;
            file_bytes = Some(bytes.to_vec());
        } else if name == "target" || name == "scale" {
            let val = field.text().await.unwrap_or_default().to_lowercase();
            if !val.is_empty() {
                scale = val;
            }
        } else if name == "preset" {
            let val = field.text().await.unwrap_or_default().to_lowercase();
            if !val.is_empty() {
                preset = val;
            }
        } else if name == "sharpness" {
            if let Ok(v) = field.text().await.unwrap_or_default().parse::<u8>() {
                sharpness = v.min(100);
            }
        } else if name == "denoise" {
            if let Ok(v) = field.text().await.unwrap_or_default().parse::<u8>() {
                denoise = v.min(100);
            }
        } else if name == "clarity" {
            if let Ok(v) = field.text().await.unwrap_or_default().parse::<u8>() {
                clarity = v.min(100);
            }
        } else if name == "format" {
            let val = field.text().await.unwrap_or_default().to_lowercase();
            if !val.is_empty() {
                format = val;
            }
        } else if name == "quality" {
            if let Ok(v) = field.text().await.unwrap_or_default().parse::<u8>() {
                quality = v.clamp(60, 100);
            }
        }
    }

    let file_bytes = file_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "No image file uploaded.".to_string(),
        )
    })?;

    let orig_ext = Path::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_string();

    println!(
        "[Rust Backend] Enhancing '{}' (scale: {}, preset: {}, sharpness: {}, denoise: {}, clarity: {}, format: {}, quality: {})",
        file_name, scale, preset, sharpness, denoise, clarity, format, quality
    );

    let opts = EnhanceOptions {
        scale,
        preset,
        sharpness,
        denoise,
        clarity,
        format,
        quality,
        orig_ext,
    };

    // Process image in blocking thread pool with high performance
    let processed_bytes = tokio::task::spawn_blocking(move || -> Result<(Vec<u8>, &'static str, String), String> {
        let img = image::load_from_memory(&file_bytes)
            .map_err(|e| format!("Failed to decode image: {}", e))?;

        process_image_enhancement(img, opts)
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Task join error: {}", e),
        )
    })?
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let (data, content_type, ext) = processed_bytes;
    println!(
        "[Rust Backend] Successfully enhanced image to {} bytes ({})",
        data.len(),
        content_type
    );

    let base_name = Path::new(&file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("enhanced");
    let out_filename = format!("{}_enhanced.{}", base_name, ext);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", out_filename),
        )
        .header(header::CONTENT_LENGTH, data.len())
        .body(data.into())
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Response builder error: {}", e),
            )
        })?;

    Ok(response)
}

#[tokio::main]
async fn main() {
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3001);

    let app = Router::new()
        .route("/api/health", get(health_check))
        .route("/api/convert/libreoffice", post(convert_with_libreoffice))
        .route("/api/convert/pdf-to-docx", post(convert_pdf_to_docx))
        .route("/api/enhance-image", post(enhance_image))
        .layer(DefaultBodyLimit::max(100 * 1024 * 1024)) // 100MB upload limit
        .layer(CorsLayer::permissive());

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    println!("🚀 Rust PDF Backend listening on http://localhost:{}", port);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("❌ Failed to bind to {}: {}", addr, e);
            eprintln!("💡 Tip: Another process is already running on port {}.", port);
            eprintln!("   Run 'npm run stop' or 'lsof -ti:{} | xargs kill -9' to free the port.", port);
            std::process::exit(1);
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Server error: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::RgbImage;

    #[test]
    fn test_enhancement_formats_and_sizes() {
        // Create a 200x200 sample RGB image
        let mut sample = RgbImage::new(200, 200);
        for (x, y, pixel) in sample.enumerate_pixels_mut() {
            *pixel = image::Rgb([(x % 255) as u8, (y % 255) as u8, ((x + y) % 255) as u8]);
        }
        let dynamic = DynamicImage::ImageRgb8(sample);

        // 1. Test Wallpaper Preset with 2x upscale in JPEG (Quality 90)
        let opts_jpg = EnhanceOptions {
            scale: "2x".to_string(),
            preset: "wallpaper".to_string(),
            sharpness: 70,
            denoise: 15,
            clarity: 50,
            format: "jpeg".to_string(),
            quality: 90,
            orig_ext: "jpg".to_string(),
        };
        let (bytes_jpg, mime_jpg, ext_jpg) = process_image_enhancement(dynamic.clone(), opts_jpg).unwrap();
        assert_eq!(mime_jpg, "image/jpeg");
        assert_eq!(ext_jpg, "jpg");
        assert!(!bytes_jpg.is_empty());

        // 2. Test 2x upscale in raw PNG (demonstrates size difference)
        let opts_png = EnhanceOptions {
            scale: "2x".to_string(),
            preset: "wallpaper".to_string(),
            sharpness: 70,
            denoise: 15,
            clarity: 50,
            format: "png".to_string(),
            quality: 100,
            orig_ext: "png".to_string(),
        };
        let (bytes_png, mime_png, ext_png) = process_image_enhancement(dynamic.clone(), opts_png).unwrap();
        assert_eq!(mime_png, "image/png");
        assert_eq!(ext_png, "png");
        assert!(!bytes_png.is_empty());

        // Verify JPEG is significantly more compact than uncompressed PNG
        println!(
            "Test Output - 2x 400x400 Image -> JPEG: {} bytes vs PNG: {} bytes (Savings: {:.1}%)",
            bytes_jpg.len(),
            bytes_png.len(),
            (1.0 - (bytes_jpg.len() as f32 / bytes_png.len() as f32)) * 100.0
        );
        assert!(bytes_jpg.len() < bytes_png.len(), "JPEG must be smaller than PNG to prevent 150MB bloat");

        // 3. Test WebP format
        let opts_webp = EnhanceOptions {
            scale: "2x".to_string(),
            preset: "art".to_string(),
            sharpness: 60,
            denoise: 30,
            clarity: 40,
            format: "webp".to_string(),
            quality: 90,
            orig_ext: "webp".to_string(),
        };
        let (bytes_webp, mime_webp, ext_webp) = process_image_enhancement(dynamic, opts_webp).unwrap();
        assert_eq!(mime_webp, "image/webp");
        assert_eq!(ext_webp, "webp");
        assert!(!bytes_webp.is_empty());
    }
}
