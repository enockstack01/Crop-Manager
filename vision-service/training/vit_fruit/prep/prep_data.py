"""Builds the fruit-photo training set for the ViT-Large extension (runs on Kaggle, CPU only, a few minutes).

Reads the attached public datasets, groups their photos into crop + fruit condition classes, caps and splits them, shrinks every photo to at
most 448 px and writes /kaggle/working/new/{train,val}/nNNN/*.jpg plus new_classes.json and data_report.json (how many photos each class got,
and from where). The training kernel reads this output, so a problem here shows up in minutes and not after hours of GPU time.
"""
import json
import os
import random
import re
import shutil
from pathlib import Path

from PIL import Image

IN = Path('/kaggle/input')
OUT = Path('/kaggle/working')
random.seed(11)
IMG_EXT = ('.jpg', '.jpeg', '.png', '.webp')
TRAIN_CAP, VAL_CAP = 220, 50

# (crop, condition, healthy?, [(dataset folder fragment, regex on the folder path below it), ...]) one entry per class
FRUIT = [
    ('Tomato', 'Healthy fruit', True, [('tomato-disease-dataset-both-leaf-and-fruit', r'Fruit/healthy$'), ('tomato-leaf-and-fruit', r'Raw Dataset/Healthy Fruits$'), ('fruit-and-vegetable-disease-healthy-vs-rotten', r'Tomato__Healthy$'), ('tomatofruits', r'Two Classes/Healthy$'), ('tomatofruits', r'Three Classes/(Ripe|Unripe)$'), ('fresh-and-rotten-fruits-and-vegetables', r'Train/FreshTomato$'), ('vegetable-image-dataset', r'train/Tomato$')]),
    ('Tomato', 'Fruit anthracnose', False, [('tomato-disease-dataset-both-leaf-and-fruit', r'Fruit/anthracnose$')]),
    ('Tomato', 'Fruit late blight', False, [('tomato-disease-dataset-both-leaf-and-fruit', r'Fruit/blight$')]),
    ('Tomato', 'Blossom end rot', False, [('tomato-disease-dataset-both-leaf-and-fruit', r'Fruit/blossom$')]),
    ('Tomato', 'Buckeye rot', False, [('tomato-disease-dataset-both-leaf-and-fruit', r'Fruit/buck$')]),
    ('Tomato', 'Catfacing', False, [('tomato-disease-dataset-both-leaf-and-fruit', r'Fruit/catfaced$')]),
    ('Tomato', 'Fruit cracking', False, [('tomato-disease-dataset-both-leaf-and-fruit', r'Fruit/crack$')]),
    ('Tomato', 'Fruit mold', False, [('tomato-disease-dataset-both-leaf-and-fruit', r'Fruit/mold$')]),
    ('Tomato', 'Fruit spot', False, [('tomato-disease-dataset-both-leaf-and-fruit', r'Fruit/spot$'), ('tomato-leaf-and-fruit', r'Raw Dataset/Target Spot Fruits$')]),
    ('Tomato', 'Defective fruit', False, [('tomatofruits', r'(Two|Three) Classes/Reject$')]),
    ('Tomato', 'Rotten fruit', False, [('fruit-and-vegetable-disease-healthy-vs-rotten', r'Tomato__Rotten$'), ('fresh-and-rotten-fruits-and-vegetables', r'Train/RottenTomato$'), ('tomato-maturity-detection-and-quality-grading', r'Original Dataset/Rotten$')]),
    ('Bell pepper', 'Healthy fruit', True, [('fruit-and-vegetable-disease-healthy-vs-rotten', r'Bellpepper__Healthy$'), ('high-quality-crop-disease', r'Bellpepper__Healthy$'), ('vegetable-image-dataset', r'train/Capsicum$'), ('fresh-and-stale-images-of-fruits-and-vegetables', r'^fresh_capsicum$'), ('fruits262', r'^Fruit-262/bell pepper$')]),
    ('Bell pepper', 'Rotten fruit', False, [('fruit-and-vegetable-disease-healthy-vs-rotten', r'Bellpepper__Rotten$'), ('high-quality-crop-disease', r'Bellpepper__Rotten$'), ('fresh-and-stale-images-of-fruits-and-vegetables', r'^stale_capsicum$')]),
    ('Chilli', 'Healthy fruit', True, [('chili-pepper-cleaned', r'Healthy$'), ('anthracnose-disease-in-chilli', r'Healthy$'), ('chili-pepper-multi-source-dataset-bd', r'CNN640640/train/(BARI-1|Bombai|Cherry)_Chili$'), ('fruit-and-vegetable-image-recognition', r'train/chilli pepper$')]),
    ('Chilli', 'Fruit anthracnose', False, [('chili-pepper-cleaned', r'Anthracnose$'), ('anthracnose-disease-in-chilli', r'Anthracnose$')]),
    ('Chilli', 'Unhealthy fruit', False, [('chili-pepper-multi-source-dataset-bd', r'CNN640640/train/Unhealthy_Chili$')]),
    ('Cucumber', 'Healthy fruit', True, [('cucumber-disease-recognition', r'Original Image/Original Image/Fresh Cucumber$'), ('cucumber-diseases-classifaction', r'Fresh Cucumber$'), ('fruit-and-vegetable-disease-healthy-vs-rotten', r'Cucumber__Healthy$'), ('high-quality-crop-disease', r'Cucumber__healthy$'), ('fresh-and-stale-classification', r'Train/freshcucumber$')]),
    ('Cucumber', 'Belly rot', False, [('cucumber-disease-recognition', r'Original Image/Original Image/Belly Rot$'), ('cucumber-diseases-classifaction', r'Belly Rot$')]),
    ('Cucumber', 'Pythium fruit rot', False, [('cucumber-disease-recognition', r'Original Image/Original Image/Pythium Fruit Rot$'), ('cucumber-diseases-classifaction', r'Pythium Fruit Rot$')]),
    ('Cucumber', 'Rotten fruit', False, [('fruit-and-vegetable-disease-healthy-vs-rotten', r'Cucumber__Rotten$'), ('high-quality-crop-disease', r'Cucumber__Rotten$'), ('fresh-and-stale-classification', r'Train/rottencucumber$')]),
    ('Eggplant', 'Healthy fruit', True, [('brinjal-dataset', r'Healty Brinjal$'), ('fruit-and-vegetable-image-recognition', r'train/eggplant$'), ('vegetable-image-dataset', r'train/Brinjal$')]),
    ('Eggplant', 'Fruit cracking', False, [('brinjal-dataset', r'Brinjal Fruit Creaking$')]),
    ('Eggplant', 'Phomopsis blight', False, [('brinjal-dataset', r'Phomopsis Bright$')]),
    ('Eggplant', 'Shoot and fruit borer', False, [('brinjal-dataset', r'Shoot and Fruit Borer$')]),
    ('Eggplant', 'Wet rot', False, [('brinjal-dataset', r'Wet Rot$')]),
    ('Strawberry', 'Healthy fruit', True, [('fruit-and-vegetable-disease-healthy-vs-rotten', r'Strawberry__Healthy$')]),
    ('Strawberry', 'Rotten fruit', False, [('fruit-and-vegetable-disease-healthy-vs-rotten', r'Strawberry__Rotten$')]),
    ('Strawberry', 'Anthracnose fruit rot', False, [('fruit-infection-disease', r'Strawberry_Anthracnose_Fruit_Rot$')]),
    ('Strawberry', 'Powdery mildew on fruit', False, [('fruit-infection-disease', r'Strawberry_Powdery_Mildew_Fruit$')]),
    ('Strawberry', 'Gray mold', False, [('fruit-infection-disease', r'Strawberry_Gray_Mold$')]),
    ('Strawberry', 'Blossom blight', False, [('fruit-infection-disease', r'Strawberry_Blossom_Blight$')]),
    ('Melon', 'Healthy fruit', True, [('cantaloupe-classification', r'(Long cantaloupe|Round cantaloupe|yellow royal cantaloupe)$'), ('fruits-and-vegetables', r'Muskmelon$'), ('fruits262', r'^Fruit-262/(cantaloupe|honeydew melon|muskmelon|melon)$')]),
    ('Melon', 'Defective fruit', False, [('cantaloupe-classification', r'disabilities$')]),
    ('Bean', 'Healthy pods', True, [('vegetable-image-dataset', r'train/Bean$'), ('fruits-and-vegetables', r'/Beans$'), ('fruits262', r'^Fruit-262/(green bean|string bean|snap bean|bean)$')]),
    ('Zucchini', 'Healthy fruit', True, [('fruits262', r'^Fruit-262/(zucchini|courgette|summer squash)$'), ('fruits', r'[Zz]ucchini'), ('fruits-and-vegetables', r'[Zz]ucchini|[Cc]ourgette')]),
]


def index_dirs():
    """One pass over the attached data: every folder that holds photos."""
    found = []
    for root, dirs, files in os.walk(IN):
        dirs[:] = [d for d in dirs if 'resized' not in d.lower() and d not in ('Scripts', 'Thesis', 'paper')]
        if any(f.lower().endswith(IMG_EXT) for f in files[:50]):
            found.append(Path(root))
    print('folders with photos:', len(found), flush=True)
    return found


def below(path, fragment):
    """The part of `path` below the first folder whose name contains `fragment`, or None."""
    parts = path.parts
    for i, p in enumerate(parts):
        if fragment in p.lower():
            return '/'.join(parts[i + 1:])
    return None


def photos(d):
    return [p for p in d.iterdir() if p.is_file() and p.suffix.lower() in IMG_EXT]


dirs = index_dirs()
work = OUT / 'new'
shutil.rmtree(work, ignore_errors=True)
classes, report = [], {}
for crop, cond, healthy, rules in FRUIT:
    name = f'{crop}___{cond}'
    files, used = [], {}
    for fragment, pattern in rules:
        for d in dirs:
            rel = below(d, fragment)
            if rel is not None and re.search(pattern, rel):
                got = photos(d)
                files += got
                used[fragment] = used.get(fragment, 0) + len(got)
    files = sorted(set(files))
    random.shuffle(files)
    nval = min(VAL_CAP, max(1, len(files) // 5)) if len(files) >= 10 else 0
    val, train = files[:nval], files[nval:nval + TRAIN_CAP]
    report[name] = {'found': len(files), 'train': len(train), 'val': len(val), 'from': used}
    print(f'{name:45s} found {len(files):6d} -> train {len(train):4d} val {len(val):3d}', flush=True)
    if len(train) < 15:
        report[name]['dropped'] = True
        continue
    idx = len(classes)
    classes.append({'class': name, 'crop': crop, 'part': 'fruit', 'disease': cond, 'healthy': healthy})
    for split, items in (('train', train), ('val', val)):
        dest = work / split / f'n{idx:03d}'
        dest.mkdir(parents=True, exist_ok=True)
        for i, p in enumerate(items):
            try:
                with Image.open(p) as im:
                    im = im.convert('RGB')
                    im.thumbnail((448, 448))
                    im.save(dest / f'{i:05d}.jpg', quality=90)
            except Exception:
                pass
(OUT / 'new_classes.json').write_text(json.dumps(classes, indent=2), encoding='utf-8')
(OUT / 'data_report.json').write_text(json.dumps(report, indent=1))
print('CLASSES', len(classes), 'dropped', [k for k, v in report.items() if v.get('dropped')], flush=True)
