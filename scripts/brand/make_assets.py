"""Derive CropManager's icons, splash and logos from the official Agricoders master files.

Master files live in brand/ (copied from the Agricoders Brand Template Guidelines pack):
  agricoders-logo-disc.png   master logo, Logo Navy circuit tree inside a white disc (dark backgrounds)
  agricoders-logo-navy.png   master logo, Logo Navy on transparent (light backgrounds)
  cropmanager-glyph.png      CropManager glyph: white sprout in a Leaf Green disc (headers, sidebar, icon circles)
  cropmanager-leaf.png       CropManager app icon mark: the single white leaf of the official 1024 app icon
                             (guide slide 9, "Glyph left, app icon right"), cut from it on transparent

The masters are never redrawn: they are only scaled and placed on flat Agricoders colours.
No gradients and no light greens: the official 1024 app icon sits on a gradient with a light green
highlight, so the same white leaf is placed on flat Leaf Green instead.

    python scripts/brand/make_assets.py
"""
import os
import shutil

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BRAND = os.path.join(ROOT, 'brand')

PINE = (20, 83, 45)
LEAF = (46, 125, 50)
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
_leaf = load('cropmanager-leaf.png')
leaf = _leaf.crop(_leaf.getbbox())
_side = max(leaf.size)
_sq = Image.new('RGBA', (_side, _side), (0, 0, 0, 0))
_sq.alpha_composite(leaf, ((_side - leaf.width) // 2, (_side - leaf.height) // 2))
leaf = _sq  # square, leaf centred, white on transparent


def rounded(im, radius_fraction=0.22):
    """Round the corners of a square icon (browser tabs and home screens)."""
    from PIL import ImageDraw
    n = im.width
    mask = Image.new('L', (n * 4, n * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, n * 4 - 1, n * 4 - 1), int(n * 4 * radius_fraction), fill=255)
    out = im.copy()
    out.putalpha(mask.resize((n, n), Image.LANCZOS))
    return out

# ---- web
for name in ('agricoders-logo-disc.png', 'agricoders-logo-navy.png', 'cropmanager-glyph.png'):
    dst = os.path.join(ROOT, 'client', 'public', 'brand', name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy(os.path.join(BRAND, name), dst)
    print('copied', os.path.relpath(dst, ROOT))
# browser tab, favicon.ico, home screen: the CropManager app icon (white leaf on flat Leaf Green)
tab = lambda n, frac=0.66: rounded(on(LEAF, leaf, n, frac))
save(tab(64), 'client', 'public', 'favicon.png')
save(tab(32), 'client', 'public', 'favicon-32.png')
save(tab(192), 'client', 'public', 'icon-192.png')
save(on(LEAF, leaf, 180, 0.60).convert('RGB'), 'client', 'public', 'apple-touch-icon.png')
# favicon.ico: browsers ask for /favicon.ico by default, whatever the <link> tags say
tab(48).save(os.path.join(ROOT, 'client', 'public', 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])

# in-app product mark (sign-in panel, sidebar, drawer, PDFs): the app icon, rounded, at 256px
save(tab(256, 0.62), 'client', 'public', 'brand', 'cropmanager-icon.png')
save(tab(256, 0.62), 'mobile', 'assets', 'brand', 'cropmanager-icon.png')

# ---- mobile: in-app images
for name in ('agricoders-logo-disc.png', 'cropmanager-glyph.png'):
    dst = os.path.join(ROOT, 'mobile', 'assets', 'brand', name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy(os.path.join(BRAND, name), dst)
    print('copied', os.path.relpath(dst, ROOT))

# ---- mobile: app icon (store and launcher): the white leaf on flat Leaf Green, full bleed (the OS rounds it)
save(on(LEAF, leaf, 1024, 0.56).convert('RGB'), 'mobile', 'assets', 'icon.png')
save(on(LEAF, leaf, 1024, 0.56).convert('RGB'), 'mobile', 'assets', 'favicon.png')
# adaptive icon: foreground inside the 66% safe zone, flat Leaf Green background
save(on(None, leaf, 1024, 0.46), 'mobile', 'assets', 'adaptive-icon.png')
save(Image.new('RGBA', (1024, 1024), LEAF + (255,)), 'mobile', 'assets', 'adaptive-icon-bg.png')
# themed (monochrome) icon: the leaf as a single colour shape on transparent
mono = Image.new('RGBA', leaf.size, (0, 0, 0, 0))
mono.putalpha(leaf.split()[3])
save(on(None, mono, 1024, 0.46), 'mobile', 'assets', 'adaptive-icon-mono.png')

# ---- mobile: splash (Pine, or Night Field in dark mode): the master logo in its white disc
save(on(None, disc, 1024, 1.0), 'mobile', 'assets', 'splash-icon.png')
save(on(None, disc, 1024, 1.0), 'mobile', 'assets', 'splash-icon-dark.png')
