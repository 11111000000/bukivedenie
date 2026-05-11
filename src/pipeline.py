#!/usr/bin/env python3
"""Pipeline wrapper (refactored from orchestrator.py).
Keep the same public API: run_pipeline(text_id, input_dir, output_dir, use_lemmas)
"""
from pathlib import Path

from .data import find_text_path, ensure_dirs, RAW, PROCESSED, OUTPUTS
from .preprocessing.normalize import normalize_text
from .preprocessing.tokenize import tokenize_text
from .preprocessing.lemmatize import lemmatize_text
from .preprocessing.filter import load_stopwords
from .features.counts import count_tokens
from .extractor.io import write_csv


def run_pipeline(text_id: str,
                 input_dir: Path = RAW,
                 output_dir: Path = OUTPUTS,
                 use_lemmas: bool = True) -> None:
    """Run end-to-end pipeline for a single text_id.

    Writes normalized text to output_dir/processed and counts to output_dir/tables.
    """
    text_path = find_text_path(text_id, input_dir)
    if text_path is None:
        raise FileNotFoundError(f"Text not found: {text_id} in {input_dir}")

    text = Path(text_path).read_text(encoding='utf-8', errors='ignore')
    normalized = normalize_text(text)

    processed_dir = output_dir / 'processed'
    processed_dir.mkdir(parents=True, exist_ok=True)
    normalized_path = processed_dir / f"{text_id}_normalized.txt"
    with open(normalized_path, 'w', encoding='utf-8') as f:
        f.write(normalized)

    tokens = tokenize_text(normalized)
    lemmas = lemmatize_text(tokens, use_lemmas=use_lemmas)
    counts = count_tokens(lemmas)
    total = len(lemmas)

    tables_dir = output_dir / 'tables'
    tables_dir.mkdir(parents=True, exist_ok=True)
    csv_path = tables_dir / f"{text_id}_word_counts.csv"

    # write using extractor.io.write_csv
    records = []
    for term, cnt in sorted(counts.items(), key=lambda kv: kv[1], reverse=True):
        per_1k = (cnt / total * 1000) if total > 0 else 0.0
        records.append({'text_id': text_id, 'term': term, 'count': cnt, 'per_1k': f"{per_1k:.6f}"})
    write_csv(csv_path, records, ['text_id', 'term', 'count', 'per_1k'])

    print(f"✓ Pipeline completed for {text_id}. Normalized: {normalized_path}, Counts: {csv_path}")
