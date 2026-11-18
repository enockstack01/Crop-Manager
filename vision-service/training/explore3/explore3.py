import os, collections, time
from pathlib import Path
IN = Path('/kaggle/input')
print('TOP', [str(p) for p in IN.glob('*')][:20], flush=True)
roots = [p for p in IN.glob('datasets/*/*')] or [p for p in IN.glob('*')]
for ds in sorted(roots):
    t0 = time.time()
    print('=====', ds.parent.name + '/' + ds.name, flush=True)
    imgs = lab = 0
    cls = collections.Counter()
    seen = 0
    folders = collections.Counter()
    for dp, dn, fn in os.walk(ds):
        rel = os.path.relpath(dp, ds)
        for f in fn:
            lo = f.lower()
            if lo.endswith(('.jpg', '.jpeg', '.png')):
                imgs += 1
                if len(folders) < 400 or rel in folders:
                    folders[rel] += 1
            elif lo.endswith('.txt') and lo != 'classes.txt':
                lab += 1
                if seen < 1500:
                    seen += 1
                    for line in open(os.path.join(dp, f), errors='ignore'):
                        p = line.split()
                        if p:
                            cls[p[0]] += 1
            elif lo.endswith(('.yaml', '.yml', '.names')) or lo == 'classes.txt':
                print('  CLASSFILE', os.path.join(rel, f), '|', ' '.join(open(os.path.join(dp, f), errors='ignore').read().split())[:350], flush=True)
            elif lo.endswith('.json') and os.path.getsize(os.path.join(dp, f)) < 60e6:
                print('  JSON', os.path.join(rel, f), os.path.getsize(os.path.join(dp, f)), flush=True)
    print('  images', imgs, 'txt', lab, 'class ids (first 1500 files)', dict(cls.most_common(15)), flush=True)
    print('  folders', dict(folders.most_common(8)), 'secs', round(time.time() - t0), flush=True)
