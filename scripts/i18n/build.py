"""Build the interface translations for the web and mobile apps.

English: brand_en.py turns every English UI string into Agricoders house style
(sentence case, British spelling) -> locales/en.json.

The dictionaries (dict_*.py) map English UI text to (French, Kinyarwanda, Swahili), written by hand.
Every other string, and the six further languages (Arabic, German, Spanish, Hindi, Portuguese, Chinese),
come from scripts/i18n/generated/<lang>.json, made by `node scripts/i18n/ai_translate.mjs` (only strings
that have no translation yet are translated, so it is cheap to re-run after adding text).
This script merges everything, checks every {{placeholder}} is kept, and writes
client/src/i18n/locales/<lang>.json and mobile/src/i18n/locales/<lang>.json for the ten languages.

    python scripts/i18n/build.py              # write the files
    python scripts/i18n/build.py keys.json    # also list English strings without a translation
"""
import importlib.util
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brand_en
import extract

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LANGS = ['fr', 'rw', 'sw']  # hand-written dictionaries
AI_LANGS = ['ar', 'de', 'es', 'hi', 'pt', 'zh']  # generated
GEN = os.path.join(HERE, 'generated')
os.makedirs(GEN, exist_ok=True)
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

def load_generated(lang):
    path = os.path.join(GEN, f'{lang}.json')
    if not os.path.exists(path):
        return {}
    data = json.load(open(path, encoding='utf8'))
    good = {}
    for en_text, text in data.items():
        if isinstance(text, str) and text.strip() and sorted(PH.findall(text)) == sorted(PH.findall(en_text)):
            good[en_text] = text
    return good


def write_locale(lang, data):
    for app in ('client', 'mobile'):
        path = os.path.join(ROOT, app, 'src', 'i18n', 'locales', f'{lang}.json')
        with open(path, 'w', encoding='utf8', newline='\n') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.write('\n')


# every English string the apps can show: found in the source, plus everything in the dictionaries
all_keys = sorted({k for k in extract.collect() if re.search(r'[A-Za-z]{3}', k)} | set(merged))
with open(os.path.join(GEN, 'keys.json'), 'w', encoding='utf8', newline='\n') as f:
    json.dump(all_keys, f, ensure_ascii=False, indent=1)
    f.write('\n')

counts = {}
for i, lang in enumerate(LANGS):
    hand = {en: tr[i] for en, tr in sorted(merged.items()) if tr[i] and tr[i] != en}
    # what the hand-written dictionaries already cover, so the generator only fills the gaps
    with open(os.path.join(GEN, f'dict_{lang}.json'), 'w', encoding='utf8', newline='\n') as f:
        json.dump(sorted(hand), f, ensure_ascii=False)
    data = {**load_generated(lang), **hand}  # hand-written wins
    counts[lang] = len(data)
    write_locale(lang, data)
for lang in AI_LANGS:
    data = load_generated(lang)
    counts[lang] = len(data)
    write_locale(lang, data)
print(f'{len(all_keys)} strings; translated: ' + ', '.join(f'{l} {n}' for l, n in counts.items()) + ' (client + mobile)')

# English house style: derived from the strings found in the source
en = brand_en.overrides(extract.collect() + [k for k in merged])
for app in ('client', 'mobile'):
    path = os.path.join(ROOT, app, 'src', 'i18n', 'locales', 'en.json')
    with open(path, 'w', encoding='utf8', newline='\n') as f:
        json.dump(en, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write('\n')
print(f'{len(en)} English strings in house style -> en.json (client + mobile)')

if len(sys.argv) > 1:
    keys = json.load(open(sys.argv[1], encoding='utf8'))
    missing = [k for k in keys if k not in merged]
    print(f'{len(missing)} of {len(keys)} extracted strings have no translation:')
    print(' | '.join(missing))
