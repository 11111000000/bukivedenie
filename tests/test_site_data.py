import json
from pathlib import Path


def test_build_site_data_manifest(tmp_path):
    from scripts.build_site_data import build_manifest

    source = tmp_path / 'outputs'
    target = tmp_path / 'site' / 'public' / 'data'
    book = source / 'alpha'
    book.mkdir(parents=True)
    (book / 'run_metadata.json').write_text(json.dumps({'book_id': 'alpha', 'end_time': '2026-05-13T00:00:00Z'}), encoding='utf-8')
    (book / 'tokens.csv').write_text('token,count\na,10\n', encoding='utf-8')
    (book / 'chapters_summary.json').write_text(json.dumps([{'chapter_idx': 1, 'total_words': 10, 'total_sentences': 1, 'dialog_ratio': 0.2}]), encoding='utf-8')
    (book / 'complexity_metrics.json').write_text(json.dumps({'total_words': 10, 'unique_words': 5}), encoding='utf-8')
    (book / 'characters.csv').write_text('name,occurrences\nИван,3\n', encoding='utf-8')
    (book / 'cooccurrence_edges.csv').write_text('source,target,weight\nИван,Мария,2\n', encoding='utf-8')
    (book / 'sentiment_by_chapter.csv').write_text('chapter_idx,avg_score\n1,0.3\n', encoding='utf-8')
    (book / 'character_freq_by_chapter.csv').write_text('name,chapter_idx,count\nИван,1,3\n', encoding='utf-8')
    (book / 'hapax.csv').write_text('token,count\na,1\n', encoding='utf-8')
    (book / 'punctuation_counts.csv').write_text('punct,count\n.,2\n', encoding='utf-8')

    manifest = build_manifest(source_dir=source, output_dir=target, include_optional=False)

    index_path = target / 'index.json'
    book_path = target / 'outputs' / 'alpha' / 'tokens.csv'

    assert index_path.exists()
    assert book_path.exists()
    payload = json.loads(index_path.read_text(encoding='utf-8'))
    assert payload['books'][0]['id'] == 'alpha'
    assert payload['books'][0]['updated'] == '2026-05-13T00:00:00Z'
    assert 'tokens.csv' in payload['books'][0]['files']
    assert manifest['books'][0]['id'] == 'alpha'
    assert payload['books'][0]['files'][:2] == ['run_metadata.json', 'chapters_summary.json']
