#!/usr/bin/env python3
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.extractor.core import TextPipeline
from src.extractor.config import ExtractorConfig
from src.extractor.io import load_text_file, export_results
from src.extractor.metrics import (
    compute_token_frequencies,
    compute_hapax,
    compute_complexity_metrics,
    compute_punctuation_counts,
)
from src.extractor.chapters import build_chapter_summary
from src.extractor.ner_heuristic import extract_characters, character_freq_by_chapter
from src.extractor.cooccur import compute_cooccurrence
from src.extractor.sentiment import compute_sentiment


def find_texts():
    texts = []
    # prefer data/dist/texts, fallback to data/raw
    dist = ROOT / 'data' / 'dist' / 'texts'
    raw = ROOT / 'data' / 'raw'
    if dist.exists():
        texts.extend(sorted(dist.glob('*.txt')))
    if raw.exists():
        texts.extend(sorted(raw.glob('*.txt')))
    return texts


def process_file(path: Path, out_dir: Path):
    book_id = path.stem
    text = load_text_file(path)
    config = ExtractorConfig(lang='ru', output_dir=out_dir, ner_mode='heuristic', use_lemmas=True, workers=1)
    pipeline = TextPipeline(config)

    start_time = datetime.now()
    processed = pipeline.process(text, book_id)
    chapters = processed.get('chapters', [])

    token_freqs = compute_token_frequencies(chapters, use_lemmas=config.use_lemmas)
    chapters_summary = build_chapter_summary(chapters)
    characters = extract_characters(chapters, lang=config.lang, min_occurrences=2)
    char_freq_by_chapter = character_freq_by_chapter(chapters, lang=config.lang)
    cooccurrence_edges = compute_cooccurrence(chapters, level=config.cooccurrence_level, lang=config.lang) if chapters else []
    sentiment = compute_sentiment(chapters, lang=config.lang, mode=config.sentiment_mode) if config.sentiment_mode != 'off' else []
    hapax = compute_hapax(chapters)
    complexity_metrics = compute_complexity_metrics(chapters)
    punctuation_counts = compute_punctuation_counts(chapters)

    export_results(
        output_dir=out_dir,
        book_id=book_id,
        config=config,
        token_freqs=token_freqs,
        chapters_summary=chapters_summary,
        characters=characters,
        char_freq_by_chapter=char_freq_by_chapter,
        cooccurrence_edges=cooccurrence_edges,
        sentiment=sentiment,
        hapax=hapax,
        complexity_metrics=complexity_metrics,
        punctuation_counts=punctuation_counts,
        start_time=start_time,
        end_time=datetime.now(),
    )


def main():
    out_dir = ROOT / 'outputs'
    texts = find_texts()
    if not texts:
        print('No texts found under data/dist/texts or data/raw')
        return
    print('Found texts:', len(texts))
    for t in texts:
        try:
            print('Processing', t)
            process_file(t, out_dir)
        except Exception as e:
            import traceback
            print('Error processing', t, e)
            traceback.print_exc()

    # After processing, rebuild site data
    try:
        import subprocess
        subprocess.run([sys.executable, 'scripts/build_site_data.py', '--source', str(out_dir), '--target', 'site/public/data'], check=True)
        print('Site data regenerated under site/public/data')
    except Exception as e:
        print('Failed to run build_site_data.py', e)


if __name__ == '__main__':
    main()
