# Pure Python fallback when Cython-built functional is not available.
# Original logic from openpifpaf functional.pyx.

import numpy as np


def scalar_value_clipped(field, x, y):
    """Sample field at (x, y) with coordinates clipped to valid range."""
    x = np.clip(x, 0.0, field.shape[1] - 1)
    y = np.clip(y, 0.0, field.shape[0] - 1)
    return float(field[int(y), int(x)])


def scalar_values(field, x, y, default=-1.0):
    """Sample field at (x[i], y[i]) for each i; use default when out of bounds. Returns 1D array."""
    x = np.asarray(x, dtype=np.float32)
    y = np.asarray(y, dtype=np.float32)
    n = x.shape[0]
    values = np.full((n,), float(default), dtype=np.float32)
    maxx = float(field.shape[1] - 1)
    maxy = float(field.shape[0] - 1)
    for i in range(n):
        if 0.0 <= x[i] <= maxx and 0.0 <= y[i] <= maxy:
            values[i] = field[int(y[i]), int(x[i])]
    return values


def scalar_nonzero_clipped_with_reduction(field, x, y, r):
    """Sample uint8 field at (x/r, y/r) clipped to bounds. Returns 0 or 1."""
    x = np.clip(x / r, 0.0, field.shape[1] - 1)
    y = np.clip(y / r, 0.0, field.shape[0] - 1)
    return int(field[int(y), int(x)])


def scalar_square_add_gauss_with_max(field, x, y, sigma, v, truncate=2.0, max_value=1.0):
    """Add Gaussian-weighted v at (x, y) with sigma; then cap field at max_value. In-place."""
    x = np.asarray(x, dtype=np.float64).ravel()
    y = np.asarray(y, dtype=np.float64).ravel()
    sigma = np.asarray(sigma, dtype=np.float64).ravel()
    v = np.asarray(v, dtype=np.float64).ravel()
    H, W = field.shape
    for i in range(len(x)):
        xi, yi, si, vi = float(x[i]), float(y[i]), float(sigma[i]), float(v[i])
        half = int(np.ceil(truncate * si))
        x0 = max(0, int(xi) - half)
        x1 = min(W, int(xi) + half + 1)
        y0 = max(0, int(yi) - half)
        y1 = min(H, int(yi) + half + 1)
        if x0 >= x1 or y0 >= y1:
            continue
        yy, xx = np.ogrid[y0:y1, x0:x1]
        g = vi * np.exp(-0.5 * ((xx - xi) ** 2 + (yy - yi) ** 2) / (si ** 2 + 1e-8))
        field[y0:y1, x0:x1] = np.minimum(field[y0:y1, x0:x1] + g, max_value)


def caf_center_s(caf_field, x, y, sigma):
    """Filter CAF columns where (caf_field[1,i], caf_field[2,i]) is within (x±sigma, y±sigma)."""
    caf_field = np.asarray(caf_field, dtype=np.float32)
    x, y, sigma = float(x), float(y), float(sigma)
    out = []
    for i in range(caf_field.shape[1]):
        if caf_field[1, i] < x - sigma or caf_field[1, i] > x + sigma:
            continue
        if caf_field[2, i] < y - sigma or caf_field[2, i] > y + sigma:
            continue
        out.append(caf_field[:, i])
    if not out:
        return np.empty((caf_field.shape[0], 0), dtype=np.float32)
    return np.stack(out, axis=1)


def grow_connection_blend(caf_field, x, y, xy_scale, only_max):
    """Blend or pick best connection from CAF field near (x, y). Returns (x, y, scale, score)."""
    caf_field = np.asarray(caf_field, dtype=np.float32)
    x, y, xy_scale = float(x), float(y), float(xy_scale)
    sigma_filter = 2.0 * xy_scale
    sigma2 = 0.25 * xy_scale * xy_scale
    score_1, score_2 = 0.0, 0.0
    score_1_i, score_2_i = 0, 0
    for i in range(caf_field.shape[1]):
        if caf_field[1, i] < x - sigma_filter or caf_field[1, i] > x + sigma_filter:
            continue
        if caf_field[2, i] < y - sigma_filter or caf_field[2, i] > y + sigma_filter:
            continue
        d2 = (caf_field[1, i] - x) ** 2 + (caf_field[2, i] - y) ** 2
        score = np.exp(-0.5 * d2 / sigma2) * caf_field[0, i]
        if score > score_1:
            score_2_i, score_2 = score_1_i, score_1
            score_1_i, score_1 = i, score
        elif score > score_2:
            score_2_i, score_2 = i, score
    if score_1 == 0.0:
        return np.array([0.0, 0.0, 0.0, 0.0], dtype=np.float32)
    entry_1 = caf_field[5:, score_1_i]
    if only_max:
        return np.array([entry_1[0], entry_1[1], entry_1[3], score_1], dtype=np.float32)
    entry_2 = caf_field[5:, score_2_i]
    blend = score_1 + score_2
    if blend <= 0:
        return np.array([entry_1[0], entry_1[1], entry_1[3], score_1], dtype=np.float32)
    w1, w2 = score_1 / blend, score_2 / blend
    return np.array([
        w1 * entry_1[0] + w2 * entry_2[0],
        w1 * entry_1[1] + w2 * entry_2[1],
        w1 * entry_1[3] + w2 * entry_2[3],
        score_1,
    ], dtype=np.float32)
