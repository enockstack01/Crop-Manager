"""A collage of several photos is counted cell by cell, so no fruit is lost to shrinking."""
import base64
import io

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

import app as service
from fruitcount.tiles import count_cells
from fruitcount import count_fruits
from tests import synth

CELL_W, CELL_H, GUTTER = 960, 720, 3


def columns(n):
    return 1 if n <= 1 else 2 if n <= 4 else 3 if n <= 9 else 4


def collage(photos, cell_w=CELL_W, cell_h=CELL_H):
    """The same layout the server builds: a grid, each photo fitted in its own cell with a dark margin."""
    cols = columns(len(photos))
    rows = -(-len(photos) // cols)
    out = np.full((rows * cell_h, cols * cell_w, 3), (33, 42, 31), np.uint8)
    for i, data in enumerate(photos):
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        h, w = img.shape[:2]
        k = min((cell_w - 2 * GUTTER) / w, (cell_h - 2 * GUTTER) / h)
        small = cv2.resize(img, (max(1, int(w * k)), max(1, int(h * k))), interpolation=cv2.INTER_AREA)
        x = (i % cols) * cell_w + GUTTER + (cell_w - 2 * GUTTER - small.shape[1]) // 2
        y = (i // cols) * cell_h + GUTTER + (cell_h - 2 * GUTTER - small.shape[0]) // 2
        out[y:y + small.shape[0], x:x + small.shape[1]] = small
    ok, buf = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return buf.tobytes(), cols, rows


def photos(n, fruit=8):
    # phone-sized photos, portrait and landscape mixed; the fruit are as large, in proportion, as in a real plant photo
    return [synth.photo(fruit, 'red', size=(4000, 3000) if i % 2 == 0 else (3000, 4000), seed=300 + i, radius=(50, 80)) for i in range(n)]


def colour(photo):
    return count_fruits(photo, ['red'], 'round', 'high')


@pytest.mark.parametrize('n', [2, 4, 6, 9, 12])
def test_counting_cell_by_cell_finds_every_fruit(n):
    data, cols, rows = collage(photos(n))
    r = count_cells(data, colour, cols, rows, CELL_W, CELL_H, n)
    assert r['count'] == 8 * n
    assert [c['count'] for c in r['cells']] == [8] * n


def test_counting_the_whole_collage_at_once_loses_fruit():
    """Why the counter works cell by cell: the same 9 photos counted as one big picture lose most of their fruit."""
    data, _cols, _rows = collage(photos(9))
    whole = count_fruits(data, ['red'], 'round', 'high')['count']
    assert whole < 72 * 0.6


def test_every_fruit_keeps_its_place_on_the_collage():
    data, cols, rows = collage(photos(4))
    r = count_cells(data, colour, cols, rows, CELL_W, CELL_H, 4)
    w, h = r['image_size']
    assert r['count'] == 32 and all(0 <= d['x'] <= w and 0 <= d['y'] <= h for d in r['detections'])
    scale = w / (cols * CELL_W)
    # each detection lies inside the cell of the photo it was found in
    for d in r['detections']:
        c = d['cell'] - 1
        left, top = (c % cols) * CELL_W * scale, (c // cols) * CELL_H * scale
        assert left <= d['x'] <= left + CELL_W * scale and top <= d['y'] <= top + CELL_H * scale
    img = cv2.imdecode(np.frombuffer(base64.b64decode(r['annotated_jpeg_b64']), np.uint8), cv2.IMREAD_COLOR)
    assert img.shape[1] == w and img.shape[0] == h


def test_a_big_collage_is_sent_back_at_a_sensible_size():
    data, cols, rows = collage(photos(12))
    r = count_cells(data, colour, cols, rows, CELL_W, CELL_H, 12)
    assert max(r['image_size']) <= 2560 and r['count'] == 96


def test_empty_cells_and_a_bad_grid():
    blank = cv2.imencode('.jpg', np.full((720, 960, 3), 90, np.uint8))[1].tobytes()
    data, cols, rows = collage([blank, blank])
    r = count_cells(data, colour, cols, rows, CELL_W, CELL_H, 2)
    assert r['count'] == 0 and r['confidence'] == 'low'
    with pytest.raises(ValueError):
        count_cells(data, colour, cols, rows, CELL_W, CELL_H, 9)  # more photos than cells
    with pytest.raises(ValueError):
        count_cells(data, colour, 5, 5, CELL_W, CELL_H, 2)  # a grid that does not match the picture
    with pytest.raises(ValueError):
        count_cells(b'not an image', colour, 2, 1, CELL_W, CELL_H, 2)
    with pytest.raises(ValueError):
        count_cells(data, colour, 100, 100, CELL_W, CELL_H, 9000)  # an absurd grid is refused before anything is cut


def test_the_service_counts_a_collage_when_given_its_grid():
    data, cols, rows = collage(photos(6))
    c = TestClient(service.app)
    form = {'colors': 'red', 'shape': 'round', 'contrast': 'high', 'cells': '6', 'cols': str(cols), 'rows': str(rows), 'cell_w': str(CELL_W), 'cell_h': str(CELL_H)}
    r = c.post('/count', files={'file': ('c.jpg', io.BytesIO(data), 'image/jpeg')}, data=form)
    assert r.status_code == 200 and r.json()['count'] == 48 and len(r.json()['cells']) == 6
    bad = c.post('/count', files={'file': ('c.jpg', io.BytesIO(data), 'image/jpeg')}, data={**form, 'cols': '7'})
    assert bad.status_code == 400
    single = c.post('/count', files={'file': ('c.jpg', io.BytesIO(photos(1)[0]), 'image/jpeg')}, data={'colors': 'red'})
    assert single.status_code == 200 and single.json()['count'] == 8 and 'cells' not in single.json()
