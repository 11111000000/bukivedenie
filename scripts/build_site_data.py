#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

BOOK_FILES = [
    'run_metadata.json',
    'chapters_summary.json',
    'complexity_metrics.json',
    'characters.csv',
    'tokens.csv',
    'cooccurrence_edges.csv',
    'sentiment_by_chapter.csv',
    'character_freq_by_chapter.csv',
    'token_freq_by_chapter.csv',
    'punctuation_counts.csv',
    'hapax.csv',
]

OPTIONAL_ROOT_FILES = [
    ('processed', 'processed', ['*.jsonl', '*.txt']),
    ('tables', 'tables', ['*.csv']),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def safe_json(path: Path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return None


def copy_if_exists(src: Path, dst: Path) -> bool:
    if not src.exists() or not src.is_file():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


def copy_glob(src_dir: Path, dst_dir: Path, patterns: list[str]) -> None:
    if not src_dir.exists():
        return
    dst_dir.mkdir(parents=True, exist_ok=True)
    for pattern in patterns:
        for src in sorted(src_dir.glob(pattern)):
            if src.is_file():
                shutil.copy2(src, dst_dir / src.name)


def build_manifest(source_dir: Path, output_dir: Path, include_optional: bool) -> dict:
    books = []
    outputs_dir = output_dir / 'outputs'
    outputs_dir.mkdir(parents=True, exist_ok=True)

    for book_dir in sorted(p for p in source_dir.iterdir() if p.is_dir()):
        if not any((book_dir / file_name).exists() for file_name in BOOK_FILES):
            continue
        copied = []
        target_book_dir = outputs_dir / book_dir.name
        target_book_dir.mkdir(parents=True, exist_ok=True)

        for file_name in BOOK_FILES:
            src = book_dir / file_name
            if copy_if_exists(src, target_book_dir / file_name):
                copied.append(file_name)

        optional_files = []
        if include_optional:
            for rel_dir, dst_name, patterns in OPTIONAL_ROOT_FILES:
                src_dir = source_dir.parent / rel_dir
                dst_dir = output_dir / rel_dir / book_dir.name
                copy_glob(src_dir, dst_dir, [f'{book_dir.name}_*'])
                if dst_dir.exists():
                    for file in sorted(dst_dir.iterdir()):
                        if file.is_file():
                            optional_files.append(f'{rel_dir}/{book_dir.name}/{file.name}')

        metadata = safe_json(book_dir / 'run_metadata.json') or {}
        books.append({
            'id': book_dir.name,
            'title': metadata.get('book_id') or book_dir.name,
            'updated': metadata.get('end_time') or metadata.get('generated_at') or None,
            'files': copied + optional_files,
        })

    manifest = {
        'generated_at': utc_now(),
        'books': books,
    }
    (output_dir / 'index.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description='Build site data from outputs')
    parser.add_argument('--source', default='outputs')
    parser.add_argument('--target', default='site/public/data')
    parser.add_argument('--include-optional', action='store_true')
    args = parser.parse_args()

    source_dir = Path(args.source)
    output_dir = Path(args.target)
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    build_manifest(source_dir=source_dir, output_dir=output_dir, include_optional=args.include_optional)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
