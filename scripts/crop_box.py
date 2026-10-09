#!/usr/bin/env python3
"""
scripts/crop_box.py

High-resolution (300 DPI) PDF Diagram Cropper for Revizz Cambridge MCQ Ingestion.
Extracts bounding-box clipped regions from PDF pages using PyMuPDF (fitz) and PIL.
Supports both normalized Gemini bounding boxes [0..1000] and standard floats [0..1].
"""

import sys
import os
import json
import argparse

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    from PIL import Image
except ImportError:
    Image = None


def normalize_coordinates(ymin, xmin, ymax, xmax):
    """
    Normalizes coordinates to [0.0, 1.0] float range.
    Handles Gemini 1000-scale coordinates (e.g. 0 to 1000) or standard 0.0 to 1.0 floats.
    """
    coords = [float(ymin), float(xmin), float(ymax), float(xmax)]
    max_val = max(abs(c) for c in coords)
    
    # If any value is greater than 1.0, assume Gemini 1000-scale
    scale = 1000.0 if max_val > 1.0 else 1.0
    
    ny_min = coords[0] / scale
    nx_min = coords[1] / scale
    ny_max = coords[2] / scale
    nx_max = coords[3] / scale
    
    # Clamp to [0.0, 1.0]
    ny_min = max(0.0, min(1.0, ny_min))
    nx_min = max(0.0, min(1.0, nx_min))
    ny_max = max(0.0, min(1.0, ny_max))
    nx_max = max(0.0, min(1.0, nx_max))
    
    return ny_min, nx_min, ny_max, nx_max


def crop_diagram(
    pdf_path: str,
    page_number: int,
    ymin: float,
    xmin: float,
    ymax: float,
    xmax: float,
    output_path: str,
    dpi: int = 300,
    padding_pts: float = 8.0,
):
    """
    Crops a diagram from the specified PDF page and writes a 300 DPI PNG.
    """
    if not fitz:
        return {
            "success": False,
            "error": "PyMuPDF (fitz) is not installed in the Python environment."
        }
        
    if not os.path.exists(pdf_path):
        return {
            "success": False,
            "error": f"PDF file does not exist: {pdf_path}"
        }

    # Normalize coordinates
    ny_min, nx_min, ny_max, nx_max = normalize_coordinates(ymin, xmin, ymax, xmax)
    
    # Check for degenerate bounding box (pure text table, zero-area, or inverted box)
    box_w = nx_max - nx_min
    box_h = ny_max - ny_min
    if box_w < 0.005 or box_h < 0.005:
        return {
            "success": False,
            "reason": "degenerate_or_missing_bbox",
            "error": "Bounding box area is near zero or degenerate (likely text table or absent diagram)."
        }

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to open PDF file: {str(e)}"
        }

    total_pages = len(doc)
    if total_pages == 0:
        doc.close()
        return {
            "success": False,
            "error": "PDF has no pages."
        }

    # Clamp page_number (1-indexed input converted to 0-indexed)
    p_idx = max(0, min(page_number - 1, total_pages - 1))
    page = doc[p_idx]
    page_rect = page.rect  # width & height in points (72 pt / inch)

    # Convert normalized coords to points
    x0 = nx_min * page_rect.width
    y0 = ny_min * page_rect.height
    x1 = nx_max * page_rect.width
    y1 = ny_max * page_rect.height

    # Apply padding to ensure axis labels and tick marks aren't clipped
    x0 = max(0.0, x0 - padding_pts)
    y0 = max(0.0, y0 - padding_pts)
    x1 = min(page_rect.width, x1 + padding_pts)
    y1 = min(page_rect.height, y1 + padding_pts)

    clip_rect = fitz.Rect(x0, y0, x1, y1)

    # Calculate zoom for high-resolution output (default: 300 DPI)
    # PyMuPDF native resolution is 72 DPI
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)

    # Render pixmap with alpha=False to produce crisp, clean solid white background
    pix = page.get_pixmap(matrix=mat, clip=clip_rect, alpha=False)

    # Ensure target directory exists
    out_dir = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(out_dir, exist_ok=True)

    # Save initial PNG
    pix.save(output_path)
    width = pix.width
    height = pix.height
    doc.close()

    # Optional PIL enhancement: Embed 300 DPI metadata and optimize PNG compression
    if Image is not None:
        try:
            with Image.open(output_path) as img:
                img.save(output_path, "PNG", dpi=(dpi, dpi), optimize=True)
        except Exception:
            pass  # Retain the PyMuPDF output if PIL optimization fails

    return {
        "success": True,
        "outputPath": output_path,
        "width": width,
        "height": height,
        "dpi": dpi,
        "page": p_idx + 1
    }


def main():
    parser = argparse.ArgumentParser(description="Crop diagrams from PDF at 300 DPI")
    parser.add_argument("--pdf", "-p", help="Path to PDF file")
    parser.add_argument("--page", type=int, default=1, help="1-indexed page number")
    parser.add_argument("--ymin", type=float, default=0.0, help="Top coordinate")
    parser.add_argument("--xmin", type=float, default=0.0, help="Left coordinate")
    parser.add_argument("--ymax", type=float, default=0.0, help="Bottom coordinate")
    parser.add_argument("--xmax", type=float, default=0.0, help="Right coordinate")
    parser.add_argument("--out", "-o", help="Target output PNG path")
    parser.add_argument("--dpi", type=int, default=300, help="Target DPI (default 300)")
    parser.add_argument("--padding", type=float, default=8.0, help="Padding in points")
    parser.add_argument("--json-input", help="JSON string or file containing parameters")

    args = parser.parse_args()

    # Support JSON input mode
    if args.json_input:
        try:
            if os.path.exists(args.json_input):
                with open(args.json_input, "r") as f:
                    params = json.load(f)
            else:
                params = json.loads(args.json_input)
            
            pdf = params.get("pdf") or params.get("pdfPath")
            page = int(params.get("page") or params.get("page_number", 1))
            ymin = float(params.get("ymin", 0))
            xmin = float(params.get("xmin", 0))
            ymax = float(params.get("ymax", 0))
            xmax = float(params.get("xmax", 0))
            out = params.get("out") or params.get("outputPath")
            dpi = int(params.get("dpi", 300))
            padding = float(params.get("padding", 8.0))
        except Exception as e:
            res = {"success": False, "error": f"Invalid JSON input: {str(e)}"}
            print(json.dumps(res))
            sys.exit(0)
    else:
        pdf = args.pdf
        page = args.page
        ymin = args.ymin
        xmin = args.xmin
        ymax = args.ymax
        xmax = args.xmax
        out = args.out
        dpi = args.dpi
        padding = args.padding

    if not pdf or not out:
        res = {"success": False, "error": "Missing required arguments: --pdf and --out"}
        print(json.dumps(res))
        sys.exit(0)

    result = crop_diagram(
        pdf_path=pdf,
        page_number=page,
        ymin=ymin,
        xmin=xmin,
        ymax=ymax,
        xmax=xmax,
        output_path=out,
        dpi=dpi,
        padding_pts=padding
    )

    print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()
