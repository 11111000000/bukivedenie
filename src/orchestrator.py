#!/usr/bin/env python3
"""Unified orchestrator for bukivedenie NN-enabled development.
- End-to-end pipeline: normalization -> tokenization -> (optional) lemmatization -> frequency counts
- Saves normalized text to data/processed as new file (original unchanged)
- Produces CSV table of counts under outputs/tables
"""

from pathlib import Path
import csv
import os

from .data import find_text_path, ensure_dirs
from .preprocessing.normalize import normalize_text
from .preprocessing.tokenize import tokenize_text
from .preprocessing.lemmatize import lemmatize_text
from .preprocessing.filter import load_stopwords
from .features.counts import count_tokens

DEFAULT_INPUT_DIR = 'data/raw'
DEFAULT_OUTPUT_DIR = 'outputs'
DEFAULT_PROCESSED_SUBDIR = 'processed'


def ensure_output_dirs(base_dir: Path):
    (base_dir / 'tables').mkdir(parents=True, exist_ok=True)
    (base_dir / 'processed').mkdir(parents=True, exist_ok=True)


def write_csv_counts(counts: dict, text_id: str, path: Path, total_tokens: int) -> None:
    lines = []
    header = ['text_id', 'term', 'count', 'per_1k']
    lines.append(header)
    for term, count in sorted(counts.items(), key=lambda kv: kv[1], reverse=True):
        per_1k = (count / total_tokens * 1000) if total_tokens > 0 else 0.0
        lines.append([text_id, term, str(count), f"{per_1k:.6f}"])
    with open(path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        for row in lines:
            writer.writerow(row)


def run_pipeline(text_id: str,
                 input_dir: str = DEFAULT_INPUT_DIR,
                 output_dir: str = DEFAULT_OUTPUT_DIR,
                 use_lemmas: bool = True) -> None:
    # 1) locate text
    text_path = find_text_path(text_id, input_dir)
    if text_path is None:
        raise FileNotFoundError(f"Text not found: {text_id} in {input_dir}")

    text = Path(text_path).read_text(encoding='utf-8', errors='ignore')
    # 2) normalize
    normalized = normalize_text(text)
    # 3) save normalized to data/processed as a new file
    processed_dir = Path(input_dir).parents[1]  # desim/bukivedenie
    processed_dir = processed_dir / 'data/processed'
    processed_dir.mkdir(parents=True, exist_ok=True)
    normalized_path = processed_dir / f"{text_id}_normalized.txt"
    with open(normalized_path, 'w', encoding='utf-8') as f:
        f.write(normalized)
    # 4) tokenize
    tokens = tokenize_text(normalized)
    # 5) lemmatize if possible
    lemmas = lemmatize_text(tokens, use_lemmas=use_lemmas)
    # 6) count
    counts = count_tokens(lemmas)
    total = len(lemmas)
    # 7) save counts to CSV
    outputs_dir = Path(input_dir).parents[1] / 'outputs'
    tables_dir = outputs_dir / 'tables'
    tables_dir.mkdir(parents=True, exist_ok=True)
    csv_path = tables_dir / f"{text_id}_word_counts.csv"
    write_csv_counts(counts, text_id, csv_path, total)
    print(f"✓ Pipeline completed for {text_id}. Normalized: {normalized_path}, Counts: {csv_path}")


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m desim.bukivedenie.src.orchestrator <text_id> [--no-lemmas]")
        sys.exit(2)
    text_id = sys.argv[1]
    use_lemmas = True
    if '--no-lemmas' in sys.argv:
        use_lemmas = False
    run_pipeline(text_id, use_lemmas=use_lemmas)
