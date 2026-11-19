"""Draws Buzz's tray icons: original art matching components/PresenceDot.tsx.

Run: python3 scripts/gen-tray-icons.py   (needs Pillow; output is committed)
"""
from pathlib import Path
from PIL import Image, ImageDraw

SIZE = 64  # drawn large, saved at 32 px for a smooth edge
OUT = Path(__file__).resolve().parent.parent / "src-tauri" / "icons" / "tray"
INK = (58, 42, 0, 255)
YELLOW = (255, 204, 0, 255)
BUSY = (232, 130, 10, 255)
GRAY = (179, 179, 179, 255)


def face(d, fill, ink=INK):
    d.ellipse((4, 4, 60, 60), fill=fill, outline=ink, width=4)
    d.ellipse((20, 20, 28, 32), fill=ink)
    d.ellipse((36, 20, 44, 32), fill=ink)
    d.arc((16, 22, 48, 50), start=20, end=160, fill=ink, width=4)


def draw(name, painter):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    painter(ImageDraw.Draw(img))
    OUT.mkdir(parents=True, exist_ok=True)
    img.resize((32, 32), Image.LANCZOS).save(OUT / f"{name}.png")


draw("online", lambda d: face(d, YELLOW))
draw("offline", lambda d: face(d, GRAY, ink=(120, 120, 120, 255)))


def busy(d):
    d.ellipse((4, 4, 60, 60), fill=BUSY, outline=(90, 15, 15, 255), width=4)
    d.rounded_rectangle((15, 26, 49, 38), radius=4, fill=(255, 255, 255, 255))


def away(d):
    d.ellipse((4, 4, 60, 60), fill=YELLOW, outline=INK, width=4)
    d.ellipse((13, 13, 51, 51), fill=(255, 255, 255, 255), outline=INK, width=2)
    d.line((32, 18, 32, 32), fill=INK, width=4)
    d.line((32, 32, 42, 38), fill=INK, width=4)


def invisible(d):
    face(d, (255, 230, 150, 255), ink=(150, 130, 80, 255))
    for i in range(0, 360, 30):  # dashed ring
        d.arc((1, 1, 63, 63), start=i, end=i + 15, fill=INK, width=3)


draw("busy", busy)
draw("away", away)
draw("invisible", invisible)
print("wrote", sorted(p.name for p in OUT.glob("*.png")))
