"""
Counting a collage cell by cell.

The server joins the photos of one plant into a grid, one photo per cell. Counting the whole grid at once would shrink every fruit (the
counter works at about 1280 pixels on the longest side), so a collage of nine photos loses most of its fruit. Instead each cell is cut out and
counted at its own full resolution, then the answers are added up: the count is the sum, every fruit keeps its place on the collage, and
the marked picture is the whole collage with every counted fruit drawn on it. A fruit cannot be split between two cells (each cell is one
photo), so nothing is counted twice by this step.
"""
from __future__ import annotations

import cv2
import numpy as np

from .counter import annotate

MAX_OUT = 2560  # longest side of the marked collage that is sent back
MAX_CELLS = 12  # the most photos of one plant (the server refuses more)


def _average(dicts: list[dict]) -> dict:
    out: dict = {}
    for k in dicts[0]:
        vals = [d[k] for d in dicts if isinstance(d.get(k), (int, float))]
        out[k] = round(sum(vals) / len(vals), 1) if vals else dicts[0][k]
    return out


def count_cells(data: bytes, count_one, cols: int, rows: int, cell_w: int, cell_h: int, n: int) -> dict:
    """`count_one(jpeg_bytes) -> result` counts one photo (the trained model or the colour method). Returns one result for the whole collage."""
    if not (1 <= n <= min(MAX_CELLS, cols * rows)) or not (1 <= cols <= 6 and 1 <= rows <= 6) or min(cell_w, cell_h) < 1:
        raise ValueError('The collage grid is not valid.')
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None or img.size == 0:
        raise ValueError('The photo could not be read.')
    H, W = img.shape[:2]
    fx, fy = W / (cols * cell_w), H / (rows * cell_h)  # the collage may have been re-encoded at another size
    if not (0.2 <= fx <= 5 and abs(fx - fy) < 0.02):
        raise ValueError('The collage does not match its grid.')
    tw, th = int(round(cell_w * fx)), int(round(cell_h * fy))

    detections: list[dict] = []
    results: list[dict] = []
    per_cell: list[dict] = []
    for i in range(n):
        left, top = int(round((i % cols) * cell_w * fx)), int(round((i // cols) * cell_h * fy))
        tile = img[top:top + th, left:left + tw]
        ok, buf = cv2.imencode('.jpg', tile, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        if not ok:
            raise ValueError('The photo could not be read.')
        r = count_one(buf.tobytes())
        results.append(r)
        k = tw / max(1, r['image_size'][0])  # the counter may have scaled the tile down: bring its positions back to the tile
        for d in r['detections']:
            e = {**d, 'x': round(d['x'] * k + left, 1), 'y': round(d['y'] * k + top, 1), 'r': round(d['r'] * k, 1), 'cell': i + 1}
            detections.append(e)
        per_cell.append({'cell': i + 1, 'count': r['count']})

    first = results[0]
    counted = [r for r in results if r['count']]
    score = float(np.mean([r['score'] for r in counted])) if counted else float(min(r['score'] for r in results))
    is_yolo = str(first.get('method', '')).startswith('yolo')
    label = 'high' if score >= (0.65 if is_yolo else 0.75) else 'medium' if score >= (0.45 if is_yolo else 0.5) else 'low'
    warnings = list(dict.fromkeys(w for r in results for w in r['warnings']))

    s = min(1.0, MAX_OUT / max(W, H))
    out = cv2.resize(img, (int(W * s), int(H * s)), interpolation=cv2.INTER_AREA) if s < 1 else img
    shown = [{**d, 'x': round(d['x'] * s, 1), 'y': round(d['y'] * s, 1), 'r': round(d['r'] * s, 1)} for d in detections]
    res = {
        'count': len(detections), 'confidence': label, 'score': round(max(0.0, score), 2), 'warnings': warnings, 'detections': shown,
        'quality': _average([r['quality'] for r in results]), 'image_size': [int(out.shape[1]), int(out.shape[0])],
        'colors': first.get('colors', []), 'method': first.get('method'), 'cells': per_cell,
        'annotated_jpeg_b64': annotate(out, shown),
    }
    for extra in ('crop_class', 'single_fruit_area_px'):
        if extra in first:
            res[extra] = first[extra]
    return res
