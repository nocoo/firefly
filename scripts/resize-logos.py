#!/usr/bin/env python3
"""
Generate all logo derivatives from the single-source logo.png.

Usage:
    python scripts/resize-logos.py

Requires: pip install Pillow
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "logo.png"
PUBLIC = ROOT / "public"
APP = ROOT / "src" / "app"

# Brand background color for OG image canvas (warm parchment)
OG_BG_COLOR = (250, 248, 245)  # #FAF8F5


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source logo not found: {SOURCE}")

    img = Image.open(SOURCE).convert("RGBA")
    print(f"Source: {SOURCE} ({img.size[0]}x{img.size[1]}, {img.mode})")

    PUBLIC.mkdir(exist_ok=True)

    # ── public/ assets (referenced by <img> in components) ──

    # Sidebar logo
    save_resized(img, PUBLIC / "logo-24.png", 24)
    # Login page logo
    save_resized(img, PUBLIC / "logo-80.png", 80)

    # ── src/app/ assets (Next.js file-based metadata convention) ──

    # favicon (32x32 PNG)
    save_resized(img, APP / "icon.png", 32)
    # Apple touch icon (180x180 PNG)
    save_resized(img, APP / "apple-icon.png", 180)

    # favicon.ico (multi-size: 16 + 32)
    ico_16 = img.resize((16, 16), Image.LANCZOS)
    ico_32 = img.resize((32, 32), Image.LANCZOS)
    ico_path = APP / "favicon.ico"
    ico_16.save(ico_path, format="ICO", append_images=[ico_32], sizes=[(16, 16), (32, 32)])
    print(f"  {ico_path.relative_to(ROOT)} (16+32 multi-size ICO)")

    # OpenGraph image (1200x630, centered logo on brand background)
    og_width, og_height = 1200, 630
    og = Image.new("RGB", (og_width, og_height), OG_BG_COLOR)
    # Logo at ~40% of canvas height, centered
    logo_h = int(og_height * 0.4)
    logo_resized = img.resize((logo_h, logo_h), Image.LANCZOS)
    x = (og_width - logo_h) // 2
    y = (og_height - logo_h) // 2
    og.paste(logo_resized, (x, y), logo_resized)  # Use alpha as mask
    og_path = APP / "opengraph-image.png"
    og.save(og_path, "PNG")
    print(f"  {og_path.relative_to(ROOT)} ({og_width}x{og_height})")

    print("\nDone! All derivatives generated.")


def save_resized(src: Image.Image, dest: Path, size: int) -> None:
    resized = src.resize((size, size), Image.LANCZOS)
    resized.save(dest, "PNG")
    print(f"  {dest.relative_to(ROOT)} ({size}x{size})")


if __name__ == "__main__":
    main()
