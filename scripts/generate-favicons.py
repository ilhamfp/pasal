#!/usr/bin/env python3
"""Generate favicons and app icons from SVG sources in logo/.

Usage:
    pip install cairosvg Pillow
    python scripts/generate-favicons.py

Reads from: logo/
Writes to:  apps/web/public/
"""

import shutil
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGO_DIR = ROOT / "logo"
PUBLIC_DIR = ROOT / "apps" / "web" / "public"

STONE_BG = (0xF8, 0xF5, 0xF0, 0xFF)  # #F8F5F0


def svg_to_png(svg_path: Path, width: int, height: int) -> Image.Image:
    """Render an SVG file to a PIL Image at the given dimensions."""
    png_data = cairosvg.svg2png(
        url=str(svg_path),
        output_width=width,
        output_height=height,
    )
    return Image.open(BytesIO(png_data)).convert("RGBA")


def create_app_icon(mark_img: Image.Image, size: int) -> Image.Image:
    """Create an app icon with stone background and centered mark at 70% canvas."""
    canvas = Image.new("RGBA", (size, size), STONE_BG)
    mark_size = int(size * 0.7)
    mark_resized = mark_img.resize((mark_size, mark_size), Image.LANCZOS)
    offset = (size - mark_size) // 2
    canvas.paste(mark_resized, (offset, offset), mark_resized)
    return canvas


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Render master 1024x1024 from icon-primary.svg
    print("Rendering master icon (1024x1024)...")
    master = svg_to_png(LOGO_DIR / "icon-primary.svg", 1024, 1024)

    # 2. Generate transparent favicon PNGs from favicon.svg (optimized for small sizes)
    print("Generating favicon PNGs from favicon.svg...")
    favicon_svg = LOGO_DIR / "favicon.svg"
    favicon_16 = svg_to_png(favicon_svg, 16, 16)
    favicon_32 = svg_to_png(favicon_svg, 32, 32)
    favicon_16.save(PUBLIC_DIR / "favicon-16x16.png")
    favicon_32.save(PUBLIC_DIR / "favicon-32x32.png")

    # 3. Generate 48x48 from master for ICO
    print("Generating favicon.ico (16+32+48)...")
    favicon_48 = svg_to_png(favicon_svg, 48, 48)

    # 4. Pack 16+32+48 into favicon.ico
    # Pillow's ICO append_images is unreliable, so we use the 48px render as
    # base and let Pillow downscale to 16/32. The quality difference is
    # negligible at these sizes since the SVG is simple geometric shapes.
    favicon_48.save(
        PUBLIC_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    # 5. Generate opaque app icons on stone background
    print("Generating app icons...")
    app_icons = {
        "apple-touch-icon.png": 180,
        "android-chrome-192.png": 192,
        "android-chrome-512.png": 512,
        "mstile-150x150.png": 150,
    }
    for filename, size in app_icons.items():
        icon = create_app_icon(master, size)
        icon.save(PUBLIC_DIR / filename)
        print(f"  {filename} ({size}x{size})")

    # 6. Render og-image.png from og-image-source.svg
    print("Rendering og-image.png (1200x630)...")
    og_image = svg_to_png(LOGO_DIR / "og-image-source.svg", 1200, 630)
    og_image.save(PUBLIC_DIR / "og-image.png")

    # 7. Copy favicon.svg
    print("Copying favicon.svg...")
    shutil.copy2(LOGO_DIR / "favicon.svg", PUBLIC_DIR / "favicon.svg")

    # 8. Copy safari-pinned-tab.svg
    print("Copying safari-pinned-tab.svg...")
    shutil.copy2(LOGO_DIR / "safari-pinned-tab.svg", PUBLIC_DIR / "safari-pinned-tab.svg")

    # Summary
    expected = [
        "favicon.ico", "favicon.svg", "favicon-16x16.png", "favicon-32x32.png",
        "apple-touch-icon.png", "android-chrome-192.png", "android-chrome-512.png",
        "mstile-150x150.png", "og-image.png", "safari-pinned-tab.svg",
    ]
    print(f"\nGenerated {len(expected)} files in {PUBLIC_DIR}:")
    missing = []
    for f in expected:
        exists = (PUBLIC_DIR / f).exists()
        print(f"  [{'OK' if exists else 'MISSING'}] {f}")
        if not exists:
            missing.append(f)

    if missing:
        print(f"\nWARNING: {len(missing)} file(s) missing!")
        raise SystemExit(1)
    print("\nAll files generated successfully!")


if __name__ == "__main__":
    main()
