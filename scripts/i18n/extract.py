"""Collect the English UI strings of the web and mobile apps (the i18n keys).

    python scripts/i18n/extract.py [out.json]
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

STR = r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\$]|\\.)*)`"
PROPS = r"(?:label|title|subtitle|placeholder|hint|addLabel|emptyTitle|emptyDescription|searchPlaceholder|actionLabel|description|saveLabel|confirmLabel|formTitle|heading|intro|text|sub|unit|name|tip)"
# plain lowercase words that are UI text rather than code
LOWER_OK = {'utilised', 'harvest', 'harvests', 'or', 'total area', 'this month', 'farm', 'records', 'total', 'kg', 'ha',
            'this record', 'hectares', 'acres', 'kg/ha', 'net', 'generated', 'farms', 'fields'}


def _first_arg(src, i):
    """Text of the first argument of the call whose '(' is at src[i]."""
    depth, j, q = 0, i, None
    while j < len(src):
        c = src[j]
        if q:
            if c == '\\':
                j += 2
                continue
            if c == q:
                q = None
        elif c in '\'"`':
            q = c
        elif c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
            if depth == 0:
                return src[i + 1:j]
        elif c == ',' and depth == 1:
            return src[i + 1:j]
        j += 1
    return ''


def collect():
    """Return the sorted list of English UI strings."""
    files = [f for pat in (r'\client\src\**\*.js', r'\client\src\**\*.jsx', r'\mobile\src\**\*.ts', r'\mobile\src\**\*.tsx')
             for f in glob.glob(ROOT + pat, recursive=True)]
    # the currency list holds proper names (US Dollar, Rwandan Franc) that are shown as they are
    files = [f for f in files if '\\i18n\\' not in f and '/i18n/' not in f and 'currencies' not in os.path.basename(f)]
    found = {}

    def add(s):
        s = s.replace("\\'", "'").replace('\\"', '"')
        s = s.strip() if not s.endswith(' ') else s.rstrip()
        if not s or not re.search(r'[A-Za-z]{2,}', s):
            return
        if re.search(r'(fa-|https?:|\.jsx?$|\.tsx?$|^#|^[a-z]+[A-Z_][A-Za-z_]*$|^[a-z_]+$|^[a-z-]+$|/|\\|=>|\(\)|;|@)', s) and '{{' not in s:
            if s not in LOWER_OK:
                return
        found[s] = True

    for f in files:
        src = open(f, encoding='utf8').read()
        for m in re.finditer(r"(?<![\w.])(?:t|translate)\(", src):
            for sm in re.finditer(STR, _first_arg(src, m.end() - 1)):
                add(next(g for g in sm.groups() if g is not None))
        for m in re.finditer(PROPS + r"\s*[:=]\s*\{?\s*(?:" + STR + r")", src):
            g = [x for x in m.groups() if x is not None]
            if g:
                add(g[0])
        for m in re.finditer(r"\[\s*'([A-Z][^'\n]*)',", src):
            add(m.group(1))
        for m in re.finditer(r"(?:toast|confirm)\(\s*(?:" + STR + r")", src):
            g = [x for x in m.groups() if x is not None]
            if g:
                add(g[0])
        for m in re.finditer(r"\[\s*('[A-Z][^'\n]*'(?:\s*,\s*'[^'\n]*')+)\s*,?\s*\]", src):
            for sm in re.finditer(r"'([^'\n]*)'", m.group(1)):
                add(sm.group(1))
        for m in re.finditer(r"(?:^|[{,]\s*)'?([A-Z][A-Za-z ]+)'?\s*:\s*'badge-", src, re.M):
            add(m.group(1))
    return sorted(found)


if __name__ == '__main__':
    keys = collect()
    if len(sys.argv) > 1:
        json.dump(keys, open(sys.argv[1], 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(len(keys), 'strings')
