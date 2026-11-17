"""Turns the Kaggle output of train_vit_fruit.py into a model folder the Space loads (same layout as models/vit-large-384-crops-v0.2).

    python package_model.py <kaggle output folder> <result folder>

Reads model.pt, config.json, classes.json, meta.json from the Kaggle output; labels.json from the server (run add_labels.py first).
Writes config.json, model.safetensors (FP16, Hugging Face key names), labels.json, model_card.json, preprocessor_config.json.
"""
import json
import shutil
import sys
from pathlib import Path

import torch
from safetensors.torch import save_file

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
root = Path(__file__).resolve().parents[3]
dst.mkdir(parents=True, exist_ok=True)
meta = json.loads((src / 'meta.json').read_text())
classes = json.loads((src / 'classes.json').read_text(encoding='utf-8'))
labels = json.loads((root / 'server' / 'src' / 'lib' / 'vision' / 'labels.json').read_text(encoding='utf-8'))
assert [l['class'] for l in labels['labels']] == classes, 'labels.json does not match the trained classes: run add_labels.py'

sd = torch.load(src / 'model.pt', map_location='cpu')
sd = {k[4:] if k.startswith('vit.') else k: v.contiguous() for k, v in sd.items()}  # model.pt keys are "vit." + the Hugging Face names
save_file({k: v.half() if v.is_floating_point() else v for k, v in sd.items()}, str(dst / 'model.safetensors'), metadata={'format': 'pt'})
cfg = json.loads((src / 'config.json').read_text())
cfg['id2label'] = {str(i): c for i, c in enumerate(classes)}
cfg['label2id'] = {c: i for i, c in enumerate(classes)}
(dst / 'config.json').write_text(json.dumps(cfg, indent=2))
(dst / 'labels.json').write_text(json.dumps(labels, ensure_ascii=False, indent=1), encoding='utf-8')
shutil.copy(root / 'vision-service' / 'hf_space' / 'preprocessor_config.json', dst / 'preprocessor_config.json')
(dst / 'model_card.json').write_text(json.dumps({
    'model_version': 'vit-large-384-crops-v0.3-fruit', 'trained_from': 'vit-large-384-crops-v0.2', 'base': 'google/vit-large-patch16-384',
    'dataset_images': meta['n_train'], 'validation': {'images': meta['n_val'], 'top1': meta['val_acc'], 'top3': meta['val_top3'],
                                                       'old_classes_top1': meta['old_classes_acc'], 'new_fruit_classes_top1': meta['new_fruit_classes_acc']},
    'temperature': meta['temperature'], 'ood_floor': meta['ood_floor'], 'classes': len(classes),
    'note': 'v0.2 widened with greenhouse fruit classes (healthy and diseased fruit of tomato, bell pepper, chilli, cucumber, eggplant, strawberry, melon, beans, zucchini); fruit photos come from public datasets, not greenhouse photos taken by farmers',
}, indent=2))
print('packaged', len(classes), 'classes into', dst, '| size', round(sum(p.stat().st_size for p in dst.iterdir()) / 1e6), 'MB')
