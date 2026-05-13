#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..extractor.chapters import build_chapter_summary
from ..extractor.cooccur import compute_cooccurrence
from ..extractor.config import ExtractorConfig
from ..extractor.core import Chapter, TextPipeline
from ..extractor.io import ensure_dir, load_text_file, write_json
from ..extractor.metrics import (
    compute_complexity_metrics,
    compute_hapax,
    compute_punctuation_counts,
    compute_token_frequencies,
)
from ..extractor.sentiment import compute_sentiment

logger = logging.getLogger(__name__)


def get_book_id(file_path: Path) -> str:
    name = file_path.name
    if name.endswith('.fb2.txt'):
        return name[:-8]
    if name.endswith('.txt'):
        return name[:-4]
    return file_path.stem


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def _book_title_from_path(path: Path) -> str:
    return path.stem


def _raw_books(raw_dir: Path) -> List[Path]:
    seen: set[str] = set()
    items: List[Path] = []
    for path in sorted(raw_dir.rglob('*.txt')):
        book_id = get_book_id(path)
        if book_id in seen:
            continue
        seen.add(book_id)
        items.append(path)
    return items


def _is_path_within(base: Path, candidate: Path) -> bool:
    try:
        candidate.relative_to(base)
        return True
    except ValueError:
        return False


def _chapter_token_rows(chapters: List[Chapter], allowed_tokens: Optional[set[str]] = None) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for chapter in chapters:
        counter: Counter[str] = Counter()
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type != 'word':
                        continue
                    token_key = token.text_lower
                    if allowed_tokens is not None and token_key not in allowed_tokens:
                        continue
                    counter[token_key] += 1
        for token, count in counter.items():
            rows.append({
                'token': token,
                'chapter_idx': chapter.chapter_idx,
                'title': chapter.title,
                'count': count,
            })
    return rows


def _count_summary(chapters_summary: List[Dict[str, Any]], token_freqs: List[Dict[str, Any]], punctuation_counts: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        'chapters': len(chapters_summary),
        'words': sum(int(ch.get('total_words') or 0) for ch in chapters_summary if isinstance(ch, dict)),
        'tokens': len(token_freqs),
        'punctuation_marks': len(punctuation_counts),
    }


def _selected_top_tokens(token_freqs: List[Dict[str, Any]], top_n: int) -> set[str]:
    return {str(row.get('token', '')).strip() for row in token_freqs[:top_n] if str(row.get('token', '')).strip()}


def _book_payload(raw_path: Path, dist_dir: Path, top_n: int = 100, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if options is None:
        options = {'top_n': top_n, 'cooccur': True, 'sentiment': True, 'hapax': True}
    book_id = get_book_id(raw_path)
    raw_text = load_text_file(raw_path)
    config = ExtractorConfig(lang='ru', output_dir=dist_dir)
    pipeline = TextPipeline(config)
    processed = pipeline.process(raw_text, book_id)
    chapters = processed['chapters']

    token_freqs = compute_token_frequencies(chapters)
    chapters_summary = build_chapter_summary(chapters)
    punctuation_counts = compute_punctuation_counts(chapters)
    chapter_stats = compute_complexity_metrics(chapters)
    hapax = compute_hapax(chapters) if options.get('hapax', True) else {'total': 0, 'ratio': 0}
    sentiment = compute_sentiment(chapters, lang='ru', mode='lexicon') if options.get('sentiment', True) else []
    cooccurrence_edges = compute_cooccurrence(chapters, level='sentence', lang='ru') if options.get('cooccur', True) else []
    top_tokens = _selected_top_tokens(token_freqs, top_n)
    token_by_chapter = _chapter_token_rows(chapters, top_tokens)

    summary = _count_summary(chapters_summary, token_freqs, punctuation_counts)
    fragments = [
        {
            'fragment_id': f'chapter-{row.get("chapter_idx", idx)}',
            'chapter_idx': int(row.get('chapter_idx', idx) or idx),
            'title': row.get('title') or f'Chapter {idx + 1}',
            'kind': 'chapter',
            'start_offset': row.get('start_offset'),
            'end_offset': row.get('end_offset'),
            'chars': row.get('total_chars', 0),
            'paragraphs': row.get('total_paragraphs', 0),
            'sentences': row.get('total_sentences', 0),
            'words': row.get('total_words', 0),
            'dialog_sentences': row.get('dialog_sentences', 0),
            'dialog_ratio': row.get('dialog_ratio', 0),
        }
        for idx, row in enumerate(chapters_summary)
    ]

    book_dir = dist_dir / 'books'
    text_dir = dist_dir / 'texts'
    ensure_dir(book_dir)
    ensure_dir(text_dir)
    text_path = text_dir / f'{book_id}.txt'
    text_path.write_text(raw_text, encoding='utf-8')

    payload = {
        'book': book_id,
        'book_id': book_id,
        'title': _book_title_from_path(raw_path),
        'raw_path': str(raw_path),
        'text_path': f'texts/{book_id}.txt',
        'generated_at': _utc_now(),
        'ready': True,
        'status': 'ready',
        'summary': summary,
        'text_index': token_freqs[:top_n],
        'fragments': fragments,
        'punctuation_timeline': punctuation_counts,
        'chapter_stats': chapter_stats,
        'token_by_chapter': token_by_chapter,
        'cooccurrence_edges': cooccurrence_edges,
        'sentiment_by_chapter': sentiment,
        'hapax': hapax,
        'files': [
            'book.json',
            'text.txt',
            'tokens.csv',
            'chapters_summary.json',
            'punctuation_counts.csv',
            'chapter_stats.json',
            'token_by_chapter.csv',
            'cooccurrence_edges.csv',
            'sentiment_by_chapter.csv',
        ],
    }
    return payload


def _write_book(dist_dir: Path, payload: Dict[str, Any]) -> Path:
    book_id = payload['book_id']
    book_dir = ensure_dir(dist_dir / 'books')
    path = book_dir / f'{book_id}.json'
    write_json(path, payload)
    return path


def _write_index(dist_dir: Path, books: List[Dict[str, Any]]) -> Path:
    payload = {
        'generated_at': _utc_now(),
        'books': books,
    }
    path = dist_dir / 'index.json'
    write_json(path, payload)
    return path


def _git_status_porcelain(root: Path) -> List[str]:
    proc = subprocess.run(['git', '-C', str(root), 'status', '--porcelain'], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or 'git status failed')
    return [line for line in proc.stdout.splitlines() if line.strip()]


def _commit_dist(root: Path, dist_dir: Path) -> str:
    status = _git_status_porcelain(root)
    dist_rel = dist_dir.resolve().relative_to(root.resolve())
    outside = []
    for line in status:
        raw_path = line[3:].strip()
        if ' -> ' in raw_path:
            raw_path = raw_path.split(' -> ', 1)[-1]
        path = Path(raw_path)
        if not _is_path_within(dist_rel, path):
            outside.append(line)
    if outside:
        raise RuntimeError('working tree has unrelated changes; refusing to auto-commit')
    subprocess.run(['git', '-C', str(root), 'add', str(dist_dir.relative_to(root))], check=True)
    proc = subprocess.run(['git', '-C', str(root), 'commit', '-m', 'chore(data): generate static dist'], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or 'git commit failed')
    return proc.stdout.strip()


def build_dist(raw_dir: Path, dist_dir: Path, commit: bool = False, top_n: int = 100, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if options is None:
        options = {'top_n': top_n, 'cooccur': True, 'sentiment': True, 'hapax': True}
    ensure_dir(dist_dir)
    books: List[Dict[str, Any]] = []
    for raw_path in _raw_books(raw_dir):
        payload = _book_payload(raw_path, dist_dir, top_n=options.get('top_n', top_n), options=options)
        book_json = _write_book(dist_dir, payload)
        books.append({
            'book_id': payload['book_id'],
            'title': payload['title'],
            'raw_path': str(raw_path.relative_to(raw_dir)),
            'text_path': payload['text_path'],
            'json_path': str(book_json.relative_to(dist_dir)),
            'ready': True,
            'status': 'ready',
            'summary': payload['summary'],
        })
    index_path = _write_index(dist_dir, books)
    result = {'generated_at': _utc_now(), 'index_path': str(index_path), 'books': books}
    if commit:
        result['commit'] = _commit_dist(Path.cwd(), dist_dir)
    return result


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description='Build static data dist from data/raw')
    parser.add_argument('--input', dest='input_dir', default='data/raw')
    parser.add_argument('--out', dest='out_dir', default='data/dist')
    parser.add_argument('--commit', action='store_true')
    parser.add_argument('--top-n', type=int, default=100)
    parser.add_argument('--no-cooccur', action='store_true', help='Skip co-occurrence computation')
    parser.add_argument('--no-sentiment', action='store_true', help='Skip sentiment computation')
    parser.add_argument('--no-hapax', action='store_true', help='Skip hapax computation')
    args = parser.parse_args(argv)

    raw_dir = Path(args.input_dir)
    dist_dir = Path(args.out_dir)
    options = {
        'top_n': args.top_n,
        'cooccur': not args.no_cooccur,
        'sentiment': not args.no_sentiment,
        'hapax': not args.no_hapax,
    }
    result = build_dist(raw_dir=raw_dir, dist_dir=dist_dir, commit=args.commit, options=options)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
