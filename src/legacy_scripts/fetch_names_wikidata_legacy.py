#!/usr/bin/env python3
"""
Fetch Russian labels of humans from Wikidata SPARQL endpoint and save into configs/names_whitelist.txt

This is a best-effort script. It queries Wikidata for items instance of human (Q5) and retrieves Russian labels.
It may take a while and returns up to a specified limit per request; we page with OFFSET.

Usage:
    python scripts/fetch_names_wikidata.py --limit 50000 --out configs/names_whitelist.txt

Note: be polite to the endpoint (throttle requests).
"""
import argparse
import time
import urllib.parse
import urllib.request
import json
from pathlib import Path

ENDPOINT = 'https://query.wikidata.org/sparql'
HEADERS = {'User-Agent': 'bukivedenie-bot/1.0 (github.com)'}

# SPARQL body without LIMIT/OFFSET; we'll append LIMIT/OFFSET when building query
QUERY_BODY = (
    'SELECT DISTINCT ?label WHERE { '
    '?person wdt:P31 wd:Q5 . '
    '?person rdfs:label ?label . '
    'FILTER(LANG(?label) = "ru") '
    '}'
)


def fetch_page(limit, offset, wait=1.0):
    q = QUERY_BODY + f' LIMIT {limit} OFFSET {offset}'
    params = {'query': q, 'format': 'json'}
    url = ENDPOINT + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            text = res.read().decode('utf-8')
            data = json.loads(text)
            bindings = data.get('results', {}).get('bindings', [])
            labels = [b['label']['value'] for b in bindings if 'label' in b]
            time.sleep(wait)
            return labels
    except Exception as e:
        print('Error fetching page:', e)
        return []


def normalize_label(label):
    # keep letters, spaces and hyphens; lowercased
    out = ''.join(ch for ch in label if ch.isalpha() or ch in " -'")
    return out.strip().lower()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--limit', type=int, default=50000)
    p.add_argument('--max-pages', type=int, default=10)
    p.add_argument('--out', type=str, default='configs/names_whitelist.txt')
    p.add_argument('--wait', type=float, default=1.0)
    args = p.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    collected = set()
    offset = 0
    for page in range(args.max_pages):
        print(f'Fetching page {page+1} (limit={args.limit} offset={offset})')
        labels = fetch_page(args.limit, offset, wait=args.wait)
        if not labels:
            print('No labels returned, stopping')
            break
        for lab in labels:
            nl = normalize_label(lab)
            if nl:
                collected.add(nl)
        offset += args.limit
        # stop if fewer than limit returned
        if len(labels) < args.limit:
            break

    # merge with existing file if exists
    if out_path.exists():
        existing = set(l.strip().lower() for l in out_path.read_text(encoding='utf-8').splitlines() if l.strip() and not l.strip().startswith('#'))
        collected.update(existing)

    print(f'Collected {len(collected)} unique labels')
    # write
    with open(out_path, 'w', encoding='utf-8') as f:
        for name in sorted(collected):
            f.write(name + '\n')
    print('Saved to', out_path)

if __name__ == '__main__':
    main()
