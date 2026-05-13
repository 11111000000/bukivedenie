#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description='Build War and Peace site data')
    parser.add_argument('--source', default='data/dist')
    parser.add_argument('--target', default='site/public/data/war-and-peace')
    args = parser.parse_args()

    source_dir = Path(args.source)
    target_dir = Path(args.target)
    books_dir = source_dir / 'books'
    index_path = source_dir / 'index.json'

    if target_dir.exists():
        shutil.rmtree(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    index = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {'books': []}
    items = []

    for entry in index.get('books', []):
      book_id = entry.get('book_id')
      if not book_id:
        continue
      src = books_dir / f'{book_id}.json'
      if not src.exists():
        continue
      shutil.copy2(src, target_dir / f'{book_id}.json')
      items.append({
        'id': book_id,
        'title': entry.get('title') or book_id,
        'summary': entry.get('summary') or {},
      })

    (target_dir / 'index.json').write_text(json.dumps({'generated_from': str(index_path), 'books': items}, ensure_ascii=False, indent=2), encoding='utf-8')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
