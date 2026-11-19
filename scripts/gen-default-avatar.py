"""Draws Buzz's default Avatar (Req 1.3): an original head-and-shoulders
silhouette. The signup trigger points new profiles at /avatars/default.png.
Run: python3 scripts/gen-default-avatar.py   (needs Pillow; output is committed)
"""
from pathlib import Path
from PIL import Image, ImageDraw

SIZE = 384  # drawn large, saved at 96 px for a smooth edge
OUT = Path(__file__).resolve().parent.parent / "public" / "avatars" / "default.png"
BACKGROUND = (226, 220, 238, 255)  # pale lavender, sits well beside the purple chrome
FIGURE = (150, 132, 184, 255)

img = Image.new("RGBA", (SIZE, SIZE), BACKGROUND)
d = ImageDraw.Draw(img)
d.ellipse((132, 64, 252, 184), fill=FIGURE)  # head
d.ellipse((72, 204, 312, 444), fill=FIGURE)  # shoulders, cut off by the frame
OUT.parent.mkdir(parents=True, exist_ok=True)
img.resize((96, 96), Image.LANCZOS).save(OUT)
print(f"wrote {OUT}")
