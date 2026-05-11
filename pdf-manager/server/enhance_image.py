import sys
import cv2
import numpy as np
import os

def enhance_image(input_path, output_path, model_path, mode="cpu", target="4x", post_process="false", downscale="true"):
    try:
        # Load the image
        img = cv2.imread(input_path)
        if img is None:
            print("Error: Could not read image.")
            sys.exit(1)
            
        # Downscale if required (Bypass for 1x mode as it doesn't use the memory-heavy AI model)
        h, w = img.shape[:2]
        if target != "1x":
            if downscale.lower() == "true":
                if max(h, w) >= 2048:
                    scale_factor = 1920.0 / max(h, w)
                    new_w = int(w * scale_factor)
                    new_h = int(h * scale_factor)
                    img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
                    print(f"Downscaled large image to {new_w}x{new_h} before enhancement.")
            else:
                if max(h, w) > 2500:
                    print("Error: Image is too large to process without downscaling. It requires too much RAM. Please enable auto-downscale.")
                    sys.exit(1)
        
        if target == "1x":
            print("Running 1x Smart Enhance (No Upscale)...")
            # 1. Bilateral Filter to smooth noise but preserve strong edges (like text)
            smoothed = cv2.bilateralFilter(img, 9, 75, 75)
            # 2. Mild Unsharp Mask to sharpen edges gracefully
            gaussian = cv2.GaussianBlur(smoothed, (0, 0), 2.0)
            final_img = cv2.addWeighted(smoothed, 1.2, gaussian, -0.2, 0)
            
        else:
            # Initialize the super resolution object only if we are upscaling
            sr = cv2.dnn_superres.DnnSuperResImpl_create()
            sr.readModel(model_path)
            
            # Configure backend/target based on user selection
            if mode == "gpu":
                cv2.ocl.setUseOpenCL(True)
                sr.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                # FP16 (Half-Precision) is significantly faster on Apple Silicon / Modern GPUs
                sr.setPreferableTarget(cv2.dnn.DNN_TARGET_OPENCL_FP16)
            else:
                cv2.ocl.setUseOpenCL(False)
                sr.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                sr.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

            if target == "2x":
                scale = 2
                sr.setModel("espcn", scale)
                print("Running 2x Lite mode (No tiling needed)...")
                final_img = sr.upsample(img)
                
            else:
                scale = 4
                sr.setModel("edsr", scale)
                print("Running 4x Pro mode (Tiling)...")
                
                h, w, c = img.shape
                final_img = np.zeros((h * scale, w * scale, c), dtype=np.uint8)
                
                tile_size = 128
                for y in range(0, h, tile_size):
                    for x in range(0, w, tile_size):
                        y_end = min(y + tile_size, h)
                        x_end = min(x + tile_size, w)
                        
                        tile = img[y:y_end, x:x_end]
                        upsampled_tile = sr.upsample(tile)
                        
                        out_y = y * scale
                        out_y_end = y_end * scale
                        out_x = x * scale
                        out_x_end = x_end * scale
                        
                        final_img[out_y:out_y_end, out_x:out_x_end] = upsampled_tile

            # Apply Post-Processing (Sharpen) only for 2x/4x if requested
            if post_process.lower() == "true":
                print("Applying post-processing (Sharpen)...")
                
                # Unsharp Mask for clarity
                gaussian = cv2.GaussianBlur(final_img, (0, 0), 2.0)
                final_img = cv2.addWeighted(final_img, 1.5, gaussian, -0.5, 0)
                    
        cv2.imwrite(output_path, final_img)
        print("Success")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python enhance_image.py <input_path> <output_path> <model_path> [mode] [target] [post_process] [downscale]")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    model_path = sys.argv[3]
    mode = sys.argv[4] if len(sys.argv) > 4 else "cpu"
    target = sys.argv[5] if len(sys.argv) > 5 else "4x"
    post_process = sys.argv[6] if len(sys.argv) > 6 else "false"
    downscale = sys.argv[7] if len(sys.argv) > 7 else "true"
    
    enhance_image(input_path, output_path, model_path, mode, target, post_process, downscale)
