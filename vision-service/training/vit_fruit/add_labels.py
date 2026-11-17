"""Adds the new fruit classes to server/src/lib/vision/labels.json, in the order the trained model uses them.

    python add_labels.py <kaggle output folder with new_classes.json and classes.json>

The crop and the word "fruit" are translated by reusing the names the file already has for that crop and for fruit; the disease names are
English only (the app falls back to English for a language that has no name). Running it twice gives the same file.
"""
import json
import re
import sys
from pathlib import Path

out_dir = Path(sys.argv[1])
labels_path = Path(__file__).resolve().parents[3] / 'server' / 'src' / 'lib' / 'vision' / 'labels.json'
doc = json.loads(labels_path.read_text(encoding='utf-8'))
trained = json.loads((out_dir / 'classes.json').read_text(encoding='utf-8'))
new = json.loads((out_dir / 'new_classes.json').read_text(encoding='utf-8'))

old = [l for l in doc['labels'] if l['part'] != 'fruit' or int(l['id']) < 229]
old = [l for l in old if int(l['id']) < 229]
assert [l['class'] for l in old] == trained[:229], 'the first 229 classes of the trained model are not the existing labels'

by_crop = {}
for l in old:
    by_crop.setdefault(l['crop'], l)
fruit_word = next(l for l in old if l['part'] == 'fruit')['names']


def family(disease, healthy):
    d = disease.lower()
    if healthy:
        return 'healthy'
    if any(w in d for w in ('borer', 'mite', 'weevil')):
        return 'pest'
    if any(w in d for w in ('anthracnose', 'blight', 'mold', 'mildew', 'rot', 'spot')) and 'blossom end' not in d:
        return 'fungal'
    return 'general'


entries = []
for i, c in enumerate(new):
    names = {}
    for lang, base in fruit_word.items():
        crop_names = (by_crop.get(c['crop']) or {}).get('names', {}).get(lang, {})
        names[lang] = {'crop': crop_names.get('crop', c['crop']), 'part': base['part'] if 'part' in base else 'fruit', 'disease': c['disease']}
    entries.append({
        'id': 229 + i, 'class': c['class'], 'key': re.sub(r'[^a-z0-9]+', '_', f"{c['crop']} fruit {c['disease']}".lower()).strip('_'),
        'crop': c['crop'], 'part': 'fruit', 'disease': c['disease'], 'healthy': bool(c['healthy']), 'family': family(c['disease'], c['healthy']), 'names': names,
    })
assert [e['class'] for e in entries] == trained[229:], 'new classes are not in the trained order'
doc['labels'] = old + entries
doc['version'] = out_dir.name if out_dir.name.startswith('20') else doc['version']
doc['source_model'] = 'vit_v0003_fruit'
labels_path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'{len(old)} old + {len(entries)} fruit labels = {len(doc["labels"])} in {labels_path}')
