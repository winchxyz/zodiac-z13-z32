"""results/mapgeometry/review/axes_check.py - reviewer's independent fit of the drawn 0-arm and 3-arm.

Different from tools/mapgeometry_core.drawn_axes(): a "blueness" score B - (R + G) / 2 with
weighted centroids per row / column, every row between the arrowhead and the 6 numeral
(segments listed explicitly), and a robust (iteratively trimmed) line fit.
Prints the angle under several mask thresholds and row selections.
"""
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
IMG = os.path.join(ROOT, 'data', 'images', 'z32_map_1970-06-26_large_zkf.jpg')

im = np.asarray(Image.open(IMG).convert('RGB')).astype(float)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
blueness = B - (R + G) / 2


def trimmed_fit(t, s, keep=0.8, iters=5):
    t, s = np.asarray(t, float), np.asarray(s, float)
    m = np.ones(len(t), bool)
    for _ in range(iters):
        a, b = np.polyfit(t[m], s[m], 1)
        r = np.abs(s - (a * t + b))
        thr = np.quantile(r[m], keep)
        m = r <= thr
    a, b = np.polyfit(t[m], s[m], 1)
    return a, b, int(m.sum())


def arm_rows(rows, x0, x1, thr):
    T, S = [], []
    for y in rows:
        w = blueness[y, x0:x1] - thr
        w[w < 0] = 0
        if w.sum() <= 0:
            continue
        idx = np.nonzero(w)[0]
        if len(idx) < 2 or len(idx) > 14 or idx.max() - idx.min() > 16:
            continue
        T.append(y)
        S.append((w * np.arange(x0, x1)).sum() / w.sum())
    return T, S


def arm_cols(cols, y0, y1, thr):
    T, S = [], []
    for x in cols:
        w = blueness[y0:y1, x] - thr
        w[w < 0] = 0
        if w.sum() <= 0:
            continue
        idx = np.nonzero(w)[0]
        if len(idx) < 2 or len(idx) > 14 or idx.max() - idx.min() > 16:
            continue
        T.append(x)
        S.append((w * np.arange(y0, y1)).sum() / w.sum())
    return T, S


# print a coarse profile so the reader can see where the arm is
for y in range(240, 405, 15):
    row = blueness[y, 695:740]
    print('y=%3d  argmax x=%d  max %.0f' % (y, 695 + int(np.argmax(row)), row.max()))

sel = {
    'all rows 262-398 except circle crossings/centre': [y for y in range(262, 399) if not (283 <= y <= 290 or 318 <= y <= 328 or 357 <= y <= 366)],
    'outer only (above and below the circle)': [y for y in range(262, 283)] + [y for y in range(367, 399)],
    'inside the circle only': [y for y in range(291, 318)] + [y for y in range(329, 357)],
    'attacker segments (278-288, 299-315, 329-354, 371-399)': list(range(278, 288)) + list(range(299, 315)) + list(range(329, 354)) + list(range(371, 399)),
}
for thr in (30, 45, 60):
    for name, rows in sel.items():
        T, S = arm_rows(rows, 700, 735, thr)
        if len(T) < 8:
            print('thr %d %-55s too few rows' % (thr, name))
            continue
        a, b, n = trimmed_fit(T, S)
        print('thr %d %-55s 0-arm %.2f deg cw of image-up (n=%d, x at y=262: %.1f, at y=398: %.1f)' % (
            thr, name, math.degrees(math.atan(-a)), n, a * 262 + b, a * 398 + b))
csel = {
    'all cols 640-785 except circle/centre': [x for x in range(640, 786) if not (674 <= x <= 690 or 709 <= x <= 723 or 742 <= x <= 755)],
    'attacker segments': list(range(640, 673)) + list(range(692, 709)) + list(range(724, 741)) + list(range(756, 781)),
}
for thr in (30, 45, 60):
    for name, cols in csel.items():
        T, S = arm_cols(cols, 310, 336, thr)
        if len(T) < 8:
            continue
        a, b, n = trimmed_fit(T, S)
        print('thr %d %-55s 3-arm %.2f deg cw of image-right (n=%d)' % (thr, name, math.degrees(math.atan(a)), n))
# right-hand neat line verticality (image-up = map-up?)
for x0 in (850,):
    pass
