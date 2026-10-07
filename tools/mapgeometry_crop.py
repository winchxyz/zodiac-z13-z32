"""tools/mapgeometry_crop.py - magnified crops with a labelled pixel grid, for reading landmark positions.

python tools/mapgeometry_crop.py <image> <cx> <cy> [half=30] [zoom=8] [step=5] [out.png]
Grid lines every <step> source pixels; labels every 2*step. Output defaults to the scratchpad.
"""
import os
import sys
from PIL import Image, ImageDraw

img = sys.argv[1]
cx, cy = float(sys.argv[2]), float(sys.argv[3])
half = int(sys.argv[4]) if len(sys.argv) > 4 else 30
zoom = int(sys.argv[5]) if len(sys.argv) > 5 else 8
step = int(sys.argv[6]) if len(sys.argv) > 6 else 5
out = sys.argv[7] if len(sys.argv) > 7 else os.path.join(os.environ.get('SCRATCH', '.'), 'crop.png')
im = Image.open(img).convert('RGB')
x0, y0 = int(cx - half), int(cy - half)
x1, y1 = int(cx + half), int(cy + half)
c = im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * zoom, (y1 - y0) * zoom), Image.NEAREST)
d = ImageDraw.Draw(c)
for x in range((x0 // step + 1) * step, x1, step):
    X = (x - x0) * zoom
    major = x % (2 * step) == 0
    d.line([(X, 0), (X, c.size[1])], fill=(255, 0, 255) if major else (0, 200, 255), width=1)
    if major:
        d.text((X + 2, 2), str(x), fill=(255, 0, 255))
for y in range((y0 // step + 1) * step, y1, step):
    Y = (y - y0) * zoom
    major = y % (2 * step) == 0
    d.line([(0, Y), (c.size[0], Y)], fill=(255, 0, 255) if major else (0, 200, 255), width=1)
    if major:
        d.text((2, Y + 2), str(y), fill=(255, 0, 255))
c.save(out)
print(out, c.size)
