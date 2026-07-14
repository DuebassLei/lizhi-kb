"""Render Cipher Nest cover canvas — one-shot craftsmanship piece."""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parent
FONT = Path(r"C:\Users\11301\.claude\skills\canvas-design\canvas-fonts")
OUT = ROOT / "cipher-nest-canvas.png"

W, H = 2400, 1600
RNG = random.Random(42)

# Palette — charcoal ore + warm phosphor
BG = (18, 17, 16)
INK = (232, 226, 216)
MUTED = (120, 114, 106)
RULE = (48, 46, 43)
ACCENT = (196, 132, 72)  # amber-copper
ACCENT_DIM = (120, 78, 42)
GRAIN_ALPHA = 28


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT / name), size)


def make_grain(size: tuple[int, int], alpha: int = GRAIN_ALPHA) -> Image.Image:
    w, h = size
    noise = Image.new("L", (w // 2, h // 2))
    pix = noise.load()
    for y in range(h // 2):
        for x in range(w // 2):
            pix[x, y] = RNG.randint(0, 255)
    noise = noise.resize((w, h), Image.Resampling.NEAREST)
    grain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = grain.load()
    n = noise.load()
    for y in range(h):
        for x in range(w):
            v = n[x, y]
            a = int(alpha * (v / 255))
            g[x, y] = (255, 255, 255, a) if v > 128 else (0, 0, 0, a)
    return grain


def draw_lattice(draw: ImageDraw.ImageDraw, margin: int) -> None:
    # Fine lattice field — knowledge net, almost invisible
    step = 48
    for x in range(margin, W - margin, step):
        draw.line([(x, margin), (x, H - margin)], fill=(*RULE, 55), width=1)
    for y in range(margin, H - margin, step):
        draw.line([(margin, y), (W - margin, y)], fill=(*RULE, 55), width=1)
    # Dot register at intersections (every 3rd)
    for x in range(margin, W - margin, step * 3):
        for y in range(margin, H - margin, step * 3):
            r = 2
            draw.ellipse([x - r, y - r, x + r, y + r], fill=(*MUTED, 90))


def draw_concentric_nest(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    # Nested vault chamber rings — incomplete, suggesting a den
    for i, radius in enumerate([420, 340, 260, 180, 110]):
        bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
        # incomplete arc via thick outline segments
        start = 40 + i * 18
        end = 300 + i * 12
        draw.arc(bbox, start=start, end=end, fill=(*RULE, 180), width=2)
    # Inner soft eye / phosphor
    draw.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], outline=ACCENT, width=2)
    draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=ACCENT)
    # Offset ear-like triangle (organic interruption)
    ear = [(cx + 98, cy - 156), (cx + 148, cy - 210), (cx + 168, cy - 130)]
    draw.polygon(ear, outline=(*ACCENT_DIM, 200))
    # Link nodes around ring
    for ang in range(0, 360, 30):
        rad = math.radians(ang)
        x = cx + int(260 * math.cos(rad))
        y = cy + int(260 * math.sin(rad))
        draw.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(*MUTED, 160))
        if ang % 60 == 0:
            x2 = cx + int(180 * math.cos(rad))
            y2 = cy + int(180 * math.sin(rad))
            draw.line([(x, y), (x2, y2)], fill=(*ACCENT_DIM, 100), width=1)


def draw_micro_marks(draw: ImageDraw.ImageDraw) -> None:
    # Clinical reference ticks — imaginary discipline catalog
    labels = [
        ("01", 120, 180),
        ("02", 120, 280),
        ("03", 120, 380),
        ("A·NE", W - 280, 180),
        ("B·SE", W - 280, H - 220),
        ("FIELD", 120, H - 220),
    ]
    f = font("IBMPlexMono-Regular.ttf", 18)
    for text, x, y in labels:
        draw.text((x, y), text, font=f, fill=(*MUTED, 140))
        draw.line([(x, y + 28), (x + 48, y + 28)], fill=(*RULE, 200), width=1)


def main() -> None:
    base = Image.new("RGBA", (W, H), (*BG, 255))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    margin = 96
    # Outer rule frame
    draw.rectangle(
        [margin, margin, W - margin, H - margin],
        outline=(*RULE, 220),
        width=1,
    )
    # Inner offset frame (nest wall)
    draw.rectangle(
        [margin + 24, margin + 24, W - margin - 24, H - margin - 24],
        outline=(*RULE, 100),
        width=1,
    )

    draw_lattice(draw, margin + 48)
    draw_concentric_nest(draw, W // 2 + 120, H // 2 + 20)
    draw_micro_marks(draw)

    # Left typographic column — sparse structural text
    display = font("InstrumentSans-Regular.ttf", 96)
    mono = font("IBMPlexMono-Regular.ttf", 22)
    mono_sm = font("IBMPlexMono-Regular.ttf", 16)
    serif = font("InstrumentSerif-Regular.ttf", 36)

    # Vertical serial stamp
    draw.text((margin + 48, margin + 48), "LZ·KB / 01", font=mono, fill=(*MUTED, 180))
    draw.text((margin + 48, margin + 88), "CIPHER NEST", font=mono_sm, fill=(*ACCENT, 220))

    # Large word as beam
    draw.text((margin + 48, H // 2 - 160), "NEST", font=display, fill=(*INK, 235))
    # Whisper line
    draw.text(
        (margin + 48, H // 2 - 40),
        "quiet containment",
        font=serif,
        fill=(*MUTED, 200),
    )

    # Bottom rule + essential phrase
    draw.line(
        [(margin + 48, H - margin - 100), (W // 2 - 40, H - margin - 100)],
        fill=(*ACCENT, 180),
        width=2,
    )
    draw.text(
        (margin + 48, H - margin - 80),
        "PRIVATE  ·  LINKED  ·  AWAKE",
        font=mono_sm,
        fill=(*INK, 160),
    )

    # Right corner vault stamp
    stamp = font("IBMPlexMono-Bold.ttf", 14)
    draw.text((W - margin - 220, H - margin - 80), "OBS·FIELD·NOTE", font=stamp, fill=(*MUTED, 130))
    draw.text((W - margin - 220, H - margin - 56), "MASTER CRAFT", font=stamp, fill=(*ACCENT_DIM, 200))

    # Composite with soft blur on lattice layer only for depth? keep crisp
    composed = Image.alpha_composite(base, layer)

    # Soft vignette
    vignette = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vignette)
    for i in range(80):
        a = int(i * 1.8)
        vd.rectangle([i * 2, i * 2, W - i * 2, H - i * 2], outline=a)
    vignette = vignette.filter(ImageFilter.GaussianBlur(40))
    dark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dark.putalpha(ImageEnhance.Brightness(vignette).enhance(0.35).point(lambda p: int(p * 0.45)))
    composed = Image.alpha_composite(composed, dark)

    # Grain overlay
    grain = make_grain((W, H), 22)
    composed = Image.alpha_composite(composed, grain)

    # Subtle warmth lift on accent eye area only
    final = composed.convert("RGB")
    final.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
