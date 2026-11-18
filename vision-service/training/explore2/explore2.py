import os, glob, collections
from pathlib import Path
IN = Path('/kaggle/input')
for ds in sorted(p for p in IN.glob('*/*/*') if p.is_dir()):
    print('=====', ds.parent.name + '/' + ds.name, flush=True)
    yamls = [p for p in ds.rglob('*.yaml')] + [p for p in ds.rglob('classes.txt')] + [p for p in ds.rglob('*.names')]
    for y in yamls[:3]:
        t = y.read_text(errors='ignore')
        print('  CLASSFILE', y.relative_to(ds), '|', ' '.join(t.split())[:400], flush=True)
    jsons = [p for p in ds.rglob('*.json') if p.stat().st_size < 60e6][:2]
    for j in jsons:
        print('  JSON', j.relative_to(ds), j.stat().st_size, flush=True)
    imgs = sum(1 for _ in ds.rglob('*.jpg')) + sum(1 for _ in ds.rglob('*.png')) + sum(1 for _ in ds.rglob('*.jpeg'))
    txts = [p for p in ds.rglob('*.txt') if p.name != 'classes.txt']
    c = collections.Counter()
    for t in txts[:4000]:
        for line in t.read_text(errors='ignore').splitlines():
            if line.split():
                c[line.split()[0]] += 1
    print('  images', imgs, 'txt labels', len(txts), 'class ids', dict(c.most_common(12)), flush=True)
    dirs = collections.Counter(str(p.parent.relative_to(ds)) for p in list(ds.rglob('*.jpg'))[:3000])
    print('  folders', dict(dirs.most_common(6)), flush=True)
