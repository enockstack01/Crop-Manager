"""Build the interface translations for the web and mobile apps.

The dictionaries (dict_*.py) map English UI text to (French, Kinyarwanda, Swahili).
This script merges them, checks every {{placeholder}} is kept, and writes
client/src/i18n/locales/{fr,rw,sw}.json and mobile/src/i18n/locales/{fr,rw,sw}.json.

    python scripts/i18n/build.py              # write the files
    python scripts/i18n/build.py keys.json    # also list English strings without a translation
"""
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LANGS = ['fr', 'rw', 'sw']
PH = re.compile(r'\{\{\s*\w+\s*\}\}')

merged = {}
for name in sorted(f for f in os.listdir(HERE) if re.match(r'dict_\w+\.py$', f)):
    spec = importlib.util.spec_from_file_location(name[:-3], os.path.join(HERE, name))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    merged.update(mod.T)  # later files win

errors = []
for en, tr in merged.items():
    if len(tr) != 3:
        errors.append(f'{en!r}: expected 3 translations')
        continue
    want = sorted(PH.findall(en))
    for lang, text in zip(LANGS, tr):
        if sorted(PH.findall(text)) != want:
            errors.append(f'{lang} {en!r}: placeholders {PH.findall(text)} != {want}')
if errors:
    print('\n'.join(errors))
    sys.exit(1)

for i, lang in enumerate(LANGS):
    data = {en: tr[i] for en, tr in sorted(merged.items()) if tr[i] and tr[i] != en}
    for app in ('client', 'mobile'):
        path = os.path.join(ROOT, app, 'src', 'i18n', 'locales', f'{lang}.json')
        with open(path, 'w', encoding='utf8', newline='\n') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.write('\n')
print(f'{len(merged)} strings -> {", ".join(LANGS)} (client + mobile)')

if len(sys.argv) > 1:
    keys = json.load(open(sys.argv[1], encoding='utf8'))
    missing = [k for k in keys if k not in merged]
    print(f'{len(missing)} of {len(keys)} extracted strings have no translation:')
    print(' | '.join(missing))
