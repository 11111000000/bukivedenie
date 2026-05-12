"""
Download and update gazetteers (Russian wordlist and names) used by NER.

Behavior:
- Try a set of known URLs for Russian wordlists and name lists.
- Merge results into configs/: russian_words.txt and names_whitelist.txt
- Keep backups of previous files as .bak

Run:
    python scripts/update_gazetteers.py

This script is best-effort: it will try multiple sources and keep what it can fetch.
"""
import os
import sys
from pathlib import Path
import urllib.request
import urllib.error
import ssl
import tempfile

ROOT = Path(__file__).parent.parent
CONFIGS = ROOT / 'configs'
CONFIGS.mkdir(parents=True, exist_ok=True)

# Candidate sources (try in order). Each is a tuple (url, type)
# type: 'words' or 'names' or 'stop'
SOURCES = [
    # russian word lists
    ('https://raw.githubusercontent.com/danakt/russian-words/master/russian.txt', 'words'),
    ('https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/ru/ru_full.txt', 'words'),
    ('https://raw.githubusercontent.com/stopwords-iso/stopwords-ru/master/stopwords-ru.txt', 'stop'),

    # first names / given names lists (various repos)
    ('https://raw.githubusercontent.com/araen/russian-names/master/first_names.txt', 'names'),
    ('https://raw.githubusercontent.com/zykov77/fn_ru/master/fn_ru.txt', 'names'),
    ('https://raw.githubusercontent.com/dm-fedorov/firstnames/master/russian-firstnames.txt', 'names'),

    # backup small lists
    ('https://raw.githubusercontent.com/zemirco/regexp-contrib/master/names/ru.txt', 'names'),
]

TIMEOUT = 20

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT, context=ctx) as res:
            if res.status != 200:
                return None
            data = res.read().decode('utf-8', errors='ignore')
            return data
    except Exception as e:
        print(f"Could not fetch {url}: {e}")
        return None


def normalize_lines(data):
    out = set()
    for ln in data.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        # skip comments
        if ln.startswith('#') or ln.startswith('//'):
            continue
        # some files have counts or tabs
        parts = ln.split()
        token = parts[0]
        token = token.strip().lower()
        # keep only letters and hyphen/apostrophe
        token = ''.join(ch for ch in token if ch.isalpha() or ch in "-'")
        if not token:
            continue
        out.add(token)
    return out


def backup(path: Path):
    if path.exists():
        bak = path.with_suffix(path.suffix + '.bak')
        path.replace(bak)
        print(f"Backed up {path} -> {bak}")


def write_sorted(path: Path, items):
    # Write directly into target directory to avoid cross-device replace errors
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        for it in sorted(items):
            f.write(it + '\n')
    print(f"Wrote {len(items)} items to {path}")


def main():
    words = set()
    names = set()
    stops = set()

    for url, typ in SOURCES:
        print('Trying', url)
        data = fetch(url)
        if not data:
            continue
        items = normalize_lines(data)
        if typ == 'words':
            words.update(items)
            print(f'  +{len(items)} words')
        elif typ == 'names':
            names.update(items)
            print(f'  +{len(items)} names')
        elif typ == 'stop':
            stops.update(items)
            print(f'  +{len(items)} stopwords')

    # merge stops into words (they are common words)
    words.update(stops)

    # Merge with existing whitelist if present
    whitelist_path = CONFIGS / 'names_whitelist.txt'
    if whitelist_path.exists():
        existing = set(l.strip().lower() for l in whitelist_path.read_text(encoding='utf-8').splitlines() if l.strip() and not l.strip().startswith('#'))
        names.update(existing)

    # Merge with existing russian_words if present
    words_path = CONFIGS / 'russian_words.txt'
    if words_path.exists():
        existing_w = set(l.strip().lower() for l in words_path.read_text(encoding='utf-8').splitlines() if l.strip() and not l.strip().startswith('#'))
        words.update(existing_w)

    # Write outputs (backup originals)
    if names:
        backup(whitelist_path)
        write_sorted(whitelist_path, names)
    if words:
        words_path = CONFIGS / 'russian_words.txt'
        backup(words_path)
        write_sorted(words_path, words)

    print('\nDone. Sample sizes:')
    print('names:', len(names))
    print('words:', len(words))

    print('\nNotes:')
    print('- The script tried multiple public sources. If nothing was downloaded, check network or update SOURCES list.')

if __name__ == '__main__':
    main()
