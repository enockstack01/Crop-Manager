"""Derive CropManager's icons, splash and logos from the official Agricoders master files.

Master files live in brand/ (copied from the Agricoders Brand Template Guidelines pack):
  agricoders-logo-disc.png   master logo, Logo Navy circuit tree inside a white disc (dark backgrounds)
  agricoders-logo-navy.png   master logo, Logo Navy on transparent (light backgrounds)
  cropmanager-glyph.png      CropManager glyph: white sprout in a Leaf Green disc

The masters are never redrawn: they are only scaled and placed on flat Agricoders colours.
No gradients and no light greens: the official 1024 app icon has a light green highlight, so the
app icon here is the glyph on White instead.

    python scripts/brand/make_assets.py
"""
import os
import shutil

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BRAND = os.path.join(ROOT, 'brand')

PINE = (20, 83, 45)
NIGHT = (15, 31, 20)
WHITE = (255, 255, 255)


def load(name):
    return Image.open(os.path.join(BRAND, name)).convert('RGBA')


def crisp(im, size):
    """Scale a flat-colour mark up or down and keep its edges sharp."""
    im = im.resize((size, size), Image.LANCZOS)
    r, g, b, a = im.split()
    # sharpen the anti-aliased edge: push alpha towards 0 or 255
    a = a.point(lambda v: 0 if v < 40 else 255 if v > 215 else int((v - 40) * 255 / 175))
    return Image.merge('RGBA', (r, g, b, a))


def on(bg, mark, canvas, fraction):
    """Place `mark` centred on a flat `bg` canvas, taking `fraction` of its width."""
    base = Image.new('RGBA', (canvas, canvas), bg + (255,) if bg else (0, 0, 0, 0))
    size = int(canvas * fraction)
    m = crisp(mark, size)
    base.alpha_composite(m, ((canvas - size) // 2, (canvas - size) // 2))
    return base


def save(im, *path):
    p = os.path.join(ROOT, *path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)
    print('wrote', os.path.relpath(p, ROOT))


glyph = load('cropmanager-glyph.png')
disc = load('agricoders-logo-disc.png')
navy = load('agricoders-logo-navy.png')

# ---- web
for name in ('agricoders-logo-disc.png', 'agricoders-logo-navy.png', 'cropmanager-glyph.png'):
    dst = os.path.join(ROOT, 'client', 'public', 'brand', name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy(os.path.join(BRAND, name), dst)
    print('copied', os.path.relpath(dst, ROOT))
save(crisp(glyph, 64), 'client', 'public', 'favicon.png')

# ---- mobile: in-app images
for name in ('agricoders-logo-disc.png', 'cropmanager-glyph.png'):
    dst = os.path.join(ROOT, 'mobile', 'assets', 'brand', name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy(os.path.join(BRAND, name), dst)
    print('copied', os.path.relpath(dst, ROOT))

# ---- mobile: app icon (store and launcher): the glyph on white
save(on(WHITE, glyph, 1024, 0.80).convert('RGB'), 'mobile', 'assets', 'icon.png')
save(on(WHITE, glyph, 1024, 0.80), 'mobile', 'assets', 'favicon.png')
# adaptive icon: foreground inside the 66% safe zone, flat white background
save(on(None, glyph, 1024, 0.62), 'mobile', 'assets', 'adaptive-icon.png')
save(Image.new('RGBA', (1024, 1024), WHITE + (255,)), 'mobile', 'assets', 'adaptive-icon-bg.png')
# themed (monochrome) icon: the sprout as a single colour shape on transparent
sprout = Image.new('RGBA', glyph.size, (0, 0, 0, 0))
px, out = glyph.load(), sprout.load()
for y in range(glyph.height):
    for x in range(glyph.width):
        r, g, b, a = px[x, y]
        if a > 0 and r > 200 and g > 200 and b > 200:  # the white sprout inside the disc
            out[x, y] = (0, 0, 0, a)
save(on(None, sprout, 1024, 0.62), 'mobile', 'assets', 'adaptive-icon-mono.png')

# ---- mobile: splash (Pine, or Night Field in dark mode): the master logo in its white disc
save(on(None, disc, 1024, 1.0), 'mobile', 'assets', 'splash-icon.png')
save(on(None, disc, 1024, 1.0), 'mobile', 'assets', 'splash-icon-dark.png')
