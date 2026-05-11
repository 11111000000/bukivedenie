#!/usr/bin/env python3
"""
Скачать несколько публичных списков русских слов и объединить в configs/names_blacklist.txt
Политика: polite (редкие запросы, retries, backoff), фильтрация по шаблону слов (только русские буквы и дефис).

Использование:
    python scripts/expand_blacklist_from_web.py --out configs/names_blacklist.txt

Добавляет секцию "# AUTO_IMPORTED_FROM_URLS" с датой и списком новых слов (одна запись в строке).
"""
import argparse
import time
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from pathlib import Path
import sys
import re
from datetime import datetime

DEFAULT_URLS = [
    # common russian word lists / stopwords / frequency lists (raw text)
    'https://raw.githubusercontent.com/stopwords-iso/stopwords-ru/master/stopwords-ru.txt',
    'https://raw.githubusercontent.com/danakt/russian-words/master/russian.txt',
    'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/ru/ru_full.txt',
]

WORD_RE = re.compile(r"^[а-яё\-]+$", re.IGNORECASE)


def fetch_url(url, retries=3, wait=1.5):
    last_err = None
    headers = {'User-Agent': 'bukivedenie-blacklist-updater/1.0 (polite)'}
    for attempt in range(1, retries + 1):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=15) as r:
                raw = r.read().decode('utf-8', errors='ignore')
                return raw
        except (HTTPError, URLError) as e:
            last_err = e
            time.sleep(wait * attempt)
        except Exception as e:
            last_err = e
            time.sleep(wait * attempt)
    raise last_err


def extract_words(text):
    out = set()
    for ln in text.splitlines():
        ln = ln.strip().lower()
        if not ln or ln.startswith('#'):
            continue
        # try to extract first token
        tok = ln.split()[0]
        tok = tok.strip().strip('"\'')
        tok = tok.replace('\u00A0', '')
        # normalize ё to ё (already)
        tok = tok.replace('ё', 'ё')
        if WORD_RE.match(tok):
            out.add(tok)
    return out


def load_existing(path: Path):
    if not path.exists():
        return []
    return path.read_text(encoding='utf-8').splitlines()


def write_merged(path: Path, existing_lines, merged_set, source_urls):
    # keep original comments up to first blank line, then append auto section
    header = []
    rest = []
    seen_blank = False
    for ln in existing_lines:
        if not seen_blank and ln.strip() == '':
            seen_blank = True
            header.append(ln)
            continue
        if not seen_blank:
            header.append(ln)
        else:
            rest.append(ln)
    # build new list: keep header, then preserve any manual entries after header, then add AUTO section
    new_lines = header + rest
    new_lines.append('')
    new_lines.append('# AUTO_IMPORTED_FROM_URLS (generated at {})'.format(datetime.utcnow().isoformat() + 'Z'))
    new_lines.append('# Source URLs:')
    for u in source_urls:
        new_lines.append('#   ' + u)
    new_lines.append('# --- begin auto-imported words ---')
    for w in sorted(merged_set):
        new_lines.append(w)
    new_lines.append('# --- end auto-imported words ---')
    path.write_text('\n'.join(new_lines) + '\n', encoding='utf-8')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--out', default='configs/names_blacklist.txt')
    p.add_argument('--urls', nargs='*', default=DEFAULT_URLS)
    p.add_argument('--dry', action='store_true')
    args = p.parse_args()

    out_path = Path(args.out)
    print('Loading existing blacklist from', out_path)
    existing_lines = load_existing(out_path)
    existing_set = set(ln.strip().lower() for ln in existing_lines if ln.strip() and not ln.strip().startswith('#'))

    merged = set()
    for url in args.urls:
        print('Fetching', url)
        try:
            txt = fetch_url(url)
            words = extract_words(txt)
            print(' ->', len(words), 'words from', url)
            merged.update(words)
            time.sleep(1.0)
        except Exception as e:
            print('Failed to fetch', url, '->', e, file=sys.stderr)

    # remove existing set and blacklist typical single-letter tokens
    merged = {w for w in merged if len(w) > 1}
    added = sorted(w for w in merged if w not in existing_set)
    print('Total unique candidates fetched:', len(merged))
    print('New words to add (not present before):', len(added))
    if args.dry:
        for w in added[:100]:
            print(w)
        return

    # write merged file
    write_merged(out_path, existing_lines, merged, args.urls)
    print('Written merged blacklist to', out_path)

if __name__ == '__main__':
    main()
