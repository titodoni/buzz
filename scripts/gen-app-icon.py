"""Draws Buzz's app icon (original art, ADR 0006): the yellow status smiley on
a purple rounded square, in the colors of the title bars and PresenceDot.
Run: python3 scripts/gen-app-icon.py   (needs Pillow; output is committed)
Then: npx tauri icon src-tauri/icons/app-icon.png   (writes every size and format)
"""
from pathlib import Path
from PIL import Image, ImageDraw

SIZE = 1024
OUT = Path(__file__).resolve().parent.parent / "src-tauri" / "icons" / "app-icon.png"
PURPLE_TOP = (120, 40, 200)
PURPLE_BOTTOM = (64, 0, 128)
YELLOW = (255, 204, 0, 255)
INK = (58, 42, 0, 255)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

# Purple rounded square with a top-to-bottom gradient, like the glossy title bars.
gradient = Image.new("RGBA", (SIZE, SIZE))
g = ImageDraw.Draw(gradient)
for y in range(SIZE):
    t = y / (SIZE - 1)
    color = tuple(round(a + (b - a) * t) for a, b in zip(PURPLE_TOP, PURPLE_BOTTOM))
    g.line([(0, y), (SIZE, y)], fill=(*color, 255))
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle((40, 40, SIZE - 40, SIZE - 40), radius=200, fill=255)
img.paste(gradient, (0, 0), mask)

# A soft highlight across the top half, for the glossy look.
gloss = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(gloss).rounded_rectangle((70, 60, SIZE - 70, SIZE // 2), radius=170, fill=(255, 255, 255, 40))
img.alpha_composite(gloss)

# The smiley, drawn like the Available status icon.
d = ImageDraw.Draw(img)
c, r = SIZE // 2, 330
d.ellipse((c - r, c - r, c + r, c + r), fill=YELLOW, outline=INK, width=28)
d.ellipse((c - 130, c - 150, c - 60, c - 20), fill=INK)  # left eye
d.ellipse((c + 60, c - 150, c + 130, c - 20), fill=INK)  # right eye
d.arc((c - 200, c - 120, c + 200, c + 210), start=20, end=160, fill=INK, width=30)  # smile

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT)
print(f"wrote {OUT}")
