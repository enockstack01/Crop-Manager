import os, collections
from pathlib import Path
IN = Path('/kaggle/input')
for ds in sorted(p for p in IN.glob('*/*') if p.is_dir()) or sorted(IN.glob('*')):
    print('=====', ds, flush=True)
    counts = collections.Counter()
    for root, dirs, files in os.walk(ds):
        n = sum(1 for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')))
        if n:
            counts[str(Path(root).relative_to(ds))] = n
    tot = sum(counts.values())
    print('images:', tot, 'folders with images:', len(counts), flush=True)
    for k, v in sorted(counts.items())[:70]:
        print(f'  {v:6d}  {k}', flush=True)
