#!/usr/bin/env python3
import json
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import time
import socket
from pathlib import Path
import importlib

# Simple endpoint smoke tests for src.webapp

HOST = '127.0.0.1'
PORT = 8765


def wait_port(host, port, timeout=5.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.2)
            try:
                s.connect((host, port))
                return True
            except Exception:
                time.sleep(0.05)
    return False


def run_server(port=PORT):
    from src.webapp import Handler
    server = ThreadingHTTPServer((HOST, port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


def get_json(path, port=PORT):
    with urlopen(f'http://{HOST}:{port}{path}') as r:
        return json.loads(r.read().decode('utf-8'))


def test_endpoints_basic():
    th = Thread(target=run_server, daemon=True)
    th.start()
    assert wait_port(HOST, PORT), 'server did not start'

    # books should return JSON
    data = get_json('/api/books')
    assert 'books' in data
    assert 'items' in data

    # raw_files returns list
    data = get_json('/api/raw_files')
    assert 'files' in data

    # index should return HTML
    with urlopen(f'http://{HOST}:{PORT}/') as r:
        html = r.read(256).decode('utf-8', errors='ignore')
        assert '<!doctype html>' in html.lower() or '<html' in html.lower()

    # non-existing file should 404 JSON
    try:
        get_json('/api/file?book=__none__&name=missing.txt')
        assert False, 'expected 404'
    except HTTPError as e:
        assert e.code == 404


def test_books_are_sourced_from_raw_and_expose_ready_state(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    raw_dir = tmp_path / 'data' / 'raw'
    outputs_dir = tmp_path / 'outputs'
    (raw_dir / 'nested').mkdir(parents=True)
    (outputs_dir / 'alpha').mkdir(parents=True)
    (raw_dir / 'alpha.txt').write_text('alpha', encoding='utf-8')
    (raw_dir / 'nested' / 'beta.txt').write_text('beta', encoding='utf-8')
    (outputs_dir / 'alpha' / 'tokens.csv').write_text('token,count\nfoo,1\n', encoding='utf-8')

    monkeypatch.setattr(webapp, 'RAW_DIR', raw_dir)
    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', outputs_dir)

    assert webapp.list_books() == ['alpha', 'beta']

    items = webapp.list_book_states()
    assert items == [
        {'book': 'alpha', 'raw': 'alpha.txt', 'ready': True, 'status': 'ready', 'analysis': '/api/run_analysis?raw=alpha.txt'},
        {'book': 'beta', 'raw': 'nested/beta.txt', 'ready': False, 'status': 'pending', 'analysis': '/api/run_analysis?raw=nested/beta.txt'},
    ]


def test_books_endpoint_survives_missing_outputs_dir(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    raw_dir = tmp_path / 'data' / 'raw'
    raw_dir.mkdir(parents=True)
    (raw_dir / 'alpha.txt').write_text('alpha', encoding='utf-8')

    monkeypatch.setattr(webapp, 'RAW_DIR', raw_dir)
    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', tmp_path / 'outputs')

    assert webapp.list_books() == ['alpha']
    assert webapp.list_book_states() == [{'book': 'alpha', 'raw': 'alpha.txt', 'ready': False, 'status': 'pending', 'analysis': '/api/run_analysis?raw=alpha.txt'}]


def test_book_summary_payload_aggregates_existing_outputs(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    outputs_dir = tmp_path / 'outputs'
    book_dir = outputs_dir / 'alpha'
    book_dir.mkdir(parents=True)
    raw_dir = tmp_path / 'data' / 'raw'
    raw_dir.mkdir(parents=True)

    (book_dir / 'tokens.csv').write_text(
        'token,count,rank,per_1k\n'
        'foo,10,1,100.0\n'
        'bar,6,2,60.0\n',
        encoding='utf-8',
    )
    (book_dir / 'chapters_summary.json').write_text(
        json.dumps({'chapters': [
            {'chapter_idx': 0, 'title': 'Intro', 'start_offset': 0, 'end_offset': 40, 'total_chars': 40, 'total_paragraphs': 1, 'total_sentences': 2, 'total_words': 15, 'dialog_sentences': 1, 'dialog_ratio': 0.5},
            {'chapter_idx': 1, 'title': 'Main', 'start_offset': 40, 'end_offset': 90, 'total_chars': 50, 'total_paragraphs': 2, 'total_sentences': 3, 'total_words': 25, 'dialog_sentences': 0, 'dialog_ratio': 0.0},
        ]}, ensure_ascii=False),
        encoding='utf-8',
    )
    (book_dir / 'punctuation_counts.csv').write_text(
        'punct,count,rank,per_1k\n.,12,1,80.0\n" ",3,2,20.0\n',
        encoding='utf-8',
    )
    (raw_dir / 'alpha.txt').write_text('A!B?C.\nD,E—F;G:H…', encoding='utf-8')

    monkeypatch.setattr(webapp, 'RAW_DIR', raw_dir)
    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', outputs_dir)

    port = PORT + 1
    th = Thread(target=run_server, kwargs={'port': port}, daemon=True)
    th.start()
    assert wait_port(HOST, port), 'server did not start'

    data = get_json('/api/book_summary?book=alpha', port=port)
    assert data['book'] == 'alpha'
    assert data['ready'] is True
    assert data['status'] == 'ready'
    assert data['summary'] == {'chapters': 2, 'words': 40, 'tokens': 2, 'punctuation_marks': 2}
    assert data['text_index'] == [
        {'token': 'foo', 'count': 10, 'rank': 1, 'per_1k': 100.0},
        {'token': 'bar', 'count': 6, 'rank': 2, 'per_1k': 60.0},
    ]
    assert data['fragments'] == [
        {
            'fragment_id': 'chapter-0',
            'chapter_idx': 0,
            'title': 'Intro',
            'kind': 'chapter',
            'start_offset': 0,
            'end_offset': 40,
            'chars': 40,
            'paragraphs': 1,
            'sentences': 2,
            'words': 15,
            'dialog_sentences': 1,
            'dialog_ratio': 0.5,
        },
        {
            'fragment_id': 'chapter-1',
            'chapter_idx': 1,
            'title': 'Main',
            'kind': 'chapter',
            'start_offset': 40,
            'end_offset': 90,
            'chars': 50,
            'paragraphs': 2,
            'sentences': 3,
            'words': 25,
            'dialog_sentences': 0,
            'dialog_ratio': 0.0,
        },
    ]
    assert data['punctuation_timeline'] == [
        {'punct': '.', 'count': 12, 'rank': 1, 'per_1k': 80.0},
        {'punct': ' ', 'count': 3, 'rank': 2, 'per_1k': 20.0},
    ]
    assert 'chapters' not in data


def test_book_summary_negative_book_validation(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', tmp_path / 'outputs')
    port = PORT + 4
    th = Thread(target=run_server, kwargs={'port': port}, daemon=True)
    th.start()
    assert wait_port(HOST, port), 'server did not start'

    try:
        get_json('/api/book_summary?book=../oops', port=port)
        assert False, 'expected 400'
    except HTTPError as e:
        assert e.code == 400


def test_book_fragments_and_punctuation_timeline_are_explicit_and_ordered(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    outputs_dir = tmp_path / 'outputs'
    book_dir = outputs_dir / 'alpha'
    book_dir.mkdir(parents=True)
    raw_dir = tmp_path / 'data' / 'raw'
    raw_dir.mkdir(parents=True)

    raw_text = 'A!B?C.\nD,E—F;G:H…'
    (raw_dir / 'alpha.txt').write_text(raw_text, encoding='utf-8')
    (book_dir / 'chapters_summary.json').write_text(
        json.dumps({'chapters': [
            {'chapter_idx': 0, 'title': 'Intro', 'start_offset': 0, 'end_offset': 6, 'total_chars': 6, 'total_paragraphs': 1, 'total_sentences': 1, 'total_words': 3, 'dialog_sentences': 0, 'dialog_ratio': 0.0},
            {'chapter_idx': 1, 'title': 'Body', 'start_offset': 6, 'end_offset': len(raw_text), 'total_chars': len(raw_text) - 6, 'total_paragraphs': 1, 'total_sentences': 1, 'total_words': 3, 'dialog_sentences': 0, 'dialog_ratio': 0.0},
        ]}, ensure_ascii=False),
        encoding='utf-8',
    )

    monkeypatch.setattr(webapp, 'RAW_DIR', raw_dir)
    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', outputs_dir)

    port = PORT + 3
    th = Thread(target=run_server, kwargs={'port': port}, daemon=True)
    th.start()
    assert wait_port(HOST, port), 'server did not start'

    fragments = get_json('/api/book_fragments?book=alpha&offset=0&size=1', port=port)
    assert fragments == {
        'book': 'alpha',
        'offset': 0,
        'size': 1,
        'total': 2,
        'items': [
            {
                'fragment_id': 'chapter-0',
                'chapter_idx': 0,
                'title': 'Intro',
                'kind': 'chapter',
                'start_offset': 0,
                'end_offset': 6,
                'chars': 6,
                'paragraphs': 1,
                'sentences': 1,
                'words': 3,
                'dialog_sentences': 0,
                'dialog_ratio': 0.0,
                'excerpt': 'A!B?C.',
            }
        ],
        'source': str(raw_dir / 'alpha.txt'),
    }

    timeline = get_json('/api/punctuation_timeline?book=alpha&offset=0&size=2', port=port)
    assert timeline['book'] == 'alpha'
    assert timeline['offset'] == 0
    assert timeline['size'] == 2
    assert timeline['total'] == 2
    assert timeline['marks'] == ['.', ',', '—', '?', '!', ':', ';', '…']
    assert timeline['items'] == [
        {
            'idx': 0,
            'title': 'Intro',
            'start_offset': 0,
            'end_offset': 6,
            'total_chars': 6,
            'counts': {'.': 1, ',': 0, '—': 0, '?': 1, '!': 1, ':': 0, ';': 0, '…': 0},
            'total': 3,
        },
        {
            'idx': 1,
            'title': 'Body',
            'start_offset': 6,
            'end_offset': len(raw_text),
            'total_chars': len(raw_text) - 6,
            'counts': {'.': 0, ',': 1, '—': 1, '?': 0, '!': 0, ':': 1, ';': 1, '…': 1},
            'total': 5,
        },
    ]


def test_book_index_uses_stable_page_shape_and_order(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    outputs_dir = tmp_path / 'outputs'
    book_dir = outputs_dir / 'alpha'
    book_dir.mkdir(parents=True)
    raw_dir = tmp_path / 'data' / 'raw'
    raw_dir.mkdir(parents=True)

    (book_dir / 'chapters_summary.json').write_text(
        json.dumps({'chapters': [
            {'chapter_idx': 3, 'title': 'Later', 'start_offset': 90, 'end_offset': 120, 'total_chars': 30, 'total_paragraphs': 1, 'total_sentences': 2, 'total_words': 12},
            {'chapter_idx': 1, 'title': 'First', 'start_offset': 0, 'end_offset': 90, 'total_chars': 90, 'total_paragraphs': 3, 'total_sentences': 5, 'total_words': 40},
        ]}, ensure_ascii=False),
        encoding='utf-8',
    )

    monkeypatch.setattr(webapp, 'RAW_DIR', raw_dir)
    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', outputs_dir)

    port = PORT + 8
    th = Thread(target=run_server, kwargs={'port': port}, daemon=True)
    th.start()
    assert wait_port(HOST, port), 'server did not start'

    index = get_json('/api/book_index?book=alpha&offset=0&size=1', port=port)
    assert index['book'] == 'alpha'
    assert index['offset'] == 0
    assert index['size'] == 1
    assert index['total'] == 2
    assert index['items'] == [
        {
            'fragment_id': 'chapter-3',
            'chapter_idx': 3,
            'title': 'Later',
            'kind': 'chapter',
            'start_offset': 90,
            'end_offset': 120,
            'chars': 30,
            'paragraphs': 1,
            'sentences': 2,
            'words': 12,
            'dialog_sentences': 0,
            'dialog_ratio': 0,
        },
    ]
    assert 'chapters' not in index
    assert 'count' not in index


def test_book_fragments_and_timeline_reject_bad_offsets(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    outputs_dir = tmp_path / 'outputs'
    book_dir = outputs_dir / 'alpha'
    book_dir.mkdir(parents=True)
    raw_dir = tmp_path / 'data' / 'raw'
    raw_dir.mkdir(parents=True)
    (raw_dir / 'alpha.txt').write_text('abc', encoding='utf-8')
    (book_dir / 'chapters_summary.json').write_text(json.dumps({'chapters': []}), encoding='utf-8')

    monkeypatch.setattr(webapp, 'RAW_DIR', raw_dir)
    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', outputs_dir)

    port = PORT + 5
    th = Thread(target=run_server, kwargs={'port': port}, daemon=True)
    th.start()
    assert wait_port(HOST, port), 'server did not start'

    try:
        get_json('/api/book_fragments?book=alpha&offset=oops', port=port)
        assert False, 'expected 400'
    except HTTPError as e:
        assert e.code == 400
    try:
        get_json('/api/punctuation_timeline?book=alpha&offset=oops', port=port)
        assert False, 'expected 400'
    except HTTPError as e:
        assert e.code == 400


def test_file_download_sanitizes_content_disposition_name(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    outputs_dir = tmp_path / 'outputs'
    book_dir = outputs_dir / 'alpha'
    book_dir.mkdir(parents=True)
    (book_dir / 'bad"name.txt').write_text('hello', encoding='utf-8')

    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', outputs_dir)

    port = PORT + 2
    th = Thread(target=run_server, kwargs={'port': port}, daemon=True)
    th.start()
    assert wait_port(HOST, port), 'server did not start'

    with urlopen(f'http://{HOST}:{port}/api/file_download?book=alpha&name=bad%22name.txt') as r:
        assert r.status == 200
        assert r.headers['Content-Disposition'] == 'attachment; filename="bad_name.txt"'


def test_file_download_preserves_plus_in_filename(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    outputs_dir = tmp_path / 'outputs'
    book_dir = outputs_dir / 'alpha'
    book_dir.mkdir(parents=True)
    (book_dir / 'A+B.txt').write_text('hello', encoding='utf-8')

    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', outputs_dir)

    port = PORT + 7
    th = Thread(target=run_server, kwargs={'port': port}, daemon=True)
    th.start()
    assert wait_port(HOST, port), 'server did not start'

    with urlopen(f'http://{HOST}:{port}/api/file_download?book=alpha&name=A%2BB.txt') as r:
        assert r.status == 200
        assert r.headers['Content-Disposition'] == 'attachment; filename="A+B.txt"'


def test_run_analysis_rejects_traversal_and_timeout(tmp_path, monkeypatch):
    webapp = importlib.import_module('src.webapp')
    raw_dir = tmp_path / 'data' / 'raw'
    raw_dir.mkdir(parents=True)
    outputs_dir = tmp_path / 'outputs'
    outputs_dir.mkdir(parents=True)
    (raw_dir / 'alpha.txt').write_text('alpha', encoding='utf-8')
    monkeypatch.setattr(webapp, 'RAW_DIR', raw_dir)
    monkeypatch.setattr(webapp, 'OUTPUTS_DIR', outputs_dir)

    port = PORT + 6
    th = Thread(target=run_server, kwargs={'port': port}, daemon=True)
    th.start()
    assert wait_port(HOST, port), 'server did not start'

    try:
        get_json('/api/run_analysis?raw=%2E%2E%2Falpha.txt', port=port)
        assert False, 'expected 400'
    except HTTPError as e:
        assert e.code == 400

    def fake_run(*args, **kwargs):
        raise webapp.subprocess.TimeoutExpired(cmd=kwargs.get('args') or args[0], timeout=1, output=b'out', stderr=b'err')

    monkeypatch.setattr(webapp.subprocess, 'run', fake_run)
    try:
        get_json('/api/run_analysis?raw=alpha.txt', port=port)
        assert False, 'expected 504'
    except HTTPError as e:
        assert e.code == 504
