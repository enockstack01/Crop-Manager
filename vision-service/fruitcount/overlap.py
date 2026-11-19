"""
Tells whether two photos of the same plant show the same part of it, so a fruit would be counted twice in a collage.
It matches ORB features between each pair of photos and keeps the matches that fit one consistent shift (RANSAC); many of them mean
the photos overlap. This is a warning for the person taking the photos, not a measurement.
"""
from __future__ import annotations

import cv2
import numpy as np

MIN_INLIERS = 28


def _features(img: np.ndarray):
    h, w = img.shape[:2]
    k = 640 / max(h, w)
    small = cv2.resize(img, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA) if k < 1 else img
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    orb = cv2.ORB_create(1500)
    return orb.detectAndCompute(gray, None)


def shared_features(a, b) -> int:
    """How many features of photo a and photo b agree on one shift."""
    (ka, da), (kb, db) = a, b
    if da is None or db is None or len(ka) < 12 or len(kb) < 12:
        return 0
    good = []
    for pair in cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da, db, k=2):
        if len(pair) == 2 and pair[0].distance < 0.75 * pair[1].distance:
            good.append(pair[0])
    if len(good) < 12:
        return 0
    src = np.float32([ka[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst = np.float32([kb[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    _, mask = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4.0)
    return int(mask.sum()) if mask is not None else 0


def overlapping_pairs(images: list[np.ndarray]) -> list[dict]:
    feats = [_features(i) for i in images]
    out = []
    for i in range(len(feats)):
        for j in range(i + 1, len(feats)):
            n = shared_features(feats[i], feats[j])
            if n >= MIN_INLIERS:
                out.append({'a': i + 1, 'b': j + 1, 'shared': n})
    return out
