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

/// Locate the LibreOffice executable across macOS, Linux, and Windows
fn find_soffice() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("SOFFICE_PATH") {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Some(pb);
        }
    }

    let candidates = [
        "/opt/homebrew/bin/soffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "/usr/local/bin/soffice",
        "/usr/bin/soffice",
        "/usr/bin/libreoffice",
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ];

    for c in &candidates {
        let pb = PathBuf::from(c);
        if pb.exists() {
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
                    if pb.exists() {
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
            StatusCode::INTERNAL_SERVER_ERROR,
            "LibreOffice (soffice) not found on system. Please install LibreOffice.".to_string(),
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
            StatusCode::INTERNAL_SERVER_ERROR,
            "LibreOffice (soffice) not found on system. Please install LibreOffice.".to_string(),
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

/// Pure Rust high-speed image enhancement and upscaling (Lanczos3 + Unsharp Masking)
async fn enhance_image(mut multipart: Multipart) -> Result<Response, (StatusCode, String)> {
    let mut file_name = String::from("image.png");
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut target = String::from("4x");
    let mut post_process = String::from("false");
    let mut downscale = String::from("true");

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
        } else if name == "target" {
            target = field.text().await.unwrap_or_default().to_lowercase();
        } else if name == "postProcess" {
            post_process = field.text().await.unwrap_or_default().to_lowercase();
        } else if name == "downscale" {
            downscale = field.text().await.unwrap_or_default().to_lowercase();
        }
    }

    let file_bytes = file_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "No image file uploaded.".to_string(),
        )
    })?;

    println!(
        "[Rust Backend] Enhancing image '{}' (target: {}, postProcess: {}, downscale: {})",
        file_name, target, post_process, downscale
    );

    // Process image in blocking thread pool with high performance
    let processed_bytes = tokio::task::spawn_blocking(move || -> Result<(Vec<u8>, &'static str), String> {
        let img = image::load_from_memory(&file_bytes)
            .map_err(|e| format!("Failed to decode image: {}", e))?;

        let (mut width, mut height) = (img.width(), img.height());

        // Auto-downscale if huge and requested
        let mut cur_img = img;
        if target != "1x" && downscale == "true" {
            let max_dim = width.max(height);
            if max_dim >= 2048 {
                let scale = 1920.0 / max_dim as f32;
                let new_w = (width as f32 * scale) as u32;
                let new_h = (height as f32 * scale) as u32;
                cur_img = cur_img.resize_exact(new_w, new_h, imageops::FilterType::Lanczos3);
                width = new_w;
                height = new_h;
            }
        }

        let enhanced: DynamicImage = match target.as_str() {
            "1x" => {
                // Smart enhance: unsharp mask sharpening for text & edges
                cur_img.unsharpen(2.0, 1)
            }
            "2x" => {
                let target_w = width * 2;
                let target_h = height * 2;
                let upscaled = cur_img.resize_exact(target_w, target_h, imageops::FilterType::Lanczos3);
                if post_process == "true" {
                    upscaled.unsharpen(2.0, 2)
                } else {
                    upscaled
                }
            }
            _ => {
                // 4x high-fidelity Lanczos3 super-resolution
                let target_w = width * 4;
                let target_h = height * 4;
                let upscaled = cur_img.resize_exact(target_w, target_h, imageops::FilterType::Lanczos3);
                if post_process == "true" {
                    upscaled.unsharpen(2.5, 3)
                } else {
                    upscaled
                }
            }
        };

        let mut output_cursor = Cursor::new(Vec::new());
        // Default to PNG output for lossless quality
        enhanced
            .write_to(&mut output_cursor, ImageFormat::Png)
            .map_err(|e| format!("Failed to encode output image: {}", e))?;

        Ok((output_cursor.into_inner(), "image/png"))
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Task join error: {}", e),
        )
    })?
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let (data, content_type) = processed_bytes;
    println!(
        "[Rust Backend] Successfully enhanced image to {} bytes",
        data.len()
    );

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"enhanced_{}\"", file_name),
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
