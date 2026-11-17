import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import app as service  # noqa: E402
from synth import photo  # noqa: E402

client = TestClient(service.app)


def test_health_says_what_it_can_do():
    r = client.get('/health').json()
    assert r['ok'] is True and 'red' in r['colors']


def test_it_counts_a_photo_sent_the_way_the_server_sends_it():
    r = client.post('/count', files={'file': ('photo.jpg', photo(7, 'red', seed=40), 'image/jpeg')}, data={'colors': 'red', 'shape': 'round', 'contrast': 'high'})
    assert r.status_code == 200
    body = r.json()
    assert body['count'] == 7 and body['confidence'] in ('high', 'medium') and body['annotated_jpeg_b64']


def test_several_colours_are_sent_as_a_comma_list():
    r = client.post('/count', files={'file': ('p.jpg', photo(5, 'orange', seed=41), 'image/jpeg')}, data={'colors': 'red,orange,yellow'})
    assert r.json()['count'] == 5


def test_an_unknown_colour_is_refused():
    r = client.post('/count', files={'file': ('p.jpg', photo(3, 'red', seed=42), 'image/jpeg')}, data={'colors': 'blue'})
    assert r.status_code == 400


def test_a_file_that_is_not_a_picture_is_a_clear_400():
    r = client.post('/count', files={'file': ('p.jpg', b'hello', 'image/jpeg')}, data={'colors': 'red'})
    assert r.status_code == 400 and 'could not be read' in r.json()['detail']


def test_the_secret_is_required_when_one_is_set(monkeypatch):
    monkeypatch.setattr(service, 'TOKEN', 'letmein')
    img = photo(4, 'red', seed=43)
    assert client.post('/count', files={'file': ('p.jpg', img, 'image/jpeg')}, data={'colors': 'red'}).status_code == 401
    assert client.post('/count', files={'file': ('p.jpg', img, 'image/jpeg')}, data={'colors': 'red'}, headers={'X-Token': 'wrong'}).status_code == 401
    ok = client.post('/count', files={'file': ('p.jpg', img, 'image/jpeg')}, data={'colors': 'red'}, headers={'X-Token': 'letmein'})
    assert ok.status_code == 200 and ok.json()['count'] == 4
