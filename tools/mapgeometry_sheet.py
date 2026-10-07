"""tools/mapgeometry_sheet.py - contact sheet of gridded magnified crops (for reading landmark pixels).

python tools/mapgeometry_sheet.py <image> <out.png> half zoom step name:cx,cy [name:cx,cy ...]
"""
import sys
from PIL import Image, ImageDraw

img, out = sys.argv[1], sys.argv[2]
half, zoom, step = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
items = []
for a in sys.argv[6:]:
    name, xy = a.split(':')
    cx, cy = map(float, xy.split(','))
    items.append((name, cx, cy))
im = Image.open(img).convert('RGB')
tiles = []
for name, cx, cy in items:
    x0, y0 = int(cx - half), int(cy - half)
    x1, y1 = int(cx + half), int(cy + half)
    c = im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * zoom, (y1 - y0) * zoom), Image.NEAREST)
    d = ImageDraw.Draw(c)
    for x in range((x0 // step + 1) * step, x1, step):
        X = (x - x0) * zoom
        major = x % (2 * step) == 0
        d.line([(X, 0), (X, c.size[1])], fill=(255, 0, 255) if major else (0, 200, 255), width=1)
        if major:
            d.text((X + 2, 12), str(x), fill=(200, 0, 200))
    for y in range((y0 // step + 1) * step, y1, step):
        Y = (y - y0) * zoom
        major = y % (2 * step) == 0
        d.line([(0, Y), (c.size[0], Y)], fill=(255, 0, 255) if major else (0, 200, 255), width=1)
        if major:
            d.text((2, Y + 2), str(y), fill=(200, 0, 200))
    d.rectangle([0, 0, 8 * len(name) + 6, 11], fill=(0, 0, 0))
    d.text((3, 0), name, fill=(255, 255, 0))
    tiles.append(c)
n = len(tiles)
cols = 2 if n > 1 else 1
rows = (n + cols - 1) // cols
W, H = tiles[0].size
sheet = Image.new('RGB', (cols * W + (cols - 1) * 6, rows * H + (rows - 1) * 6), (0, 0, 0))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * (W + 6), (i // cols) * (H + 6)))
sheet.save(out)
print(out, sheet.size)
