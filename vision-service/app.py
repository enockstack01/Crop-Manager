"""
The fruit counter as a small web service. CropManager's server sends it a plant photo and the fruit colours of the crop, and gets back
how many fruit it can see, with a confidence and a picture with every counted fruit marked. The server compares that number with the
number the farmer recorded.

Run it:   uvicorn app:app --host 0.0.0.0 --port 8090
Settings: FRUIT_YOLO_WEIGHTS  path of the trained YOLO model (default models/fruit_yolo11x.pt); used when it exists and the crop is one it knows
          FRUIT_COUNTER_TOKEN   if set, every request must send it in the X-Token header (set the same value in the CropManager server)
"""
import hmac
import os
import sys

# a photo is refused when it holds more pixels than this (80 million, far above any phone photo that was shrunk first): a small file can
# unpack to a huge picture and exhaust the server's memory. Must be set before OpenCV is loaded.
os.environ.setdefault('OPENCV_IO_MAX_IMAGE_PIXELS', str(80_000_000))

import cv2
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

from fruitcount import COLORS, SHAPES, VERSION, count_fruits
from fruitcount import yolo
from fruitcount.counter import decode
from fruitcount.overlap import overlapping_pairs
from fruitcount.tiles import count_cells

TOKEN = os.environ.get('FRUIT_COUNTER_TOKEN', '')
if not TOKEN:
    print('WARNING: FRUIT_COUNTER_TOKEN is not set, so anyone who knows this address can use the counter. Set it here and on the CropManager server.', file=sys.stderr)


def allowed(sent):
    """The access token, compared in constant time so its length and content cannot be guessed from the answer time."""
    return not TOKEN or hmac.compare_digest(str(sent or '').encode(), TOKEN.encode())
MAX_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 80 * 1024 * 1024  # all the photos of one overlap check together

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
    imgsz: int = Form(0),  # a larger working size for the trained model, when asked
    cells: int = Form(0),  # a collage of this many photos, in a grid of `cols` x `rows` cells of cell_w x cell_h: counted cell by cell
    cols: int = Form(0),
    rows: int = Form(0),
    cell_w: int = Form(0),
    cell_h: int = Form(0),
    x_token: str | None = Header(default=None),
):
    if not allowed(x_token):
        raise HTTPException(status_code=401, detail='Not allowed')
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail='The photo is too large')
    names = [c.strip().lower() for c in colors.split(',') if c.strip()]
    if not names or any(c not in COLORS for c in names):
        raise HTTPException(status_code=400, detail=f'colors must be from: {", ".join(sorted(COLORS))}')
    if shape not in SHAPES:
        raise HTTPException(status_code=400, detail=f'shape must be one of: {", ".join(SHAPES)}')
    def one(photo: bytes) -> dict:
        # the trained model first, when it knows this crop: it can find green fruit among green leaves. Otherwise the colour method.
        if yolo.available_for(crop_class.strip().lower()):
            try:
                return yolo.count_with_yolo(photo, crop_class.strip().lower(), imgsz=imgsz)
            except ValueError:
                raise
            except Exception:  # a model failure must never lose the check: fall back
                pass
        return count_fruits(photo, names, shape, 'low' if contrast == 'low' else 'high')

    try:
        if cells > 1:
            return count_cells(data, one, cols, rows, cell_w, cell_h, cells)
        return one(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post('/overlap')
def overlap(files: list[UploadFile] = File(...), x_token: str | None = Header(default=None)):
    """Which of the photos of one plant show the same part of it (a fruit could then be counted twice)."""
    if not allowed(x_token):
        raise HTTPException(status_code=401, detail='Not allowed')
    if not 2 <= len(files) <= 12:
        raise HTTPException(status_code=400, detail='Send between 2 and 12 photos.')
    blobs, total = [], 0
    for f in files:
        data = f.file.read(MAX_BYTES + 1)
        total += len(data)
        if len(data) > MAX_BYTES or total > MAX_TOTAL_BYTES:
            raise HTTPException(status_code=413, detail='The photos are too large')
        blobs.append(data)
    try:
        images = [decode(b) for b in blobs]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {'pairs': overlapping_pairs(images)}
