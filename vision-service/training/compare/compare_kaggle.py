"""Scores the old and the new fruit detector on the SAME held-out photos, per crop and per photo source, so a new model is
accepted only if no crop got worse. Needs the training kernel's output (test_set + weights) and the old weights attached."""
import glob, json, os, shutil, subprocess, sys
from pathlib import Path
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'ultralytics'], check=False)
import yaml
from ultralytics import YOLO

def find(name):
    hits = glob.glob(f'/kaggle/input/**/{name}', recursive=True)
    return hits[0] if hits else None

new_w, old_w = find('fruit_yolo11x.pt'), None
for h in glob.glob('/kaggle/input/**/fruit_yolo11x.pt', recursive=True):
    if 'yolo-v1' in h:
        old_w = h
    else:
        new_w = h
ts = Path(find('test_set/classes.json')).parent
print('new', new_w, 'old', old_w, 'test', ts, flush=True)
NEW = json.loads((ts / 'classes.json').read_text())
OLD = ['tomato', 'sweet_pepper', 'hot_pepper', 'cucumber', 'eggplant', 'strawberry', 'zucchini', 'melon', 'green_bean']
imgs = sorted((ts / 'images').glob('*.jpg'))
print('test photos', len(imgs), flush=True)
groups = {}
for p in imgs:
    groups.setdefault(p.stem.rsplit('_', 1)[0], []).append(p)
print({k: len(v) for k, v in groups.items()}, flush=True)

def build(name, names, subset):
    root = Path('/kaggle/working/ev') / name
    shutil.rmtree(root, ignore_errors=True)
    (root / 'images').mkdir(parents=True); (root / 'labels').mkdir(parents=True)
    for p in subset:
        shutil.copy(p, root / 'images' / p.name)
        out = []
        for line in (ts / 'labels' / (p.stem + '.txt')).read_text().split('\n'):
            q = line.split()
            if len(q) == 5 and NEW[int(q[0])] in names:
                out.append(' '.join([str(names.index(NEW[int(q[0])]))] + q[1:]))
        (root / 'labels' / (p.stem + '.txt')).write_text('\n'.join(out))
    (root / 'data.yaml').write_text(yaml.safe_dump({'path': str(root), 'train': 'images', 'val': 'images', 'names': dict(enumerate(names))}))
    return root / 'data.yaml'

res = {}
for tag, w, names in (('old', old_w, OLD), ('new', new_w, NEW)):
    m = YOLO(w)
    for scope, subset in [('ALL', imgs)] + sorted(groups.items()):
        try:
            r = m.val(data=str(build(f'{tag}_{scope}', names, subset)), imgsz=800, conf=0.001, verbose=False, plots=False)
            per = {names[int(c)]: round(float(v), 3) for c, v in zip(r.box.ap_class_index, r.box.ap50)}
            res.setdefault(scope, {})[tag] = {'n': len(subset), 'map50': round(float(r.box.map50), 3), 'per_class': per}
        except Exception as e:
            res.setdefault(scope, {})[tag] = {'error': repr(e)[:200]}
        print(tag, scope, res[scope][tag], flush=True)
json.dump(res, open('/kaggle/working/compare.json', 'w'), indent=1)
shutil.rmtree('/kaggle/working/ev', ignore_errors=True)
