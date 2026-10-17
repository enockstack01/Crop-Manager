"""Agricoders writing rules for the English interface text.

The English text is the i18n key, so the source keeps whatever form is convenient
(and the stored data values such as "Ready for Harvest" stay as they are). This
module turns each key into the branded display text:

  - sentence case titles and labels (guide section 7.2), keeping product and proper names
  - British spelling: fertiliser, utilisation, organise, labour, centre (guide section 7.2)

build.py writes the result to client/src/i18n/locales/en.json and mobile/src/i18n/locales/en.json.
"""
import re

# written exactly like this wherever they appear
PROPER = {
    'CropManager', 'LivestockPro', 'Agriplan', 'Agricoders', 'Logistack', 'Google', 'Clerk', 'Android', 'iOS',
    'Kinyarwanda', 'Swahili', 'French', 'English', 'Anthropic', 'Claude', 'Rwanda', 'Zambia',
}
PROPER_PHRASES = ['One Health']
ABBREVIATIONS = {'prod', 'exp', 'qty', 'avg', 'est', 'approx', 'max', 'min', 'no', 'vs', 'e.g', 'i.e'}

UK = [
    (r'\bfertiliz', 'fertilis'), (r'\bFertiliz', 'Fertilis'),
    (r'\butiliz', 'utilis'), (r'\bUtiliz', 'Utilis'),
    (r'\borganiz', 'organis'), (r'\bOrganiz', 'Organis'),
    (r'\banalyz', 'analys'), (r'\bAnalyz', 'Analys'),
    (r'\bcolor', 'colour'), (r'\bColor', 'Colour'),
    (r'\bcenter\b', 'centre'), (r'\bCenter\b', 'Centre'),
    (r'\blabor\b', 'labour'), (r'\bLabor\b', 'Labour'),
    (r'\bdigitiz', 'digitis'), (r'\bDigitiz', 'Digitis'),
]

WORD = re.compile(r"[A-Za-z][A-Za-z'’]*")
PLACEHOLDER = re.compile(r'\{\{[^}]*\}\}')
MARK = ''  # private-use character that stands in for a protected placeholder


def british(s):
    for a, b in UK:
        s = re.sub(a, b, s)
    return s


def _sentence_case(seg):
    """A capital only on the first word of each sentence; other plain Capitalised words are lowercased.
    Fragments that start in lowercase (units, 'in 3 days') are left alone."""
    if not seg[:1].isupper():
        return seg
    holders = []

    def hold(m):
        holders.append(m.group(0))
        return f'{MARK}{len(holders) - 1}{MARK}'

    seg = PLACEHOLDER.sub(hold, seg)
    out, pos = [], 0
    first = not seg.startswith(MARK)  # a leading {{placeholder}} means the text continues a sentence
    prev_word = ''
    for m in WORD.finditer(seg):
        w = m.group(0)
        gap = seg[pos:m.start()]
        out.append(gap)
        pos = m.end()
        # a new sentence starts after ? or !, or after a full stop that is not an abbreviation (Prod. Exp. Qty.)
        if re.search(r'[?!]\s+$', gap) or (re.search(r'\.\s+$', gap) and prev_word.lower() not in ABBREVIATIONS):
            first = True
        keep = (
            w in PROPER
            or (len(w) >= 2 and w.isupper())
            or (len(w) == 1 and w.isupper())
            or re.search(r'[A-Z]', w[1:])  # internal capitals: pH, iOS, CropManager
        )
        if first:
            w = w[0].upper() + w[1:]
            first = False
        elif not keep and w[0].isupper() and w[1:].islower():
            w = w[0].lower() + w[1:]
        out.append(w)
        prev_word = w
    out.append(seg[pos:])
    text = ''.join(out)
    return re.sub(f'{MARK}(\\d+){MARK}', lambda m: holders[int(m.group(1))], text)


def sentence_case(s):
    if s.startswith('e.g.') or s.startswith('+') or not re.search(r'[A-Za-z]', s):
        return s
    keep = {}
    for i, phrase in enumerate(PROPER_PHRASES):
        if phrase in s:
            token = f'{MARK}P{i}{MARK}'
            keep[token] = phrase
            s = s.replace(phrase, token)
    s = _sentence_case(s)  # a middle dot separates items on one line; only the first word takes a capital
    for token, phrase in keep.items():
        s = s.replace(token, phrase)
    return s


def brand(s):
    return british(sentence_case(s))


def overrides(keys):
    """{English key: branded text} for every key whose branded text differs."""
    return {k: brand(k) for k in keys if brand(k) != k}
