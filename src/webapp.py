#!/usr/bin/env python3
"""
Простой HTTP сервер для просмотра исходного текста и результатов анализа через localhost.
Запуск:
    python -m src.webapp --host 127.0.0.1 --port 8000

Откройте в браузере: http://127.0.0.1:8000/
"""

import argparse
import html
import json
import os
from http import HTTPStatus
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote_plus
import json as _json
import subprocess
import sys

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
OUTPUTS_DIR = PROJECT_ROOT / 'outputs'
RAW_DIR = PROJECT_ROOT / 'data' / 'raw'
WEB_ROOT = Path(__file__).parent / 'web_view'

# Known external raw path for Chekhov sample (if present on device)
ALT_CHEKHOV_PATH = Path('/storage/emulated/0/Documents/чехов-письмо.txt')


def list_books():
    if not OUTPUTS_DIR.exists():
        return []
    return sorted([p.name for p in OUTPUTS_DIR.iterdir() if p.is_dir()])


def list_files(book: str):
    book_dir = OUTPUTS_DIR / book
    if not book_dir.exists() or not book_dir.is_dir():
        return []
    return sorted([p.name for p in book_dir.iterdir() if p.is_file()])


def list_raw_files():
    """Return raw files; include ALT_CHEKHOV_PATH if present (adds it as 'чехов-письмо.txt' logical name).
    If RAW_DIR contains a file with the same name, prefer that one.
    """
    files = []
    if RAW_DIR.exists():
        files = sorted([p.name for p in RAW_DIR.iterdir() if p.is_file() and p.suffix.lower() in ('.txt',)])
    # If an external Chekhov file exists, ensure it's listed (logical name)
    try:
        if ALT_CHEKHOV_PATH.exists():
            logical = 'чехов-письмо.txt'
            if logical not in files:
                files = [logical] + files
    except Exception:
        pass
    return files


def safe_join(base: Path, name: str) -> Path:
    # Prevent path traversal
    target = (base / name).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise ValueError('Invalid path')
    return target


class Handler(BaseHTTPRequestHandler):
    def _json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _text(self, text, status=200, content_type='text/plain; charset=utf-8'):
        data = text.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
            # static prefix: serve files from src/web_view under /static/
            
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        try:
            if path in ('/', '/index.html'):
                # serve the SPA
                idx = WEB_ROOT / 'index.html'
                if not idx.exists():
                    return self._text('Index not found', status=404)
                with open(idx, 'r', encoding='utf-8') as f:
                    content = f.read()
                # Inject raw files options into HTML to support static viewing without JS API
                try:
                    raws = list_raw_files()
                    options_html = ''
                    for name in raws:
                        safe = html.escape(name)
                        options_html += f'<option value="{safe}">{safe}</option>'
                    content = content.replace('<!-- RAW_OPTIONS -->', options_html)
                except Exception:
                    pass
                return self._text(content, content_type='text/html; charset=utf-8')

            if path == '/api/books':
                books = list_books()
                return self._json({'books': books})

            if path == '/api/files':
                book = qs.get('book', [''])[0]
                if not book:
                    return self._json({'error': 'book param required'}, status=400)
                files = list_files(book)
                return self._json({'book': book, 'files': files})

            if path == '/api/file':
                book = qs.get('book', [''])[0]
                name = qs.get('name', [''])[0]
                if not book or not name:
                    return self._json({'error': 'book and name params required'}, status=400)
                # safe join
                file_path = safe_join(OUTPUTS_DIR / book, unquote_plus(name))
                if not file_path.exists():
                    return self._json({'error': 'file not found'}, status=404)
                # read text
                try:
                    text = file_path.read_text(encoding='utf-8')
                except Exception as e:
                    return self._json({'error': f'cannot read file: {e}'}, status=500)
                # Return as JSON with metadata and content
                return self._json({'book': book, 'name': name, 'content': text})

            if path == '/api/file_json':
                # Return CSV parsed into JSON array of objects (or raw text for non-CSV)
                book = qs.get('book', [''])[0]
                name = qs.get('name', [''])[0]
                if not book or not name:
                    return self._json({'error': 'book and name params required'}, status=400)
                file_path = safe_join(OUTPUTS_DIR / book, unquote_plus(name))
                if not file_path.exists():
                    return self._json({'error': 'file not found'}, status=404)
                try:
                    import csv
                    text = file_path.read_text(encoding='utf-8')
                    if name.lower().endswith('.csv'):
                        # parse CSV robustly
                        rows = []
                        reader = csv.DictReader(text.splitlines())
                        for row in reader:
                            rows.append(row)
                        return self._json({'book': book, 'name': name, 'rows': rows})
                    else:
                        return self._json({'book': book, 'name': name, 'content': text})
                except Exception as e:
                    return self._json({'error': f'cannot parse file: {e}'}, status=500)

            if path == '/api/file_download':
                book = qs.get('book', [''])[0]
                name = qs.get('name', [''])[0]
                if not book or not name:
                    return self._json({'error': 'book and name params required'}, status=400)
                file_path = safe_join(OUTPUTS_DIR / book, unquote_plus(name))
                if not file_path.exists():
                    return self._json({'error': 'file not found'}, status=404)
                try:
                    data = file_path.read_bytes()
                except Exception as e:
                    return self._json({'error': f'cannot read file: {e}'}, status=500)
                # serve as attachment (sanitize filename)
                try:
                    safe_name = os.path.basename(unquote_plus(name))
                    # basic sanitization: remove double quotes and control chars
                    safe_name = ''.join(ch for ch in safe_name if ord(ch) >= 32 and ch != '"')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/octet-stream')
                    self.send_header('Content-Disposition', f'attachment; filename="{safe_name}"')
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
                except Exception as e:
                    return self._json({'error': f'cannot send file: {e}'}, status=500)

            if path == '/api/run_analysis':
                # Trigger analysis for a selected raw file and return list of created files
                raw_name = qs.get('raw', [''])[0]
                if not raw_name:
                    return self._json({'error': 'raw param required'}, status=400)
                try:
                    # If raw is the logical 'чехов-письмо.txt' and physical ALT_CHEKHOV_PATH exists, use it
                    if raw_name == 'чехов-письмо.txt' and ALT_CHEKHOV_PATH.exists():
                        raw_path = ALT_CHEKHOV_PATH
                    else:
                        raw_path = safe_join(RAW_DIR, unquote_plus(raw_name))
                    if not raw_path.exists():
                        return self._json({'error': 'raw file not found'}, status=404)

                    # Run analyze_text.py script on this raw file
                    script = PROJECT_ROOT / 'src' / 'analyze_text.py'
                    cmd = [sys.executable, str(script), 'analyze', '--input', str(raw_path), '--output-dir', str(OUTPUTS_DIR), '--lang', 'ru']
                    # Run subprocess synchronously and capture output
                    # NOTE: consider making this asynchronous in future (job queue)
                    proc = subprocess.run(cmd, capture_output=True, timeout=300)
                    # sanitize stdout/stderr to valid utf-8 strings
                    stdout = proc.stdout.decode('utf-8', errors='replace') if proc.stdout is not None else ''
                    stderr = proc.stderr.decode('utf-8', errors='replace') if proc.stderr is not None else ''
                    # cap outputs to reasonable size
                    MAX_OUT = 200000
                    if len(stdout) > MAX_OUT:
                        stdout = stdout[-MAX_OUT:]
                    if len(stderr) > MAX_OUT:
                        stderr = stderr[-MAX_OUT:]
                    if proc.returncode != 0:
                        # return sanitized stderr inside JSON
                        return self._json({'error': 'analysis failed', 'stderr': stderr, 'stdout': stdout}, status=500)
                    # After run, list created files for the book
                    # Book id is filename without extension
                    book_id = raw_path.stem
                    files = list_files(book_id)
                    return self._json({'book': book_id, 'files': files, 'stdout': stdout, 'stderr': stderr})
                except subprocess.TimeoutExpired as e:
                    return self._json({'error': 'analysis timed out', 'stdout': '', 'stderr': 'TimeoutExpired'}, status=500)
                except Exception as e:
                    return self._json({'error': str(e)}, status=500)

            if path == '/api/raw_files':
                raws = list_raw_files()
                return self._json({'files': raws})

            if path == '/api/raw':
                name = qs.get('name', [''])[0]
                if not name:
                    return self._json({'error': 'name param required'}, status=400)
                # Prefer RAW_DIR copy if exists; else allow ALT_CHEKHOV_PATH for logical name
                candidate = RAW_DIR / unquote_plus(name)
                if candidate.exists():
                    file_path = candidate
                elif name == 'чехов-письмо.txt' and ALT_CHEKHOV_PATH.exists():
                    file_path = ALT_CHEKHOV_PATH
                else:
                    return self._json({'error': 'raw file not found'}, status=404)
                try:
                    text = file_path.read_text(encoding='utf-8')
                except Exception as e:
                    return self._json({'error': f'cannot read raw file: {e}'}, status=500)
                return self._json({'name': name, 'content': text})

            # static files for web_view
            if path.startswith('/static/'):
                rel = path[len('/static/'):]
                file_path = safe_join(WEB_ROOT, unquote_plus(rel))
                if not file_path.exists():
                    return self._text('Not found', status=404)
                # serve file
                mime = 'text/plain; charset=utf-8'
                if file_path.suffix == '.js':
                    mime = 'application/javascript; charset=utf-8'
                if file_path.suffix == '.css':
                    mime = 'text/css; charset=utf-8'
                with open(file_path, 'r', encoding='utf-8') as f:
                    return self._text(f.read(), content_type=mime)

            # otherwise 404
            return self._text('Not found', status=404)
        except ValueError:
            return self._json({'error': 'invalid path'}, status=400)
        except Exception as e:
            return self._json({'error': str(e)}, status=500)

    def do_POST(self):
        # Minimal POST support: currently only /api/raw_save is expected from the frontend
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path == '/api/raw_save':
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length else b''
                try:
                    data = json.loads(body.decode('utf-8'))
                except Exception:
                    return self._json({'error': 'invalid JSON'}, status=400)
                name = data.get('name')
                text = data.get('text', '')
                if not name:
                    return self._json({'error': 'name param required'}, status=400)
                try:
                    RAW_DIR.mkdir(parents=True, exist_ok=True)
                except Exception:
                    pass
                # Prevent path traversal on save
                try:
                    file_path = safe_join(RAW_DIR, unquote_plus(name))
                except ValueError:
                    return self._json({'error': 'invalid filename'}, status=400)
                try:
                    file_path.write_text(text, encoding='utf-8')
                except Exception as e:
                    return self._json({'error': f'cannot write raw file: {e}'}, status=500)
                return self._json({'name': name, 'saved': True})
            else:
                return self._text('Not found', status=404)
        except Exception as e:
            return self._json({'error': str(e)}, status=500)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()

    addr = (args.host, args.port)
    server = ThreadingHTTPServer(addr, Handler)
    print(f"Serving on http://{args.host}:{args.port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Shutting down')
        server.server_close()


if __name__ == '__main__':
    main()
