"""
The fruit counter as a small web service. CropManager's server sends it a plant photo and the fruit colours of the crop, and gets back
how many fruit it can see, with a confidence and a picture with every counted fruit marked. The server compares that number with the
number the farmer recorded.

Run it:   uvicorn app:app --host 0.0.0.0 --port 8090
Settings: FRUIT_YOLO_WEIGHTS  path of the trained YOLO model (default models/fruit_yolo11x.pt); used when it exists and the crop is one it knows
          FRUIT_COUNTER_TOKEN   if set, every request must send it in the X-Token header (set the same value in the CropManager server)
"""
import os

import cv2
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

from fruitcount import COLORS, SHAPES, VERSION, count_fruits
from fruitcount import yolo
from fruitcount.counter import decode
from fruitcount.overlap import overlapping_pairs

TOKEN = os.environ.get('FRUIT_COUNTER_TOKEN', '')
MAX_BYTES = 25 * 1024 * 1024

app = FastAPI(title='CropManager fruit counter', version=VERSION)


@app.get('/health')
def health():
    return {'ok': True, 'opencv': cv2.__version__, 'method': VERSION, 'colors': sorted(COLORS), 'protected': bool(TOKEN), 'trained_model': yolo.classes(), 'trained_model_used_for': yolo.reliable_classes()}


@app.post('/count')
def count(
    file: UploadFile = File(...),
    colors: str = Form('red'),
    shape: str = Form('round'),
    contrast: str = Form('high'),
    crop_class: str = Form(''),
    imgsz: int = Form(0),  # a joined collage of several photos is large: the server asks for a bigger working size so small fruit are not lost
    x_token: str | None = Header(default=None),
):
    if TOKEN and x_token != TOKEN:
        raise HTTPException(status_code=401, detail='Not allowed')
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail='The photo is too large')
    names = [c.strip().lower() for c in colors.split(',') if c.strip()]
    if not names or any(c not in COLORS for c in names):
        raise HTTPException(status_code=400, detail=f'colors must be from: {", ".join(sorted(COLORS))}')
    if shape not in SHAPES:
        raise HTTPException(status_code=400, detail=f'shape must be one of: {", ".join(SHAPES)}')
    try:
        # the trained model first, when it knows this crop: it can find green fruit among green leaves. Otherwise the colour method.
        if yolo.available_for(crop_class.strip().lower()):
            try:
                return yolo.count_with_yolo(data, crop_class.strip().lower(), imgsz=imgsz)
            except ValueError:
                raise
            except Exception:  # a model failure must never lose the check: fall back
                pass
        return count_fruits(data, names, shape, 'low' if contrast == 'low' else 'high')
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post('/overlap')
def overlap(files: list[UploadFile] = File(...), x_token: str | None = Header(default=None)):
    """Which of the photos of one plant show the same part of it (a fruit could then be counted twice)."""
    if TOKEN and x_token != TOKEN:
        raise HTTPException(status_code=401, detail='Not allowed')
    if not 2 <= len(files) <= 12:
        raise HTTPException(status_code=400, detail='Send between 2 and 12 photos.')
    try:
        images = [decode(f.file.read(MAX_BYTES + 1)) for f in files]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {'pairs': overlapping_pairs(images)}
