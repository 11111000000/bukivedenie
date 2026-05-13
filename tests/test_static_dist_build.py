import json
from pathlib import Path


def test_static_dist_schema_and_files(tmp_path, monkeypatch):
    from src.static_dist.build_dist import build_dist

    root = tmp_path
    raw_dir = root / 'data' / 'raw'
    out_dir = root / 'data' / 'dist'
    raw_dir.mkdir(parents=True)
    (raw_dir / 'alpha.txt').write_text('Глава 1\n\nХороший день. Плохой день.', encoding='utf-8')

    result = build_dist(raw_dir=raw_dir, dist_dir=out_dir, commit=False)

    index_path = out_dir / 'index.json'
    book_path = out_dir / 'books' / 'alpha.json'
    text_path = out_dir / 'texts' / 'alpha.txt'

    assert index_path.exists()
    assert book_path.exists()
    assert text_path.exists()

    index = json.loads(index_path.read_text(encoding='utf-8'))
    book = json.loads(book_path.read_text(encoding='utf-8'))

    assert result['index_path'] == str(index_path)
    assert result['books'][0]['json_path'] == 'books/alpha.json'
    assert index['books'][0]['json_path'] == 'books/alpha.json'
    assert index['books'][0]['book_id'] == 'alpha'
    assert index['books'][0]['text_path'] == 'texts/alpha.txt'
    assert index['books'][0]['ready'] is True
    assert index['books'][0]['status'] == 'ready'
    assert index['books'][0]['summary']['chapters'] >= 1
    assert book['book_id'] == 'alpha'
    assert book['book'] == 'alpha'
    assert book['text_path'] == 'texts/alpha.txt'
    assert book['ready'] is True
    assert book['status'] == 'ready'
    assert book['summary']['chapters'] >= 1
    assert isinstance(book['text_index'], list) and book['text_index']
    assert isinstance(book['fragments'], list) and book['fragments']
    assert isinstance(book['punctuation_timeline'], list)
    assert isinstance(book['chapter_stats'], dict)
    assert isinstance(book['token_by_chapter'], list)
    assert isinstance(book['cooccurrence_edges'], list)
    assert isinstance(book['sentiment_by_chapter'], list)
    assert isinstance(book['files'], list)
    assert 'generated_at' in book
    assert result['books'][0]['book_id'] == 'alpha'
