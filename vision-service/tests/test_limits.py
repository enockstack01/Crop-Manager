"""Limits that protect the counter service: huge pictures, huge uploads, and the access token."""
import io
import os
import subprocess
import sys

import cv2
import numpy as np
from fastapi.testclient import TestClient

import app as service
from tests import synth

DECODE_SCRIPT = '\n'.join([
    'import app, sys',
    'from fruitcount.counter import decode',
    'try:',
    '    decode(open(sys.argv[1], "rb").read())',
    '    print("DECODED")',
    'except ValueError as e:',
    '    print("REFUSED:", e)',
])


def client():
    return TestClient(service.app)


def png_of(h, w):
    ok, buf = cv2.imencode('.png', np.zeros((h, w), np.uint8))  # a flat grey picture: a small file that unpacks to a very large image
    return buf.tobytes()


def test_a_picture_with_too_many_pixels_is_refused_politely(tmp_path):
    """OpenCV reads its pixel limit once, when it is loaded, so this runs in a fresh process exactly as the service starts: app.py first."""
    bomb = png_of(9000, 12000)  # 108 million pixels
    assert len(bomb) < 2_000_000  # a tiny file that unpacks to a huge picture
    f = tmp_path / 'bomb.png'
    f.write_bytes(bomb)
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = {k: v for k, v in os.environ.items() if k != 'OPENCV_IO_MAX_IMAGE_PIXELS'}
    out = subprocess.run([sys.executable, '-c', DECODE_SCRIPT, str(f)], cwd=here, env=env, capture_output=True, text=True, timeout=120)
    assert 'REFUSED' in out.stdout and 'too large' in out.stdout, out.stdout + out.stderr


def test_a_normal_photo_still_works():
    r = client().post('/count', files={'file': ('p.jpg', io.BytesIO(synth.photo(6, 'red')), 'image/jpeg')}, data={'colors': 'red'})
    assert r.status_code == 200 and r.json()['count'] == 6


def test_overlap_refuses_a_set_of_photos_that_is_too_large_together(monkeypatch):
    monkeypatch.setattr(service, 'MAX_TOTAL_BYTES', 1000)
    a, b = synth.photo(5, 'red', seed=1), synth.photo(5, 'red', seed=2)
    r = client().post('/overlap', files=[('files', ('a.jpg', io.BytesIO(a), 'image/jpeg')), ('files', ('b.jpg', io.BytesIO(b), 'image/jpeg'))])
    assert r.status_code == 413


def test_the_access_token_is_checked(monkeypatch):
    monkeypatch.setattr(service, 'TOKEN', 'secret-token')
    photo = synth.photo(4, 'red')

    def files():
        return {'file': ('p.jpg', io.BytesIO(photo), 'image/jpeg')}

    assert client().post('/count', files=files(), data={'colors': 'red'}).status_code == 401
    assert client().post('/count', files=files(), data={'colors': 'red'}, headers={'X-Token': 'wrong'}).status_code == 401
    assert client().post('/count', files=files(), data={'colors': 'red'}, headers={'X-Token': 'secret-token'}).status_code == 200
    assert service.allowed('secret-token') and not service.allowed('') and not service.allowed(None) and not service.allowed('secret-toke')


def test_without_a_token_the_counter_is_open(monkeypatch):
    monkeypatch.setattr(service, 'TOKEN', '')
    assert service.allowed(None) and service.allowed('anything')
