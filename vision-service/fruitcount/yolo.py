"""
Counts fruit with a trained YOLO11 detector (one box per fruit). This is the method that can tell green fruit from green leaves,
because it was trained on photos of green fruit on plants; the colour method in counter.py cannot.

It is optional: it is used only when a weights file exists (FRUIT_YOLO_WEIGHTS, default models/fruit_yolo11x.pt) and the `ultralytics`
package is installed. If either is missing, or the crop has no class in the model, the service falls back to the colour method.
"""
from __future__ import annotations

import base64
import os
from pathlib import Path

import cv2
import numpy as np

from .counter import decode, quality

YOLO_VERSION = 'yolo11x-fruit-1'
CONF = float(os.environ.get('FRUIT_YOLO_CONF', '0.30'))
IOU = float(os.environ.get('FRUIT_YOLO_IOU', '0.50'))
IMGSZ = int(os.environ.get('FRUIT_YOLO_IMGSZ', '800'))
_model = None
_tried = False


def weights_path() -> Path:
    return Path(os.environ.get('FRUIT_YOLO_WEIGHTS') or Path(__file__).resolve().parent.parent / 'models' / 'fruit_yolo11x.pt')


def load():
    """The model, loaded once; None when there are no weights or no ultralytics."""
    global _model, _tried
    if _tried:
        return _model
    _tried = True
    p = weights_path()
    if not p.is_file():
        return None
    try:
        from ultralytics import YOLO
        _model = YOLO(str(p))
    except Exception:  # not installed, or the file is not a model: use the colour method instead
        _model = None
    return _model


def classes() -> list[str]:
    m = load()
    return [str(v) for v in m.names.values()] if m is not None else []


def available_for(crop_class: str | None) -> bool:
    return bool(crop_class) and crop_class in classes()


def count_with_yolo(data: bytes, crop_class: str) -> dict:
    m = load()
    if m is None or crop_class not in classes():
        raise ValueError('The trained fruit model is not available for this crop.')
    img = decode(data)
    warnings, numbers = quality(img)
    cid = [k for k, v in m.names.items() if v == crop_class][0]
    res = m.predict(img, conf=CONF, iou=IOU, imgsz=IMGSZ, classes=[cid], verbose=False)[0]
    boxes = res.boxes
    xyxy = boxes.xyxy.cpu().numpy() if len(boxes) else np.zeros((0, 4))
    conf = boxes.conf.cpu().numpy() if len(boxes) else np.zeros(0)
    detections = [
        {'x': float((b[0] + b[2]) / 2), 'y': float((b[1] + b[3]) / 2), 'r': float(max(b[2] - b[0], b[3] - b[1]) / 2), 'confidence': round(float(c), 2)}
        for b, c in zip(xyxy, conf)
    ]
    n = len(detections)
    mean = float(conf.mean()) if n else 0.0
    weak = int((conf < 0.45).sum()) if n else 0
    # how sure: the detector's own confidence, lowered by a poor photo and by many borderline boxes (they are the ones that flip a count)
    score = mean
    if 'blurry' in warnings:
        score -= 0.25
    if 'too_dark' in warnings or 'too_bright' in warnings:
        score -= 0.15
    if n and weak / n > 0.3:
        score -= 0.15
    if n > 80:
        score -= 0.1
    if n == 0:
        score = min(score, 0.3)
    label = 'high' if score >= 0.65 else 'medium' if score >= 0.45 else 'low'
    return {
        'count': n, 'confidence': label, 'score': round(max(0.0, score), 2), 'warnings': warnings, 'detections': detections,
        'quality': numbers, 'image_size': [int(img.shape[1]), int(img.shape[0])], 'colors': [], 'method': YOLO_VERSION, 'crop_class': crop_class,
        'annotated_jpeg_b64': _annotate(img, xyxy, conf),
    }


def _annotate(img: np.ndarray, xyxy: np.ndarray, conf: np.ndarray) -> str:
    out = img.copy()
    thick = max(2, int(round(min(out.shape[:2]) / 300)))
    for i, (b, c) in enumerate(zip(xyxy, conf), 1):
        p1, p2 = (int(b[0]), int(b[1])), (int(b[2]), int(b[3]))
        cv2.rectangle(out, p1, p2, (255, 255, 255), thick + 2, cv2.LINE_AA)
        cv2.rectangle(out, p1, p2, (40, 140, 40) if c >= 0.45 else (0, 150, 230), thick, cv2.LINE_AA)
        cv2.putText(out, str(i), (p1[0] + 2, max(14, p1[1] - 4)), cv2.FONT_HERSHEY_SIMPLEX, max(0.45, (p2[0] - p1[0]) / 90), (255, 255, 255), thick, cv2.LINE_AA)
    bar = f'Counted: {len(xyxy)}'
    cv2.rectangle(out, (0, 0), (16 + 14 * len(bar), 34), (0, 0, 0), -1)
    cv2.putText(out, bar, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
    ok, buf = cv2.imencode('.jpg', out, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
    return base64.b64encode(buf.tobytes()).decode('ascii') if ok else ''
