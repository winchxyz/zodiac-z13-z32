"""tools/mapgeometry_geo.py - geodesy helpers for the mapgeometry task.

WGS84 Vincenty inverse/direct (accurate to well under 1 mm for these distances),
a local tangent-plane projection, and least-squares similarity / affine fits
for georeferencing a map scan.

Conventions:
  bearings are degrees clockwise from TRUE north, in [0, 360);
  distances are statute miles unless a name says otherwise (1 mi = 1609.344 m).

Self-test: python tools/mapgeometry_geo.py
"""
import math

A_WGS84 = 6378137.0
F_WGS84 = 1 / 298.257223563
B_WGS84 = A_WGS84 * (1 - F_WGS84)
M_PER_MI = 1609.344


def inverse(lat1, lon1, lat2, lon2):
    """Vincenty inverse. Returns (distance_miles, initial_bearing_deg, final_bearing_deg)."""
    a, b, f = A_WGS84, B_WGS84, F_WGS84
    if abs(lat1 - lat2) < 1e-12 and abs(lon1 - lon2) < 1e-12:
        return 0.0, 0.0, 0.0
    L = math.radians(lon2 - lon1)
    U1 = math.atan((1 - f) * math.tan(math.radians(lat1)))
    U2 = math.atan((1 - f) * math.tan(math.radians(lat2)))
    sinU1, cosU1 = math.sin(U1), math.cos(U1)
    sinU2, cosU2 = math.sin(U2), math.cos(U2)
    lam = L
    for _ in range(200):
        sinlam, coslam = math.sin(lam), math.cos(lam)
        sinsig = math.hypot(cosU2 * sinlam, cosU1 * sinU2 - sinU1 * cosU2 * coslam)
        cossig = sinU1 * sinU2 + cosU1 * cosU2 * coslam
        sig = math.atan2(sinsig, cossig)
        sinalpha = cosU1 * cosU2 * sinlam / sinsig
        cos2alpha = 1 - sinalpha ** 2
        cos2sigm = cossig - 2 * sinU1 * sinU2 / cos2alpha if cos2alpha != 0 else 0.0
        C = f / 16 * cos2alpha * (4 + f * (4 - 3 * cos2alpha))
        lamp = lam
        lam = L + (1 - C) * f * sinalpha * (sig + C * sinsig * (cos2sigm + C * cossig * (-1 + 2 * cos2sigm ** 2)))
        if abs(lam - lamp) < 1e-13:
            break
    u2 = cos2alpha * (a * a - b * b) / (b * b)
    Acoef = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
    Bcoef = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
    dsig = Bcoef * sinsig * (cos2sigm + Bcoef / 4 * (cossig * (-1 + 2 * cos2sigm ** 2)
                                                     - Bcoef / 6 * cos2sigm * (-3 + 4 * sinsig ** 2) * (-3 + 4 * cos2sigm ** 2)))
    s = b * Acoef * (sig - dsig)
    az1 = math.degrees(math.atan2(cosU2 * math.sin(lam), cosU1 * sinU2 - sinU1 * cosU2 * math.cos(lam))) % 360
    az2 = math.degrees(math.atan2(cosU1 * math.sin(lam), -sinU1 * cosU2 + cosU1 * sinU2 * math.cos(lam))) % 360
    return s / M_PER_MI, az1, az2


def direct(lat1, lon1, bearing_deg, dist_mi):
    """Vincenty direct. Returns (lat2, lon2)."""
    a, b, f = A_WGS84, B_WGS84, F_WGS84
    s = dist_mi * M_PER_MI
    alpha1 = math.radians(bearing_deg)
    sina1, cosa1 = math.sin(alpha1), math.cos(alpha1)
    tanU1 = (1 - f) * math.tan(math.radians(lat1))
    cosU1 = 1 / math.sqrt(1 + tanU1 ** 2)
    sinU1 = tanU1 * cosU1
    sig1 = math.atan2(tanU1, cosa1)
    sinalpha = cosU1 * sina1
    cos2alpha = 1 - sinalpha ** 2
    u2 = cos2alpha * (a * a - b * b) / (b * b)
    Acoef = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
    Bcoef = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
    sig = s / (b * Acoef)
    for _ in range(200):
        cos2sigm = math.cos(2 * sig1 + sig)
        sinsig, cossig = math.sin(sig), math.cos(sig)
        dsig = Bcoef * sinsig * (cos2sigm + Bcoef / 4 * (cossig * (-1 + 2 * cos2sigm ** 2)
                                                         - Bcoef / 6 * cos2sigm * (-3 + 4 * sinsig ** 2) * (-3 + 4 * cos2sigm ** 2)))
        sigp = sig
        sig = s / (b * Acoef) + dsig
        if abs(sig - sigp) < 1e-13:
            break
    sinsig, cossig = math.sin(sig), math.cos(sig)
    cos2sigm = math.cos(2 * sig1 + sig)
    tmp = sinU1 * sinsig - cosU1 * cossig * cosa1
    lat2 = math.atan2(sinU1 * cossig + cosU1 * sinsig * cosa1, (1 - f) * math.hypot(sinalpha, tmp))
    lam = math.atan2(sinsig * sina1, cosU1 * cossig - sinU1 * sinsig * cosa1)
    C = f / 16 * cos2alpha * (4 + f * (4 - 3 * cos2alpha))
    L = lam - (1 - C) * f * sinalpha * (sig + C * sinsig * (cos2sigm + C * cossig * (-1 + 2 * cos2sigm ** 2)))
    return math.degrees(lat2), lon1 + math.degrees(L)


def enu(lat0, lon0, lat, lon):
    """Local east/north offsets in miles from (lat0, lon0), via the geodesic (azimuthal equidistant)."""
    d, az, _ = inverse(lat0, lon0, lat, lon)
    r = math.radians(az)
    return d * math.sin(r), d * math.cos(r)


def enu_inv(lat0, lon0, e, n):
    d = math.hypot(e, n)
    if d == 0:
        return lat0, lon0
    az = math.degrees(math.atan2(e, n)) % 360
    return direct(lat0, lon0, az, d)


def angdiff(a, b):
    """Signed smallest difference a - b in degrees, in (-180, 180]."""
    d = (a - b) % 360
    return d - 360 if d > 180 else d


def fit_similarity(src, dst):
    """Least-squares similarity dst ~ s*R(theta)*src + t, both lists of (x, y).
    Returns dict(scale, theta_deg, tx, ty, rms, residuals)."""
    n = len(src)
    mx = sum(p[0] for p in src) / n
    my = sum(p[1] for p in src) / n
    ux = sum(p[0] for p in dst) / n
    uy = sum(p[1] for p in dst) / n
    sxx = sxy = syx = syy = 0.0
    var = 0.0
    for (x, y), (u, v) in zip(src, dst):
        x -= mx; y -= my; u -= ux; v -= uy
        sxx += x * u + y * v      # a-term
        sxy += x * v - y * u      # b-term
        var += x * x + y * y
    a = sxx / var
    b = sxy / var
    s = math.hypot(a, b)
    th = math.atan2(b, a)
    tx = ux - (a * mx - b * my)
    ty = uy - (b * mx + a * my)
    res = []
    for (x, y), (u, v) in zip(src, dst):
        pu = a * x - b * y + tx
        pv = b * x + a * y + ty
        res.append((pu - u, pv - v))
    rms = math.sqrt(sum(r[0] ** 2 + r[1] ** 2 for r in res) / n)
    return dict(scale=s, theta_deg=math.degrees(th), a=a, b=b, tx=tx, ty=ty, rms=rms, residuals=res)


def apply_similarity(fit, x, y):
    return fit['a'] * x - fit['b'] * y + fit['tx'], fit['b'] * x + fit['a'] * y + fit['ty']


def invert_similarity(fit, u, v):
    a, b = fit['a'], fit['b']
    det = a * a + b * b
    du, dv = u - fit['tx'], v - fit['ty']
    return (a * du + b * dv) / det, (-b * du + a * dv) / det


def fit_affine(src, dst):
    """Least-squares affine dst = M src + t (6 parameters). Returns dict(M, t, rms, residuals)."""
    import numpy as np
    S = np.array([[x, y, 1.0] for x, y in src])
    D = np.array(dst, dtype=float)
    coef, *_ = np.linalg.lstsq(S, D, rcond=None)
    pred = S @ coef
    res = pred - D
    rms = float(np.sqrt((res ** 2).sum(axis=1).mean()))
    M = coef[:2, :].T
    t = coef[2, :]
    # decompose M = R(theta) * [[sx, k], [0, sy]] (QR-style)
    sx = math.hypot(M[0, 0], M[1, 0])
    th = math.degrees(math.atan2(M[1, 0], M[0, 0]))
    det = M[0, 0] * M[1, 1] - M[0, 1] * M[1, 0]
    sy = det / sx
    return dict(M=M.tolist(), t=t.tolist(), rms=rms, residuals=res.tolist(), sx=sx, sy=sy, theta_deg=th)


def _selftest():
    # Flinders Peak -> Buninyong (Vincenty's classic test, via Geoscience Australia):
    # distance 54972.271 m, azimuth 306 52 05.37
    lat1 = -(37 + 57 / 60 + 3.72030 / 3600)
    lon1 = 144 + 25 / 60 + 29.52440 / 3600
    lat2 = -(37 + 39 / 60 + 10.15610 / 3600)
    lon2 = 143 + 55 / 60 + 35.38390 / 3600
    d, az1, _ = inverse(lat1, lon1, lat2, lon2)
    assert abs(d * M_PER_MI - 54972.271) < 0.01, d * M_PER_MI
    assert abs(az1 - (306 + 52 / 60 + 5.37 / 3600)) < 1e-4, az1
    la, lo = direct(lat1, lon1, az1, d)
    assert abs(la - lat2) < 1e-9 and abs(lo - lon2) < 1e-9
    # round trip at the Mt Diablo summit
    for brg in (0, 57.2958, 123.4, 246.06, 359):
        la, lo = direct(37.881697781, -121.914154997, brg, 32.0)
        d2, b2, _ = inverse(37.881697781, -121.914154997, la, lo)
        assert abs(d2 - 32.0) < 1e-9 and abs(angdiff(b2, brg)) < 1e-9
    # similarity fit recovers a known transform
    src = [(0, 0), (10, 0), (0, 10), (7, 3), (-4, 9)]
    th = math.radians(4.27)
    dst = [(17.8 * (math.cos(th) * x - math.sin(th) * y) + 5, 17.8 * (math.sin(th) * x + math.cos(th) * y) - 2) for x, y in src]
    f = fit_similarity(src, dst)
    assert abs(f['scale'] - 17.8) < 1e-9 and abs(f['theta_deg'] - 4.27) < 1e-9 and f['rms'] < 1e-9
    print('mapgeometry_geo selftest ok')


if __name__ == '__main__':
    _selftest()
