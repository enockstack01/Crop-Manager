"""Extends the crop-disease ViT-Large (229 classes of mostly leaf photos) with greenhouse FRUIT classes.

New classes: healthy and diseased fruit of the greenhouse crops (tomato, bell pepper, chilli, cucumber, eggplant, strawberry, melon, beans,
zucchini). They are also how the model recognises which crop a fruit photo shows (the class names carry the crop).

Warm start: if the earlier fine-tuned weights (/kaggle/input/crop-vit-large-finetune/model.pt) are attached, they are loaded and the head
is widened (the old 229 rows are kept), then everything is trained a little with old and new photos mixed so the old classes are not
forgotten. Otherwise it starts from the base ViT-Large like the first run did. Prints the old-class accuracy next to the earlier 90.8%.

Reads /kaggle/input/** (the old pack, the earlier weights and the prepared fruit photos from kernel greenhouse-fruit-data); writes /kaggle/working/{model.pt, classes.json, new_classes.json,
meta.json, history.json, per_class.json, data_report.json, train.log}.
"""
import glob
import json
import math
import os
import random
import shutil
import time
from datetime import datetime
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import transforms
from transformers import ViTConfig, ViTForImageClassification

T0 = time.time()
SMOKE = False  # True: a tiny pass through every step to prove the script works
OUT = Path(os.environ.get('OUT_DIR', '/kaggle/working'))
OUT.mkdir(parents=True, exist_ok=True)
IN = Path('/kaggle/input')
LOG = open(OUT / 'train.log', 'a', buffering=1)
BUDGET_S = 8.0 * 3600
random.seed(11)


def log(*a):
    msg = f'[{(time.time() - T0) / 60:6.1f} min] ' + ' '.join(str(x) for x in a)
    print(msg, flush=True)
    LOG.write(msg + '\n')


# ------------------------------------------------------------------ data
old_pack = next((Path(p).parent for p in glob.glob(str(IN / '**' / 'classes.json'), recursive=True) if (Path(p).parent / 'base').is_dir() and (Path(p).parent / 'train').is_dir()), None)
if old_pack is None:
    raise SystemExit('The old training pack (crop-vit-pack) is not attached')
old_classes = json.loads((old_pack / 'classes.json').read_text(encoding='utf-8'))
nc = glob.glob(str(IN / '**' / 'new_classes.json'), recursive=True)
if not nc:
    raise SystemExit('The prepared fruit photos (kernel greenhouse-fruit-data) are not attached')
new_meta = json.loads(Path(nc[0]).read_text(encoding='utf-8'))
new_dir = Path(nc[0]).parent / 'new'
log('fruit photos from', new_dir, '-', len(new_meta), 'classes')
classes = old_classes + [c['class'] for c in new_meta]
N_OLD, N = len(old_classes), len(classes)
log(f'{N_OLD} old + {len(new_meta)} new = {N} classes')


def old_samples(split, cap):
    out = []
    for d in sorted((old_pack / split).iterdir()):
        y = int(d.name[1:])
        ps = sorted(d.glob('*.jpg'))
        if cap:
            random.Random(y).shuffle(ps)
            ps = ps[:cap]
        out += [(p, y) for p in ps]
    return out


def new_samples(split):
    out = []
    for d in sorted((new_dir / split).iterdir()) if (new_dir / split).exists() else []:
        out += [(p, N_OLD + int(d.name[1:])) for p in sorted(d.glob('*.jpg'))]
    return out


OLD_TRAIN_CAP = 3 if SMOKE else 70  # old photos per class kept in the mix when warm starting
warm_path = next(iter(glob.glob(str(IN / '**' / 'model.pt'), recursive=True)), None)
cap = OLD_TRAIN_CAP if warm_path else 120
train_s = old_samples('train', cap) + new_samples('train')
val_s = old_samples('val', 40 if not SMOKE else 2) + new_samples('val')
log(f'warm start: {bool(warm_path)}; {len(train_s)} train / {len(val_s)} val photos')

MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
train_tf = transforms.Compose([
    transforms.RandomResizedCrop(384, scale=(0.6, 1.0)), transforms.RandomHorizontalFlip(), transforms.RandomVerticalFlip(),
    transforms.RandomRotation(360), transforms.RandomPerspective(0.3, p=0.5),
    transforms.ColorJitter(brightness=0.4, contrast=0.3, saturation=0.4, hue=0.05),
    transforms.ToTensor(), transforms.Normalize(MEAN, STD), transforms.RandomErasing(p=0.5, scale=(0.02, 0.15), value='random'),
])
eval_tf = transforms.Compose([transforms.Resize((384, 384)), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])


class Photos(Dataset):
    def __init__(self, s, tf):
        self.s, self.tf = s, tf

    def __len__(self):
        return len(self.s)

    def __getitem__(self, i):
        p, y = self.s[i]
        with Image.open(p) as im:
            return self.tf(im.convert('RGB')), y


dev = 'cuda' if torch.cuda.is_available() else 'cpu'
n_gpu = torch.cuda.device_count()
counts = torch.zeros(N)
for _, y in train_s:
    counts[y] += 1
sampler = WeightedRandomSampler([1.0 / counts[y].item() for _, y in train_s], num_samples=len(train_s), replacement=True)
BATCH = (4 if SMOKE else 16) * max(1, n_gpu)
nw = 0 if SMOKE else min(4, os.cpu_count() or 2)
train_dl = DataLoader(Photos(train_s, train_tf), BATCH, sampler=sampler, num_workers=nw, drop_last=True, persistent_workers=nw > 0, pin_memory=dev == 'cuda')
val_dl = DataLoader(Photos(val_s, eval_tf), BATCH * 2, num_workers=nw, pin_memory=dev == 'cuda')

# ------------------------------------------------------------------ model
base_dir = old_pack / 'base'
cfg = ViTConfig.from_pretrained(str(base_dir))
cfg.num_labels = N
cfg.id2label = {i: c for i, c in enumerate(classes)}
cfg.label2id = {c: i for i, c in enumerate(classes)}
vit = ViTForImageClassification(cfg)
if warm_path:
    sd = torch.load(warm_path, map_location='cpu')
    sd = {k[4:] if k.startswith('vit.') else k: v.float() if v.is_floating_point() else v for k, v in sd.items()}
    w, b = sd['classifier.weight'], sd['classifier.bias']
    nw_, nb_ = torch.zeros(N, w.shape[1]), torch.zeros(N)
    nn.init.normal_(nw_, std=0.02)
    nw_[: w.shape[0]], nb_[: b.shape[0]] = w, b
    sd['classifier.weight'], sd['classifier.bias'] = nw_, nb_
    missing = vit.load_state_dict(sd, strict=False)
    log('warm start loaded; missing/unexpected:', missing.missing_keys[:4], missing.unexpected_keys[:4])
else:
    from safetensors.torch import load_file
    sd = {k: v.float() for k, v in load_file(str(base_dir / 'model.safetensors')).items() if not k.startswith('classifier')}
    vit.load_state_dict(sd, strict=False)
vit.gradient_checkpointing_enable()


class Net(nn.Module):
    def __init__(self, v):
        super().__init__()
        self.vit = v

    def forward(self, x):
        return self.vit(pixel_values=x).logits


net = Net(vit).to(dev)
dp = nn.DataParallel(net) if n_gpu > 1 else net
core = net.vit.vit
blocks = list(core.encoder.layer if hasattr(core, 'encoder') else core.layers)
loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)
scaler = torch.amp.GradScaler(dev, enabled=dev == 'cuda')
AMP = dict(device_type=dev, dtype=torch.float16, enabled=dev == 'cuda')
HEAD_EPOCHS, FT_EPOCHS = (1, 1) if SMOKE else ((1, 5) if warm_path else (3, 7))
LO, HI = (4e-6, 2e-5) if warm_path else (1e-5, 5e-5)


def set_trainable(head_only):
    for p in net.parameters():
        p.requires_grad = not head_only
    for p in net.vit.classifier.parameters():
        p.requires_grad = True


@torch.no_grad()
def evaluate():
    dp.eval()
    lg, ys = [], []
    for x, y in val_dl:
        with torch.autocast(**AMP):
            lg.append(dp(x.to(dev)).float().cpu())
        ys.append(y)
    return torch.cat(lg), torch.cat(ys)


def acc(lg, ys, k=1, mask=None):
    if mask is not None:
        lg, ys = lg[mask], ys[mask]
    return round((lg.topk(k, 1).indices == ys[:, None]).any(1).float().mean().item(), 4) if len(ys) else None


history = []
steps = len(train_dl)
opt = sched = None
for epoch in range(HEAD_EPOCHS + FT_EPOCHS):
    head = epoch < HEAD_EPOCHS
    if epoch == 0:
        set_trainable(True)
        opt = torch.optim.AdamW(net.vit.classifier.parameters(), lr=3e-4 if warm_path else 1e-4, weight_decay=0.01)
    elif epoch == HEAD_EPOCHS:
        set_trainable(False)
        n = len(blocks)
        groups = [{'params': list(core.embeddings.parameters()), 'lr': LO}]
        groups += [{'params': list(bl.parameters()), 'lr': LO + (HI - LO) * i / (n - 1)} for i, bl in enumerate(blocks)]
        groups += [{'params': list(core.layernorm.parameters()), 'lr': HI}, {'params': list(net.vit.classifier.parameters()), 'lr': 1e-4}]
        opt = torch.optim.AdamW(groups, weight_decay=0.05)
        sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=FT_EPOCHS * steps)
    dp.train()
    if head:
        core.eval()
    t0, run = time.time(), 0.0
    for i, (x, y) in enumerate(train_dl):
        x, y = x.to(dev), y.to(dev)
        opt.zero_grad(set_to_none=True)
        with torch.autocast(**AMP):
            loss = loss_fn(dp(x).float(), y)
        scaler.scale(loss).backward()
        scaler.unscale_(opt)
        nn.utils.clip_grad_norm_(net.parameters(), 1.0)
        scaler.step(opt)
        scaler.update()
        if sched:
            sched.step()
        run = 0.98 * run + 0.02 * loss.item() if i else loss.item()
        if i % 50 == 0:
            log(f'epoch {epoch + 1}/{HEAD_EPOCHS + FT_EPOCHS} ({"head" if head else "full"}) step {i}/{steps} loss {run:.3f}')
    lg, ys = evaluate()
    old_m, new_m = ys < N_OLD, ys >= N_OLD
    history.append({'epoch': epoch + 1, 'phase': 'head' if head else 'full', 'val_acc': acc(lg, ys), 'val_top3': acc(lg, ys, 3),
                    'old_classes_acc': acc(lg, ys, 1, old_m), 'new_fruit_classes_acc': acc(lg, ys, 1, new_m), 'secs': round(time.time() - t0)})
    log('EPOCH RESULT', history[-1])
    (OUT / 'history.json').write_text(json.dumps(history))
    if not head and time.time() - T0 > BUDGET_S - (time.time() - t0) * 1.3 and epoch + 1 < HEAD_EPOCHS + FT_EPOCHS:
        log('time budget reached: stopping early and saving')
        break

# ------------------------------------------------------------------ calibration, per-class results, weights
log_t = torch.zeros(1, requires_grad=True)
lbfgs = torch.optim.LBFGS([log_t], lr=0.1, max_iter=60)


def closure():
    lbfgs.zero_grad()
    l = nn.functional.cross_entropy(lg / log_t.exp(), ys)
    l.backward()
    return l


lbfgs.step(closure)
T = float(log_t.exp().clamp(0.3, 5.0).item())
floor = round(float(lg.max(1).values.quantile(0.02)), 4)
pred = lg.argmax(1)
per_class = {classes[c]: {'n': int((ys == c).sum()), 'acc': round(float((pred[ys == c] == c).float().mean()), 3)} for c in range(N) if (ys == c).any()}
torch.save({'vit.' + k: (v.half() if v.is_floating_point() else v) for k, v in net.vit.state_dict().items()}, OUT / 'model.pt')
net.vit.config.save_pretrained(OUT)
(OUT / 'classes.json').write_text(json.dumps(classes, indent=2), encoding='utf-8')
(OUT / 'new_classes.json').write_text(json.dumps(new_meta, indent=2), encoding='utf-8')
meta = {'version': 'vit_kaggle_fruit', 'arch': 'vit', 'base': 'google/vit-large-patch16-384', 'image_size': 384, 'norm': 'imagenet',
        'created': datetime.now().isoformat(timespec='seconds'), 'val_acc': history[-1]['val_acc'], 'val_top3': history[-1]['val_top3'],
        'old_classes_acc': history[-1]['old_classes_acc'], 'new_fruit_classes_acc': history[-1]['new_fruit_classes_acc'],
        'temperature': round(T, 4), 'ood_floor': floor, 'n_train': len(train_s), 'n_val': len(val_s), 'n_classes': N, 'n_old': N_OLD,
        'warm_start': bool(warm_path), 'history': history, 'train_minutes': round((time.time() - T0) / 60)}
(OUT / 'meta.json').write_text(json.dumps(meta, indent=2))
(OUT / 'per_class.json').write_text(json.dumps(per_class, indent=1))
log('DONE', {k: meta[k] for k in ('val_acc', 'val_top3', 'old_classes_acc', 'new_fruit_classes_acc', 'temperature', 'train_minutes')})
