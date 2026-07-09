#!/usr/bin/env python3
"""Generate Lizhi Knowledge landing page hero canvas — Nest Domain Silence."""

from __future__ import annotations

import math
import os
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit("pip install Pillow")

W, H = 1920, 1080
BG = (26, 29, 35)
CANVAS = (30, 33, 40)
SURFACE = (37, 41, 50)
LINK = (91, 159, 212)
PAW = (212, 165, 116)
TEXT = (227, 229, 232)
MUTED = (120, 127, 140)
SECURE = (74, 222, 154)

FONT_DIR = Path(r"C:\Users\11301\.claude\skills\canvas-design\canvas-fonts")
OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "design" / "assets"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    # System Chinese fonts (Windows)
    system_fonts = [
        Path(r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\msyhbd.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
    ]
    if "SC" in name or "CJK" in name or "Chinese" in name:
        bold = Path(r"C:\Windows\Fonts\msyhbd.ttc")
        regular = Path(r"C:\Windows\Fonts\msyh.ttc")
        if "Bold" in name and bold.exists():
            return ImageFont.truetype(str(bold), size)
        if regular.exists():
            return ImageFont.truetype(str(regular), size)
    for ext in (".ttf", ".otf", ".ttc"):
        p = FONT_DIR / f"{name}{ext}"
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def draw_grid(draw: ImageDraw.ImageDraw, opacity: int = 12) -> None:
    step = 48
    c = (255, 255, 255, opacity)
    for x in range(0, W, step):
        draw.line([(x, 0), (x, H)], fill=c, width=1)
    for y in range(0, H, step):
        draw.line([(0, y), (W, y)], fill=c, width=1)


def draw_graph_texture(draw: ImageDraw.ImageDraw) -> None:
    cx, cy = 1350, 420
    nodes = [
        (cx, cy, 8, LINK),
        (cx - 180, cy - 120, 5, LINK),
        (cx + 200, cy - 90, 5, LINK),
        (cx - 220, cy + 140, 5, PAW),
        (cx + 160, cy + 160, 4, LINK),
        (cx - 60, cy - 200, 4, LINK),
        (cx + 80, cy + 220, 4, PAW),
        (cx - 300, cy + 40, 3, LINK),
        (cx + 280, cy - 30, 3, LINK),
    ]
    edges = [
        (0, 1), (0, 2), (0, 3), (0, 4), (0, 5), (0, 6),
        (1, 5), (2, 6), (3, 7), (4, 8), (1, 7), (2, 8),
    ]
    for i, j in edges:
        x1, y1 = nodes[i][0], nodes[i][1]
        x2, y2 = nodes[j][0], nodes[j][1]
        draw.line([(x1, y1), (x2, y2)], fill=(*LINK, 40), width=1)
    for x, y, r, col in nodes:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(*col, 80))


def draw_nest_logo(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float = 1.0) -> None:
    r = int(48 * scale)
    draw.arc([cx - r, cy - r + 20, cx + r, cy + r + 20], 200, 340, fill=PAW, width=int(3 * scale))
    draw.ellipse([cx - int(14 * scale), cy - int(6 * scale), cx + int(14 * scale), cy + int(22 * scale)],
                 outline=PAW, width=int(2 * scale))
    draw.ellipse([cx - int(8 * scale), cy - int(2 * scale), cx + int(8 * scale), cy + int(14 * scale)], fill=PAW)


def draw_mock_ui(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    draw.rounded_rectangle([x, y, x + w, y + h], radius=12, fill=CANVAS, outline=(255, 255, 255, 20), width=1)
    draw.rectangle([x, y, x + w, y + 36], fill=SURFACE)
    for i, c in enumerate([(240, 112, 112), (232, 184, 109), (74, 222, 154)]):
        draw.ellipse([x + 14 + i * 18, y + 14, x + 22 + i * 18, y + 22], fill=(*c, 180))
    sw = int(w * 0.28)
    draw.rectangle([x, y + 36, x + sw, y + h], fill=SURFACE)
    for i, indent in enumerate([0, 16, 16, 0, 0]):
        lw = int(sw * (0.7 if i == 0 else 0.55))
        draw.rounded_rectangle(
            [x + 12 + indent, y + 56 + i * 22, x + 12 + indent + lw, y + 64 + i * 22],
            radius=3, fill=PAW if i == 0 else (63, 71, 86)
        )
    ex = x + sw + 24
    for i, (lw, col) in enumerate([(int(w * 0.45), SURFACE), (int(w * 0.35), SURFACE),
                                    (int(w * 0.3), LINK), (int(w * 0.4), SURFACE), (int(w * 0.2), SURFACE)]):
        draw.rounded_rectangle([ex, y + 56 + i * 20, ex + lw, y + 62 + i * 20], radius=3, fill=col)


def main() -> None:
    img = Image.new("RGBA", (W, H), (*BG, 255))
    draw = ImageDraw.Draw(img, "RGBA")

    # Ambient gradients
    for i in range(200):
        alpha = int(8 * (1 - i / 200))
        draw.ellipse([900 - i * 3, 200 - i * 2, 1500 + i * 3, 700 + i * 2], fill=(*LINK, alpha))
    for i in range(120):
        alpha = int(5 * (1 - i / 120))
        draw.ellipse([100 - i * 2, 600 - i, 500 + i * 2, 900 + i], fill=(*PAW, alpha))

    draw_grid(draw, opacity=8)
    draw_graph_texture(draw)

    # Typography
    font_display = load_font("Chinese-Bold", 64)
    font_display_reg = load_font("Chinese", 64)
    font_sub = load_font("Chinese", 22)
    font_mono = load_font("JetBrainsMono-Regular", 13)
    font_mono_sm = load_font("JetBrainsMono-Regular", 11)
    font_label = load_font("JetBrainsMono-Regular", 12)
    font_brand = load_font("Chinese", 20)

    # Left content block
    draw_nest_logo(draw, 120, 130, 0.7)
    draw.text((168, 108), "狸知知识库", fill=TEXT, font=font_brand)
    draw.text((120, 200), "LIZHI KNOWLEDGE", fill=(*PAW, 200), font=font_label)

    # Main headline — split lines
    lines = ["你的加密知识库，", "猫一样安静。"]
    y = 280
    for line in lines:
        f = font_display if "安静" in line else font_display_reg
        draw.text((120, y), line, fill=TEXT, font=f)
        y += 78

    sub = "本地优先 · 端到端加密 · 双链成网 · 默认零网络"
    draw.text((120, y + 16), sub, fill=MUTED, font=font_sub)

    # CTA buttons
    draw.rounded_rectangle([120, y + 72, 280, y + 120], radius=8, fill=PAW)
    draw.text((152, y + 86), "免费下载", fill=BG, font=font_sub)
    draw.rounded_rectangle([296, y + 72, 500, y + 120], radius=8, outline=(255, 255, 255, 36), width=1)
    draw.text((320, y + 86), "安全白皮书", fill=TEXT, font=font_sub)

    # Badges
    badges = ["AES-256-GCM", "Argon2id", "0 Network", "Local-Only"]
    bx = 120
    by = y + 148
    for b in badges:
        tw = font_mono.getbbox(b)[2] + 24
        draw.rounded_rectangle([bx, by, bx + tw, by + 28], radius=6, fill=SURFACE, outline=(255, 255, 255, 20))
        draw.text((bx + 12, by + 7), b, fill=SECURE if "0" in b else MUTED, font=font_mono_sm)
        bx += tw + 10

    # Mock UI right
    draw_mock_ui(draw, 820, 180, 980, 620)

    # Graph overlay on mock
    gx, gy = 1580, 620
    for angle in range(0, 360, 72):
        rad = math.radians(angle)
        nx = gx + int(80 * math.cos(rad))
        ny = gy + int(60 * math.sin(rad))
        draw.line([(gx, gy), (nx, ny)], fill=(*LINK, 60), width=1)
        draw.ellipse([nx - 5, ny - 5, nx + 5, ny + 5], fill=(*LINK, 100))
    draw.ellipse([gx - 7, gy - 7, gx + 7, gy + 7], fill=(*PAW, 180))

    # English anchor
    draw.text((W - 380, H - 48), "Think in your nest. Link your knowledge.", fill=(*MUTED, 140), font=font_mono_sm)

    # Reference markers (scientific bible aesthetic)
    markers = ["REF.01 / NEST", "REF.02 / LINK", "REF.03 / CIPHER"]
    for i, m in enumerate(markers):
        draw.text((120, H - 80 + i * 0), m, fill=(*MUTED, 60), font=font_mono_sm)
    draw.text((120, H - 80), markers[0], fill=(*MUTED, 50), font=font_mono_sm)
    draw.text((280, H - 80), markers[1], fill=(*MUTED, 50), font=font_mono_sm)
    draw.text((440, H - 80), markers[2], fill=(*MUTED, 50), font=font_mono_sm)

    # Subtle nest arc bottom-right
    draw.arc([W - 320, H - 280, W - 40, H], 180, 270, fill=(*PAW, 30), width=2)

    out = OUT_DIR / "landing-hero.png"
    img.convert("RGB").save(str(out), "PNG", optimize=True)
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
