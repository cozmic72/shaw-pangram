#!/usr/bin/env python3
"""
Generate favicon for Shavian Pangram Solver.
Uses the Ormin font with blue/purple gradient color scheme to match the UI.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path


def create_favicon(size, font_path, bg_color='white', text_color=(102, 126, 234),
                   text='𐑖𐑐', corner_radius_ratio=0.25, font_size_ratio=0.88, y_position_ratio=0.81,
                   letter_spacing_ratio=0.08):
    """
    Create a favicon with customizable parameters.

    Args:
        size: Icon size in pixels (square)
        font_path: Path to Ormin font file
        bg_color: Background color (white, transparent, or RGB tuple)
        text_color: Text color as RGB tuple (default: #667eea - purple from UI)
        text: Shavian text to display (default: 𐑖𐑐)
        corner_radius_ratio: Corner radius as ratio of size (0 = sharp corners)
        font_size_ratio: Font size as ratio of icon size
        y_position_ratio: Y position as ratio (baseline position)
        letter_spacing_ratio: Extra spacing between letters as ratio of size
    """
    # Create image
    if bg_color == 'transparent':
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    elif bg_color == 'white':
        img = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    else:
        img = Image.new('RGBA', (size, size), bg_color)

    draw = ImageDraw.Draw(img)

    # Draw text
    font_size = int(size * font_size_ratio)
    font = ImageFont.truetype(str(font_path), font_size)
    stroke_width = max(1, size // 32)

    # Split text into individual characters and measure each
    chars = list(text)
    char_widths = []
    char_bboxes = []

    for char in chars:
        bbox = draw.textbbox((0, 0), char, font=font)
        char_widths.append(bbox[2] - bbox[0])
        char_bboxes.append(bbox)

    # Calculate extra spacing and total width
    extra_spacing = int(size * letter_spacing_ratio)
    total_width = sum(char_widths) + extra_spacing * (len(chars) - 1)

    # Calculate starting x position to center the text
    x_position = (size - total_width) // 2

    # Draw each character with spacing
    for i, char in enumerate(chars):
        bbox = char_bboxes[i]
        x = x_position - bbox[0]
        # y_position_ratio is baseline position (like SVG), so subtract bbox[3] (baseline offset)
        y = int(size * y_position_ratio) - bbox[3]

        draw.text((x, y), char, font=font, fill=text_color,
                  stroke_width=stroke_width, stroke_fill=text_color)

        # Move x position for next character
        x_position += char_widths[i] + extra_spacing

    return img


def generate_favicons(font_path, output_dir):
    """Generate website favicons."""
    print("\n=== Generating Favicons ===")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Standard favicon sizes
    sizes = [16, 32, 64, 128, 192, 512]

    for size in sizes:
        img = create_favicon(size, font_path, bg_color='white')
        output_path = output_dir / f'favicon-{size}x{size}.png'
        img.save(output_path, 'PNG')
        print(f"  ✓ favicon-{size}x{size}.png")

    # Generate default favicon.ico (32x32)
    img_32 = create_favicon(32, font_path, bg_color='white')
    favicon_ico = output_dir / 'favicon.ico'
    img_32.save(favicon_ico, 'ICO')
    print(f"  ✓ favicon.ico")

    # Generate default favicon.png (64x64)
    img_64 = create_favicon(64, font_path, bg_color='white')
    favicon_png = output_dir / 'favicon.png'
    img_64.save(favicon_png, 'PNG')
    print(f"  ✓ favicon.png")

    # Generate apple-touch-icon (180x180 for iPhone)
    img_180 = create_favicon(180, font_path, bg_color='white')
    apple_icon = output_dir / 'apple-touch-icon.png'
    img_180.save(apple_icon, 'PNG')
    print(f"  ✓ apple-touch-icon.png")


def main():
    """Generate all favicons."""
    # Paths
    script_dir = Path(__file__).parent
    font_path = Path('/Users/jonathan/Code/shaw-dict/src/fonts/Ormin-Regular.otf')
    output_dir = script_dir

    if not font_path.exists():
        print(f"Error: Font not found at {font_path}")
        return 1

    print(f"Generating favicons with Ormin font")
    print(f"Text: 𐑖𐑐")
    print(f"Color: #667eea (purple from UI gradient)")
    print(f"Output directory: {output_dir}")

    generate_favicons(font_path, output_dir)

    print("\n✓ All favicons generated successfully!")
    return 0


if __name__ == '__main__':
    exit(main())
