"""Shared image normalization/compression helpers for Firestore-bound fields."""

from __future__ import annotations

import base64
import io
from typing import Optional

from fastapi import HTTPException
from PIL import Image, ImageOps


# Prevent decompression-bomb style payloads.
Image.MAX_IMAGE_PIXELS = 25_000_000


def normalize_image_value(
    raw: Optional[str],
    *,
    field_label: str = "Image",
    strict_data_url: bool = False,
    max_data_url_length: int = 700_000,
    max_dimension: int = 1400,
    jpeg_quality: int = 74,
) -> Optional[str]:
    """
    Normalize image input and aggressively compress data-url images.

    - Empty input -> None
    - data:image/*;base64,... -> decoded, resized, recompressed, returned as data URL
    - non-data URL values -> returned as-is unless strict_data_url=True
    """
    value = (raw or "").strip()
    if not value:
        return None

    if not value.startswith("data:image/") or ";base64," not in value:
        if strict_data_url:
            raise HTTPException(status_code=400, detail=f"Invalid {field_label.lower()} format")
        return value

    try:
        header, b64_data = value.split(",", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {field_label.lower()} format")
    original_mime = "image/jpeg"
    if header.startswith("data:") and ";base64" in header:
        original_mime = header[5:].split(";", 1)[0].strip() or "image/jpeg"

    try:
        original_bytes = base64.b64decode(b64_data, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_label.lower()} data")

    try:
        img = Image.open(io.BytesIO(original_bytes))
        img = ImageOps.exif_transpose(img)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Unreadable {field_label.lower()} data")

    if img.width > max_dimension or img.height > max_dimension:
        img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

    has_alpha = "A" in img.getbands()
    output = io.BytesIO()
    out_mime = "image/jpeg"

    if has_alpha:
        img = img.convert("RGBA")
        img.save(output, format="PNG", optimize=True, compress_level=9)
        out_mime = "image/png"
    else:
        img = img.convert("RGB")
        img.save(output, format="JPEG", optimize=True, progressive=True, quality=jpeg_quality)

    compressed_bytes = output.getvalue()
    # Keep original if recompression unexpectedly expands.
    final_bytes = compressed_bytes if len(compressed_bytes) < len(original_bytes) else original_bytes

    final_mime = out_mime if final_bytes is compressed_bytes else original_mime
    encoded = base64.b64encode(final_bytes).decode("ascii")
    normalized = f"data:{final_mime};base64,{encoded}"
    if len(normalized) > max_data_url_length:
        kb = len(normalized) // 1024
        raise HTTPException(
            status_code=400,
            detail=f"{field_label} is too large after compression ({kb} KB). Please upload a smaller image.",
        )
    return normalized
