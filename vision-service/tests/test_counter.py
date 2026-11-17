import base64
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fruitcount import count_fruits  # noqa: E402
from synth import photo  # noqa: E402


@pytest.mark.parametrize('n', [1, 3, 6, 10, 15, 22])
@pytest.mark.parametrize('seed', [1, 2, 3])
def test_separate_red_fruit_are_counted_exactly(n, seed):
    r = count_fruits(photo(n, 'red', seed=seed), ['red'])
    assert r['count'] == n, f'{n} fruit drawn, {r["count"]} counted'


@pytest.mark.parametrize('color', ['red', 'orange', 'yellow', 'purple'])
def test_each_fruit_colour(color):
    r = count_fruits(photo(9, color, seed=4), [color])
    assert r['count'] == 9


def test_many_fruit_are_within_one_or_two():
    for seed in (5, 6, 7):
        r = count_fruits(photo(40, 'red', seed=seed, gap=2.2), ['red'])
        assert abs(r['count'] - 40) <= 2, r['count']


def test_touching_pairs_are_split():
    for seed in (8, 9, 10):
        r = count_fruits(photo(10, 'red', seed=seed, touching_pairs=3), ['red'])
        assert abs(r['count'] - 10) <= 1, r['count']


def test_a_photo_without_fruit_counts_zero():
    r = count_fruits(photo(0, 'red', seed=11), ['red'])
    assert r['count'] == 0
    assert r['confidence'] == 'low'


def test_a_crop_with_several_colours_counts_all_of_them():
    # a cherry tomato plant has red and orange fruit at the same time
    rng_photo = photo(6, 'red', seed=12)
    img = cv2.imdecode(np.frombuffer(rng_photo, np.uint8), cv2.IMREAD_COLOR)
    from synth import fruit
    for x, y in ((100, 100), (300, 800), (900, 200)):
        fruit(img, x, y, 20, (30, 130, 240))
    ok, buf = cv2.imencode('.jpg', img)
    r = count_fruits(buf.tobytes(), ['red', 'orange'])
    assert r['count'] == 9


def test_light_green_fruit_is_never_trusted():
    r = count_fruits(photo(8, 'green', seed=13), ['green'], contrast='low')
    assert r['confidence'] == 'low'


def test_a_blurry_photo_is_flagged_and_less_trusted():
    r = count_fruits(photo(8, 'red', seed=14, blur=12), ['red'])
    assert 'blurry' in r['warnings']
    assert r['confidence'] != 'high'


def test_the_marked_photo_is_returned_and_shows_the_count():
    r = count_fruits(photo(5, 'red', seed=15), ['red'])
    jpg = base64.b64decode(r['annotated_jpeg_b64'])
    img = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
    assert img is not None and img.shape[1] <= 1280
    assert len(r['detections']) == r['count'] == 5


def test_an_unreadable_file_is_refused_with_a_message():
    with pytest.raises(ValueError, match='could not be read'):
        count_fruits(b'not a picture', ['red'])


def test_a_tiny_photo_is_refused():
    ok, buf = cv2.imencode('.jpg', np.zeros((50, 50, 3), np.uint8))
    with pytest.raises(ValueError, match='too small'):
        count_fruits(buf.tobytes(), ['red'])


def test_unknown_colours_fall_back_to_red():
    assert count_fruits(photo(4, 'red', seed=16), ['not-a-colour'])['count'] == 4


def test_a_photo_that_is_mostly_fruit_coloured_is_not_trusted():
    # an orange wall behind the plant must not look like a good count
    img = np.zeros((960, 1280, 3), np.uint8)
    img[:] = (30, 130, 240)
    ok, buf = cv2.imencode('.jpg', img)
    r = count_fruits(buf.tobytes(), ['orange'])
    assert 'background_matches_fruit' in r['warnings']
    assert r['confidence'] == 'low'


def test_a_clean_photo_with_touching_fruit_is_still_trusted():
    # touching fruit is normal on a cluster: it must cost a little confidence, not all of it
    r = count_fruits(photo(12, 'red', seed=30, touching_pairs=3), ['red'])
    assert r['count'] == 12
    assert 'blurry' not in r['warnings']
    assert r['confidence'] in ('high', 'medium')
