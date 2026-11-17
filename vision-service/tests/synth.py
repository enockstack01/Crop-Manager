"""Draws plant-like test photos with a KNOWN number of fruit: textured green leaves, round shaded fruit with a highlight, JPEG compression."""
from __future__ import annotations

import cv2
import numpy as np

FRUIT_BGR = {
    'red': (35, 40, 205),
    'orange': (30, 130, 240),
    'yellow': (40, 215, 245),
    'purple': (95, 40, 80),
    'green': (120, 215, 170),
}


def leaves(h: int, w: int, rng: np.random.Generator) -> np.ndarray:
    base = np.zeros((h, w, 3), np.uint8)
    base[:] = (45, 105, 55)
    noise = rng.normal(0, 18, (h, w, 1)).astype(np.float32)
    noise = cv2.GaussianBlur(noise, (0, 0), 3).reshape(h, w, 1)
    img = np.clip(base.astype(np.float32) + noise * 2.2, 0, 255).astype(np.uint8)
    for _ in range(40):  # darker and lighter leaf shapes
        c = (int(rng.integers(0, w)), int(rng.integers(0, h)))
        axes = (int(rng.integers(40, 120)), int(rng.integers(15, 45)))
        col = tuple(int(x) for x in (np.array((40, 95, 45)) + rng.integers(-18, 25, 3)).clip(0, 255))
        cv2.ellipse(img, c, axes, float(rng.integers(0, 180)), 0, 360, col, -1, cv2.LINE_AA)
    return cv2.GaussianBlur(img, (3, 3), 0)


def fruit(img: np.ndarray, cx: int, cy: int, r: int, bgr: tuple[int, int, int]) -> None:
    layer = img.copy()
    cv2.circle(layer, (cx, cy), r, bgr, -1, cv2.LINE_AA)
    shade = tuple(int(c * 0.72) for c in bgr)
    cv2.circle(layer, (cx + r // 4, cy + r // 4), int(r * 0.7), shade, -1, cv2.LINE_AA)  # darker lower right
    cv2.circle(layer, (cx - r // 3, cy - r // 3), max(2, r // 5), (245, 245, 245), -1, cv2.LINE_AA)  # shine
    mask = np.zeros(img.shape[:2], np.uint8)
    cv2.circle(mask, (cx, cy), r, 255, -1, cv2.LINE_AA)
    mask3 = cv2.merge([mask] * 3) > 0
    img[mask3] = layer[mask3]


def photo(n: int, color: str = 'red', size=(960, 1280), seed: int = 1, radius=(17, 26), touching_pairs: int = 0, gap: float = 2.5, quality: int = 88, blur: int = 0) -> bytes:
    """n fruit that do not touch (centres at least `gap` radii apart), plus `touching_pairs` of those drawn touching their neighbour."""
    rng = np.random.default_rng(seed)
    h, w = size
    img = leaves(h, w, rng)
    placed: list[tuple[int, int, int]] = []
    tries = 0
    singles = n - 2 * touching_pairs
    while len(placed) < singles and tries < 20000:
        tries += 1
        r = int(rng.integers(*radius))
        x, y = int(rng.integers(r + 5, w - r - 5)), int(rng.integers(r + 5, h - r - 5))
        if all((x - px) ** 2 + (y - py) ** 2 > (gap * max(r, pr)) ** 2 for px, py, pr in placed):
            placed.append((x, y, r))
    pairs = 0
    while pairs < touching_pairs and tries < 40000:
        tries += 1
        r = int(rng.integers(*radius))
        x, y = int(rng.integers(3 * r, w - 3 * r)), int(rng.integers(3 * r, h - 3 * r))
        ang = float(rng.uniform(0, np.pi))
        x2, y2 = int(x + 1.75 * r * np.cos(ang)), int(y + 1.75 * r * np.sin(ang))
        if all((x - px) ** 2 + (y - py) ** 2 > (gap * max(r, pr)) ** 2 and (x2 - px) ** 2 + (y2 - py) ** 2 > (gap * max(r, pr)) ** 2 for px, py, pr in placed):
            placed += [(x, y, r), (x2, y2, r)]
            pairs += 1
    for x, y, r in placed:
        fruit(img, x, y, r, FRUIT_BGR[color])
    if blur:
        img = cv2.GaussianBlur(img, (0, 0), blur)
    else:  # camera grain: real photos are never perfectly smooth
        img = np.clip(img.astype(np.float32) + rng.normal(0, 7, img.shape), 0, 255).astype(np.uint8)
    ok, buf = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    assert ok
    return buf.tobytes()
