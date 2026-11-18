"""Fine-tunes YOLO11x to find greenhouse fruit (one box per fruit), including green fruit among green leaves.

Runs as a Kaggle script with a GPU and the datasets listed in kernel-metadata.json attached.
It merges them into one YOLO dataset with nine classes, prints how many boxes each crop got, trains,
and leaves fruit_yolo11x.pt, dataset_summary.json and test_results.json in /kaggle/working.
"""
import glob
import json
import os
import random
import shutil
import subprocess
import sys
from pathlib import Path

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'ultralytics'], check=False)
import yaml
from PIL import Image

IN = Path('/kaggle/input')
OUT = Path('/kaggle/working/data')
CLASSES = ['tomato', 'sweet_pepper', 'hot_pepper', 'cucumber', 'eggplant', 'strawberry', 'melon']  # zucchini and green bean were dropped from the scope
CID = {c: i for i, c in enumerate(CLASSES)}
# LVIS class id -> our class
LVIS = {8: 'sweet_pepper', 20: 'hot_pepper', 16: 'hot_pepper', 24: 'cucumber', 26: 'eggplant', 30: 'strawberry', 57: 'strawberry',
        35: 'tomato', 59: 'tomato', 41: 'melon', 13: 'melon'}
random.seed(7)
items = []  # (image path, [(class name, cx, cy, w, h)], source)


def roots(part):
    for depth in (1, 2, 3):
        found = [Path(p) for p in glob.glob(str(IN) + '/*' * depth) if os.path.isdir(p) and part in Path(p).name.lower()]
        if found:
            return found
    return []


def find_images(root):
    out = {}
    for ext in ('jpg', 'jpeg', 'png', 'JPG', 'JPEG', 'PNG'):
        for p in root.rglob('*.' + ext):
            out.setdefault(p.stem, p)
    return out


def add(src, img, boxes):
    if boxes:
        items.append((img, boxes, src))


def yolo_txt(root, src, mapper):
    imgs = find_images(root)
    n = 0
    for t in root.rglob('*.txt'):
        if t.stem not in imgs:
            continue
        boxes = []
        for line in t.read_text().split('\n'):
            p = line.split()
            if len(p) >= 5:
                try:
                    c = mapper(int(float(p[0])))
                    x = [float(v) for v in p[1:5]]
                except ValueError:
                    continue
                if c:
                    boxes.append((c, *x))
        add(src, imgs[t.stem], boxes)
        n += bool(boxes)
    print(src, 'images with boxes:', n, flush=True)


def coco(root, src, mapper):
    imgs = find_images(root)
    n = 0
    for j in root.rglob('*.json'):
        try:
            d = json.loads(j.read_text())
        except Exception:
            continue
        if not isinstance(d, dict) or 'annotations' not in d or 'images' not in d:
            continue
        cats = {c['id']: c['name'] for c in d.get('categories', [])}
        by = {}
        for a in d['annotations']:
            by.setdefault(a['image_id'], []).append(a)
        for im in d['images']:
            p = imgs.get(Path(im['file_name']).stem)
            if not p:
                continue
            W = im.get('width') or Image.open(p).size[0]
            H = im.get('height') or Image.open(p).size[1]
            boxes = []
            for a in by.get(im['id'], []):
                c = mapper(cats.get(a['category_id'], ''))
                if c:
                    x, y, w, h = a['bbox']
                    boxes.append((c, (x + w / 2) / W, (y + h / 2) / H, w / W, h / H))
            add(src, p, boxes)
            n += bool(boxes)
    print(src, 'images with boxes:', n, flush=True)


def via(root, src, cls):
    imgs = find_images(root)
    n = 0
    for j in root.rglob('*.json'):
        try:
            d = json.loads(j.read_text())
        except Exception:
            continue
        meta = d.get('_via_img_metadata', d) if isinstance(d, dict) else {}
        for v in meta.values():
            if not isinstance(v, dict) or 'regions' not in v:
                continue
            p = imgs.get(Path(v.get('filename', '')).stem)
            if not p:
                continue
            W, H = Image.open(p).size
            regs = v['regions'].values() if isinstance(v['regions'], dict) else v['regions']
            boxes = []
            for r in regs:
                s = r.get('shape_attributes', {})
                if s.get('name') == 'rect':
                    x0, y0, w, h = s['x'], s['y'], s['width'], s['height']
                elif 'all_points_x' in s:
                    xs, ys = s['all_points_x'], s['all_points_y']
                    x0, y0, w, h = min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)
                elif s.get('name') == 'circle':
                    x0, y0, w, h = s['cx'] - s['r'], s['cy'] - s['r'], 2 * s['r'], 2 * s['r']
                else:
                    continue
                boxes.append((cls, (x0 + w / 2) / W, (y0 + h / 2) / H, w / W, h / H))
            add(src, p, boxes)
            n += bool(boxes)
    print(src, 'images with boxes:', n, flush=True)


VEG = {2: 'eggplant', 4: 'sweet_pepper', 7: 'cucumber', 12: 'tomato'}  # rezeliet/yolo-vegetable-dataset: Brinjal, Capsicum, Cucumber, Toomato


def capped(fn, cap, src):
    """Runs a loader but keeps at most `cap` of its images, so one big source cannot swamp the others."""
    before = len(items)
    fn()
    new = items[before:]
    if len(new) > cap:
        random.shuffle(new)
        del items[before:]
        items.extend(new[:cap])
        print(src, 'capped to', cap, flush=True)


JOBS = [
    ('yolo-vegetable', lambda r: yolo_txt(r, 'vegetable', lambda c: VEG.get(c))),
    ('chili-pepper', lambda r: capped(lambda: yolo_txt(r / 'Chili_yolov11', 'chili', lambda c: 'hot_pepper') if (r / 'Chili_yolov11').exists() else None, 1800, 'chili')),
    ('strawberry-ripeness', lambda r: yolo_txt(r, 'strawberry', lambda c: 'strawberry')),
    ('lvis-fruits', lambda r: yolo_txt(r, 'lvis', lambda c: LVIS.get(c))),
    ('cucumber', lambda r: yolo_txt(r, 'field-cucumber', lambda c: 'cucumber')),
    ('melon-detection', lambda r: yolo_txt(r, 'melon', lambda c: 'melon')),
    ('tomatod', lambda r: coco(r, 'tomatod', lambda n: 'tomato')),
    ('sweet-pepper', lambda r: via(r, 'sweet-pepper', 'sweet_pepper')),
]
print('INPUT', [p.name for p in IN.glob('*')], flush=True)
for name, fn in JOBS:
    for r in roots(name)[:1]:
        try:
            fn(r)
        except Exception as e:
            print('SKIPPED', name, repr(e), flush=True)

# split by source image so no image is in two sets: 85 / 10 / 5
random.shuffle(items)
n = len(items)
cut = {'train': items[: int(n * .85)], 'val': items[int(n * .85): int(n * .92)], 'test': items[int(n * .92):]}
percrop = {c: 0 for c in CLASSES}
for split, rows in cut.items():
    (OUT / 'images' / split).mkdir(parents=True, exist_ok=True)
    (OUT / 'labels' / split).mkdir(parents=True, exist_ok=True)
    for i, (img, boxes, src) in enumerate(rows):
        stem = f'{src}_{i}'
        try:
            im = Image.open(img).convert('RGB')
            im.thumbnail((1280, 1280))
            im.save(OUT / 'images' / split / f'{stem}.jpg', quality=92)
        except Exception:
            continue
        lines = []
        for c, cx, cy, w, h in boxes:
            if 0 < w <= 1 and 0 < h <= 1:
                lines.append(f'{CID[c]} {min(max(cx, 0), 1):.6f} {min(max(cy, 0), 1):.6f} {w:.6f} {h:.6f}')
                percrop[c] += 1
        (OUT / 'labels' / split / f'{stem}.txt').write_text('\n'.join(lines))
print('IMAGES', {k: len(v) for k, v in cut.items()}, flush=True)
print('BOXES PER CROP', percrop, flush=True)
(OUT / 'data.yaml').write_text(yaml.safe_dump({'path': str(OUT), 'train': 'images/train', 'val': 'images/val', 'test': 'images/test', 'names': dict(enumerate(CLASSES))}))
json.dump({'boxes_per_crop': percrop, 'images': {k: len(v) for k, v in cut.items()}}, open('/kaggle/working/dataset_summary.json', 'w'))
if n < 50:
    sys.exit('Too few labelled images found: ' + str(n))

from ultralytics import YOLO

hours = float(os.environ.get('TRAIN_HOURS', '5'))
m = YOLO('yolo11x.pt')
m.train(data=str(OUT / 'data.yaml'), imgsz=800, epochs=60, time=hours, batch=8, project='/kaggle/working/runs', name='fruit',
        patience=15, workers=4, cache=False, plots=False)
best = Path('/kaggle/working/runs/fruit/weights/best.pt')
shutil.copy(best, '/kaggle/working/fruit_yolo11x.pt')
met = YOLO(str(best)).val(data=str(OUT / 'data.yaml'), split='test', imgsz=800)
res = {'map50': float(met.box.map50), 'map50_95': float(met.box.map),
       'per_class_map50': {CLASSES[int(c)]: float(v) for c, v in zip(met.box.ap_class_index, met.box.ap50)}}
json.dump(res, open('/kaggle/working/test_results.json', 'w'))
print('TEST', res, flush=True)
# keep the test split so the old weights can be scored on exactly the same photos (replace only if every crop holds or improves)
shutil.copytree(OUT / 'images' / 'test', '/kaggle/working/test_set/images')
shutil.copytree(OUT / 'labels' / 'test', '/kaggle/working/test_set/labels')
(Path('/kaggle/working/test_set') / 'classes.json').write_text(json.dumps(CLASSES))
shutil.rmtree(OUT, ignore_errors=True)
shutil.rmtree('/kaggle/working/runs', ignore_errors=True)
