#!/usr/bin/env python3
"""
Copy site data into site/public/data/

Rules:
- Copy relevant files from outputs/ into site/public/data/lingvistics/<book>/
- If ~/Code/W-and-P exists, copy selected files into site/public/data/war-and-peace/
- Do not modify outputs/ or the external W-and-P repo.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Dict, List


ROOT = Path.cwd()
OUTPUTS = ROOT / "outputs"
TARGET_DATA = ROOT / "site" / "public" / "data"
W_AND_P = Path.home() / "Code" / "W-and-P"


def gather_linguistics(outputs_dir: Path) -> Dict[str, List[Path]]:
    """Return mapping book_id -> list of source Paths to copy.

    Supports both outputs/<book>/ directories and flat files like
    outputs/tokens_<book>.json. Skips hidden and known-ignored dirs.
    """
    mapping: Dict[str, List[Path]] = {}
    if not outputs_dir.exists():
        return mapping

    # Handle directories inside outputs/ (each dir treated as a book)
    for entry in outputs_dir.iterdir():
        if entry.name.startswith('.') or entry.name in ("processed", "tables"):
            continue
        if entry.is_dir():
            book = entry.name
            files = [p for p in entry.rglob('*') if p.is_file()]
            if files:
                mapping.setdefault(book, []).extend(files)

    # Handle flat files like tokens_<book>.json
    for f in outputs_dir.iterdir():
        if not f.is_file():
            continue
        name = f.name
        if name.startswith('.') or name in ("processed", "tables"):
            continue
        # Expect prefix_bookid.ext -> split at first '_'
        if '_' in name:
            _, rest = name.split('_', 1)
            book = rest.rsplit('.', 1)[0]
            mapping.setdefault(book, []).append(f)

    return mapping


def copy_files(sources: List[Path], target_dir: Path) -> int:
    """Copy list of source files into target_dir, preserving filenames.

    Returns number of files copied.
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for src in sources:
        if not src.exists() or not src.is_file():
            continue
        dest = target_dir / src.name
        try:
            shutil.copy2(src, dest)
            count += 1
        except Exception:
            # don't fail the whole script for one bad file
            print(f"Warning: failed to copy {src} -> {dest}")
    return count


def handle_w_and_p(target_root: Path, w_and_p_root: Path) -> int:
    """If W-and-P repo exists, copy selected files into target_root/war-and-peace.

    Copies data/dist/index.json and data/dist/books/*.json when available.
    Returns number of files copied.
    """
    copied = 0
    target = target_root / "war-and-peace"
    if not w_and_p_root.exists():
        return 0

    src_dist = w_and_p_root / 'data' / 'dist'
    if not src_dist.exists():
        print(f"Warning: expected W-and-P data at {src_dist} not found; skipping W-and-P copy")
        return 0

    # Copy index.json if present
    idx = src_dist / 'index.json'
    if idx.exists():
        copied += copy_files([idx], target)

    books_dir = src_dist / 'books'
    if books_dir.exists() and books_dir.is_dir():
        for p in books_dir.iterdir():
            if p.is_file():
                copied += copy_files([p], target)
    else:
        # Some versions may place book files directly in data/dist
        for p in src_dist.iterdir():
            if p.is_file() and p.suffix == '.json' and p.name != 'index.json':
                copied += copy_files([p], target)

    return copied


def build_index(target_root: Path, ling_books: List[str], has_w_and_p: bool) -> None:
    projects = []
    ling = {
        "id": "lingvistics",
        "books": [{"id": b, "path": f"data/lingvistics/{b}/"} for b in sorted(ling_books)]
    }
    projects.append(ling)
    wap_books = [{"id": "war-and-peace", "path": "data/war-and-peace/"}] if has_w_and_p else []
    projects.append({"id": "war-and-peace", "books": wap_books})

    index = {"projects": projects}
    target_root.mkdir(parents=True, exist_ok=True)
    (target_root / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding='utf-8')


def main() -> int:
    TARGET_DATA.mkdir(parents=True, exist_ok=True)

    ling_map = gather_linguistics(OUTPUTS)
    ling_books = sorted(ling_map.keys())

    total_copied = 0
    ling_copied = 0
    for book, files in ling_map.items():
        dest = TARGET_DATA / 'lingvistics' / book
        c = copy_files(files, dest)
        ling_copied += c
        total_copied += c

    wap_copied = handle_w_and_p(TARGET_DATA, W_AND_P)
    total_copied += wap_copied

    # Build index.json describing available projects/books
    build_index(TARGET_DATA, ling_books, wap_copied > 0 or (W_AND_P.exists() and (W_AND_P / 'data' / 'dist').exists()))

    # Summary
    print(f"Copied {ling_copied} files for {len(ling_books)} lingvistics books into {TARGET_DATA / 'lingvistics'}")
    if W_AND_P.exists():
        print(f"W-and-P repo found at {W_AND_P}; copied {wap_copied} files into {TARGET_DATA / 'war-and-peace'}")
    else:
        print("W-and-P repo not found; skipped war-and-peace copy")
    print(f"Total files copied: {total_copied}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
