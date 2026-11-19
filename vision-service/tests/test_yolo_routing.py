import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fruitcount import yolo  # noqa: E402


def _use(tmp_path, monkeypatch, routing):
    (tmp_path / 'fruit_yolo11x.pt').write_bytes(b'x')
    (tmp_path / 'fruit_yolo11x_v2.pt').write_bytes(b'x')
    (tmp_path / 'fruit_yolo_routing.json').write_text(json.dumps({'routing': routing}))
    monkeypatch.setenv('FRUIT_YOLO_WEIGHTS', str(tmp_path / 'fruit_yolo11x.pt'))
    monkeypatch.delenv('FRUIT_YOLO_ROUTING', raising=False)
    monkeypatch.setattr(yolo, '_routes', None)


def test_each_crop_goes_to_the_model_that_counts_it_best(tmp_path, monkeypatch):
    _use(tmp_path, monkeypatch, {'tomato': {'weights': 'fruit_yolo11x.pt', 'map50': 0.60}, 'hot_pepper': {'weights': 'fruit_yolo11x_v2.pt', 'map50': 0.90}})
    assert yolo.routing()['tomato']['weights'] == 'fruit_yolo11x.pt'
    assert yolo.routing()['hot_pepper']['weights'] == 'fruit_yolo11x_v2.pt'
    assert yolo.available_for('tomato') and yolo.available_for('hot_pepper')


def test_a_crop_that_scored_too_low_is_left_to_the_colour_method(tmp_path, monkeypatch):
    _use(tmp_path, monkeypatch, {'cucumber': {'weights': 'fruit_yolo11x_v2.pt', 'map50': 0.24}, 'melon': {'weights': 'fruit_yolo11x.pt', 'map50': 0.54}})
    assert yolo.reliable_classes() == ['melon']
    assert not yolo.available_for('cucumber') and not yolo.available_for('zucchini') and not yolo.available_for('')


def test_a_missing_weights_file_is_never_used(tmp_path, monkeypatch):
    _use(tmp_path, monkeypatch, {'melon': {'weights': 'fruit_yolo11x.pt', 'map50': 0.54}, 'tomato': {'weights': 'not_here.pt', 'map50': 0.6}})
    assert yolo.reliable_classes() == ['melon']


def test_without_a_routing_file_the_single_model_is_used_as_before(tmp_path, monkeypatch):
    (tmp_path / 'fruit_yolo11x.pt').write_bytes(b'x')
    monkeypatch.setenv('FRUIT_YOLO_WEIGHTS', str(tmp_path / 'fruit_yolo11x.pt'))
    monkeypatch.delenv('FRUIT_YOLO_ROUTING', raising=False)
    monkeypatch.setattr(yolo, '_routes', None)
    assert yolo.routing() is None
