"""
Counts the fruit visible in a plant photo with classical OpenCV: colour segmentation, clean-up, then splitting of touching fruit.

How it works, in order:
  1. The photo is shrunk to at most 1280 px on its longest side and checked for blur and bad light.
  2. Pixels in the colours of the crop's fruit (red, orange, yellow, purple, light green) are picked out in HSV space.
  3. Small specks are removed and highlights on shiny skins are filled in.
  4. Each connected patch is one fruit, or several touching ones. The size of a single fruit is taken from the clean, round patches,
     and a patch that is clearly larger and not round is split into that many fruit (k-means on its pixels).
  5. A confidence is worked out from the photo quality and how much splitting was needed.

What it cannot do, and says so: it cannot see fruit hidden behind leaves or other fruit, and it cannot separate green fruit from green
leaves reliably. Those photos come back with `confidence: low`, and the server then reports the check as "inconclusive" instead of
claiming a match or a mismatch.
"""
from __future__ import annotations

import base64
import math

import cv2
import numpy as np

VERSION = 'opencv-hsv-1'
MAX_SIDE = 1280

# OpenCV HSV: H 0-179, S 0-255, V 0-255. Red wraps around the hue circle, so it has two ranges.
COLORS: dict[str, list[tuple[tuple[int, int, int], tuple[int, int, int]]]] = {
    'red': [((0, 125, 70), (9, 255, 255)), ((170, 125, 70), (179, 255, 255))],
    # more saturated than dry grass, soil and yellowing leaves, which share these hues
    'orange': [((10, 150, 130), (22, 255, 255))],
    'yellow': [((23, 140, 150), (34, 255, 255))],
    'purple': [((125, 50, 20), (160, 255, 210))],
    # green fruit is only told from leaves by being lighter: unreliable, so the caller marks the contrast as low
    'green': [((36, 60, 150), (85, 255, 255))],
}
SHAPES = ('round', 'elongated')


def decode(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    try:
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except cv2.error as e:  # more pixels than the limit, or damaged beyond reading
        raise ValueError('The photo is too large or could not be read. Take it again at a smaller size.') from e
    if img is None or img.size == 0:
        raise ValueError('The photo could not be read.')
    h, w = img.shape[:2]
    if h < 120 or w < 120:
        raise ValueError('The photo is too small to count fruit. Take it closer, at full size.')
    scale = MAX_SIDE / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def quality(img: np.ndarray) -> tuple[list[str], dict]:
    """Warnings a person can act on, and the numbers behind them."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    bright = float(gray.mean())
    warnings = []
    if sharp < 40:  # real photos: the median is about 540 and 1 in 25 falls under 60
        warnings.append('blurry')
    if bright < 45:
        warnings.append('too_dark')
    elif bright > 225:
        warnings.append('too_bright')
    return warnings, {'sharpness': round(sharp, 1), 'brightness': round(bright, 1)}


def fruit_mask(img: np.ndarray, colors: list[str]) -> np.ndarray:
    hsv = cv2.cvtColor(cv2.GaussianBlur(img, (5, 5), 0), cv2.COLOR_BGR2HSV)
    mask = np.zeros(hsv.shape[:2], np.uint8)
    for name in colors:
        for lo, hi in COLORS[name]:
            mask |= cv2.inRange(hsv, np.array(lo, np.uint8), np.array(hi, np.uint8))
    k = max(3, int(round(min(mask.shape) / 200)))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    big = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1))  # fills the white highlight on a shiny skin
    return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, big)


def _patches(mask: np.ndarray):
    """Connected patches big enough to be fruit: (area, solidity, aspect, pixel coordinates, centroid)."""
    h, w = mask.shape
    min_area = max(60, int(0.0001 * h * w))
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask, connectivity=8)
    out = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area:
            continue
        comp = (labels == i).astype(np.uint8)
        contours, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        cnt = max(contours, key=cv2.contourArea)
        hull_area = cv2.contourArea(cv2.convexHull(cnt)) or 1.0
        perimeter = cv2.arcLength(cnt, True) or 1.0
        bw, bh = int(stats[i, cv2.CC_STAT_WIDTH]), int(stats[i, cv2.CC_STAT_HEIGHT])
        (_, _), (rw, rh), _ = cv2.minAreaRect(cnt)  # the tightest rotated box: two fruit side by side are long whichever way they lie
        out.append({
            'area': area, 'solidity': float(cv2.contourArea(cnt) / hull_area), 'aspect': max(rw, rh) / max(1.0, min(rw, rh)),
            'length': float(max(rw, rh)), 'width': float(min(rw, rh)),
            'circ': float(4 * math.pi * cv2.contourArea(cnt) / (perimeter * perimeter)),  # 1.0 for a circle; ragged edges, lesions and dead leaf score low
            'centroid': (float(cents[i][0]), float(cents[i][1])), 'label': i, 'bbox': (int(stats[i, cv2.CC_STAT_LEFT]), int(stats[i, cv2.CC_STAT_TOP]), bw, bh),
        })
    return out, labels


def _split(labels: np.ndarray, label: int, k: int) -> list[tuple[float, float]]:
    ys, xs = np.nonzero(labels == label)
    pts = np.column_stack([xs, ys]).astype(np.float32)
    if len(pts) < k:
        return [(float(xs.mean()), float(ys.mean()))]
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 15, 0.5)
    _, _, centers = cv2.kmeans(pts, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    return [(float(c[0]), float(c[1])) for c in centers]


def count_fruits(data: bytes, colors: list[str] | None = None, shape: str = 'round', contrast: str = 'high') -> dict:
    colors = [c for c in (colors or ['red']) if c in COLORS] or ['red']
    shape = shape if shape in SHAPES else 'round'
    img = decode(data)
    warnings, numbers = quality(img)
    mask = fruit_mask(img, colors)
    patches, labels = _patches(mask)

    detections: list[dict] = []
    split_fruit = 0
    single = 0.0
    if patches:
        clean = [p['area'] for p in patches if p['solidity'] >= 0.9 and p['aspect'] <= 1.35 and p['circ'] >= 0.7]
        pool = clean if len(clean) >= 3 else [p['area'] for p in patches]
        single = float(np.median(pool))
        for p in patches:
            ratio = p['area'] / single
            if ratio < 0.3:
                continue  # a speck or a sliver of fruit
            if shape == 'round' and ratio >= 1.5 and p['circ'] < 0.5:
                continue  # a big ragged region (dry leaves, soil, a wall) is not a clump of fruit: fruit clumps are made of round lobes
            k = 1
            if shape == 'round':
                disc = math.pi * (p['width'] / 2) ** 2  # the area of ONE fruit as wide as this patch
                if p['aspect'] >= 1.5 and p['area'] / max(1.0, disc) >= 1.6:
                    # a row of fruit touching: as many fruit as fit along the patch, judged from its own width (fruit differ a lot in size)
                    k = min(10, max(2, int(round((p['length'] - p['width']) / (0.9 * p['width']))) + 1))
                elif ratio >= 2.4 or (ratio >= 1.5 and p['solidity'] < 0.9):
                    k = min(10, max(2, int(round(ratio))))  # a lump of fruit: judged from the size of a typical single fruit
            if k == 1:
                # one fruit is a smooth, compact shape. Yellowing leaves, brown lesions and dried edges match fruit colours but are ragged.
                if shape == 'round' and (p['circ'] < 0.62 or p['solidity'] < 0.85):
                    continue
                if p['area'] > 0.35 * mask.shape[0] * mask.shape[1]:
                    continue  # bigger than a third of the photo: a leaf or the background, not one fruit
                r = math.sqrt(p['area'] / math.pi)
                detections.append({'x': round(p['centroid'][0], 1), 'y': round(p['centroid'][1], 1), 'r': round(r, 1)})
            else:
                r = math.sqrt(single / math.pi)
                for cx, cy in _split(labels, p['label'], k):
                    detections.append({'x': round(cx, 1), 'y': round(cy, 1), 'r': round(r, 1)})
                split_fruit += k

    count = len(detections)
    coverage = float(np.count_nonzero(mask)) / mask.size
    if coverage > 0.35:
        warnings.append('background_matches_fruit')  # more than a third of the photo has the fruit colour: dry leaves, soil or a wall
    score = 1.0
    if 'background_matches_fruit' in warnings:
        score -= 0.35
    if 'blurry' in warnings:
        score -= 0.3
    if 'too_dark' in warnings or 'too_bright' in warnings:
        score -= 0.15
    if contrast == 'low' or colors == ['green']:
        score = min(score - 0.5, 0.45)  # fruit the colour of the leaves: never better than low, whatever else is true of the photo
    if count:
        share = split_fruit / count
        score -= 0.15 if share > 0.4 else 0.05 if share > 0.2 else 0
        areas = np.array([p['area'] for p in patches if p['area'] / single >= 0.3 and p['solidity'] >= 0.9 and p['aspect'] <= 1.35], dtype=float) if patches else np.array([])
        if len(areas) >= 3 and areas.std() / max(1.0, areas.mean()) > 0.6:
            score -= 0.2
        if count > 60:
            score -= 0.1
    else:
        score = min(score, 0.3)
    label = 'high' if score >= 0.75 else 'medium' if score >= 0.5 else 'low'

    return {
        'count': count,
        'confidence': label,
        'score': round(max(0.0, score), 2),
        'warnings': warnings,
        'detections': detections,
        'single_fruit_area_px': round(single, 1),
        'quality': {**numbers, 'fruit_colour_share': round(coverage, 3)},
        'image_size': [int(img.shape[1]), int(img.shape[0])],
        'colors': colors,
        'method': VERSION,
        'annotated_jpeg_b64': annotate(img, detections),
    }


def annotate(img: np.ndarray, detections: list[dict]) -> str:
    """The photo with a ring and a number on every fruit that was counted, as base64 JPEG, so the person can see what was counted."""
    out = img.copy()
    thick = max(2, int(round(min(out.shape[:2]) / 300)))
    for i, d in enumerate(detections, 1):
        c = (int(d['x']), int(d['y']))
        r = max(6, int(d['r']))
        cv2.circle(out, c, r + 1, (255, 255, 255), thick + 2, cv2.LINE_AA)
        cv2.circle(out, c, r + 1, (30, 30, 30), 1, cv2.LINE_AA)
        cv2.putText(out, str(i), (c[0] - r // 2, c[1] + r // 4), cv2.FONT_HERSHEY_SIMPLEX, max(0.4, r / 40), (255, 255, 255), thick, cv2.LINE_AA)
    bar = f'Counted: {len(detections)}'
    cv2.rectangle(out, (0, 0), (16 + 14 * len(bar), 34), (0, 0, 0), -1)
    cv2.putText(out, bar, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
    ok, buf = cv2.imencode('.jpg', out, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
    return base64.b64encode(buf.tobytes()).decode('ascii') if ok else ''
