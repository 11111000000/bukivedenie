#!/usr/bin/env python3
import json
from pathlib import Path
from src.extractor.core import TextPipeline
from src.extractor.config import ExtractorConfig
from src.extractor.io import write_json, ensure_dir, load_text_file
from src.extractor.metrics import compute_token_frequencies, compute_hapax
from src.extractor.ner_heuristic import extract_characters, character_freq_by_chapter


OUTDIR = Path('outputs/war_and_peace')
OUTDIR.mkdir(parents=True, exist_ok=True)

SRC = Path.home() / 'Code' / 'W-and-P'
patterns = ['tolstoj_lew_nikolaewich-text_*.txt', 'tolstoj_lew_nikolaewich-text_*.fb2']

results = {}
errors = {}

files = []
for p in patterns:
    files.extend(sorted(SRC.glob(p)))

for f in files:
    stem = f.stem
    try:
        text = load_text_file(f)
        config = ExtractorConfig(lang='ru', output_dir=OUTDIR, ner_mode='heuristic', use_lemmas=False)
        pipeline = TextPipeline(config)
        processed = pipeline.process(text, stem)

        chapters = processed.get('chapters', [])

        token_freqs = compute_token_frequencies(chapters, use_lemmas=False)
        hapax = compute_hapax(chapters)
        chars = extract_characters(chapters, lang='ru', min_occurrences=2)
        char_by = character_freq_by_chapter(chapters, lang='ru')

        write_json(OUTDIR / f'processed_{stem}.json', {'total_sentences': processed.get('total_sentences'), 'total_paragraphs': processed.get('total_paragraphs'), 'total_chars': processed.get('total_chars'), 'chapters': len(chapters)})
        write_json(OUTDIR / f'tokens_{stem}.json', token_freqs)
        write_json(OUTDIR / f'hapax_{stem}.json', hapax)
        write_json(OUTDIR / f'characters_{stem}.json', chars)
        write_json(OUTDIR / f'char_by_chapter_{stem}.json', char_by)

        results[str(f)] = {
            'processed': str(OUTDIR / f'processed_{stem}.json'),
            'tokens': str(OUTDIR / f'tokens_{stem}.json'),
            'hapax': str(OUTDIR / f'hapax_{stem}.json'),
            'characters': str(OUTDIR / f'characters_{stem}.json'),
            'char_by_chapter': str(OUTDIR / f'char_by_chapter_{stem}.json'),
            'chapters': len(chapters),
            'characters_count': len(chars),
        }
        print('OK', f)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        errors[str(f)] = tb
        print('ERROR', f, e)

summary = {'results': results, 'errors': errors}
print(json.dumps(summary, ensure_ascii=False, indent=2))
