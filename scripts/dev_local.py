#!/usr/bin/env python3
"""
Simple local dev server for frontend + backend with live-reload and API proxy.

Usage: python scripts/dev_local.py

Starts backend (python -m src.webapp) on 127.0.0.1:8000, and a local dev server on 127.0.0.1:5173
that serves files from frontend/ (if exists) or src/web_view/, proxies /api to backend,
and provides a simple Server-Sent Events endpoint /__livereload to notify clients to reload
when files change.

No Node required. Lightweight polling watcher used for change detection.
"""

import http.server
import socketserver
import threading
import subprocess
import sys
import time
import os
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FRONTEND_DIR = os.path.join(ROOT, 'frontend')
STATIC_DIR = os.path.join(ROOT, 'src', 'web_view')
USE_DIR = FRONTEND_DIR if os.path.isdir(FRONTEND_DIR) else STATIC_DIR

BACKEND_HOST = '127.0.0.1'
BACKEND_PORT = int(os.environ.get('BACKEND_PORT', '8000'))
DEV_HOST = '127.0.0.1'
DEV_PORT = int(os.environ.get('DEV_PORT', '5173'))

WATCH_PATHS = [USE_DIR]
POLL_INTERVAL = 1.0

clients = []  # SSE client file-like objects
clients_lock = threading.Lock()

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=USE_DIR, **kwargs)

    def end_headers(self):
        # Allow CORS for local dev if needed
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        # SSE endpoint
        if self.path.startswith('/__livereload'):
            self.handle_sse()
            return
        # Proxy API calls to backend
        if self.path.startswith('/api'):
            return self.proxy_request()
        # Serve static files; inject livereload script into index.html
        if self.path == '/' or self.path.startswith('/index.html'):
            try:
                p = os.path.join(USE_DIR, 'index.html')
                with open(p, 'rb') as f:
                    content = f.read()
                # inject client script before </body>
                script = b"\n<script>\n(async()=>{const es=new EventSource('/__livereload');es.onmessage=e=>{if(e.data==='reload')location.reload();};})();</script>\n</body>"
                content = content.replace(b'</body>', script)
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception:
                pass
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api'):
            return self.proxy_request()
        return super().do_POST()

    def proxy_request(self):
        # Forward the request to backend and relay response
        target = f'http://{BACKEND_HOST}:{BACKEND_PORT}{self.path}'
        length = int(self.headers.get('Content-Length', 0))
        data = None
        if length:
            data = self.rfile.read(length)
        req = Request(target, data=data, method=self.command)
        # copy headers, but override Host
        for k,v in self.headers.items():
            if k.lower() in ('host','content-length'):
                continue
            req.add_header(k, v)
        try:
            with urlopen(req, timeout=30) as resp:
                self.send_response(resp.getcode())
                for h, v in resp.getheaders():
                    if h.lower() in ('transfer-encoding', 'connection', 'keep-alive'):
                        continue
                    self.send_header(h, v)
                self.end_headers()
                body = resp.read()
                if body:
                    self.wfile.write(body)
        except HTTPError as e:
            self.send_response(e.code)
            self.end_headers()
            try:
                self.wfile.write(e.read())
            except Exception:
                pass
        except URLError as e:
            self.send_response(502)
            self.end_headers()
            msg = f'Proxy error: {e}'.encode('utf-8')
            self.wfile.write(msg)

    def handle_sse(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'keep-alive')
        self.end_headers()
        # Keep the connection open and add to clients
        with clients_lock:
            clients.append(self.wfile)
        try:
            while True:
                time.sleep(1)
                # keep-alive comment
                try:
                    self.wfile.write(b': ping\n\n')
                    self.wfile.flush()
                except Exception:
                    break
        finally:
            with clients_lock:
                if self.wfile in clients:
                    clients.remove(self.wfile)

def watch_changes():
    mtimes = {}
    while True:
        changed = False
        for root in WATCH_PATHS:
            for dirpath, dirnames, filenames in os.walk(root):
                for fn in filenames:
                    if fn.endswith('.pyc') or fn.startswith('.'):
                        continue
                    path = os.path.join(dirpath, fn)
                    try:
                        m = os.path.getmtime(path)
                    except Exception:
                        continue
                    if path not in mtimes:
                        mtimes[path] = m
                    elif m != mtimes[path]:
                        mtimes[path] = m
                        changed = True
        if changed:
            notify_reload()
        time.sleep(POLL_INTERVAL)

def notify_reload():
    with clients_lock:
        for w in list(clients):
            try:
                w.write(b'data: reload\n\n')
                w.flush()
            except Exception:
                try:
                    clients.remove(w)
                except Exception:
                    pass

def start_backend():
    print('Starting backend...')
    env = os.environ.copy()
    p = subprocess.Popen([sys.executable, '-m', 'src.webapp', '--host', BACKEND_HOST, '--port', str(BACKEND_PORT)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=ROOT)
    def pump():
        for line in p.stdout:
            try:
                sys.stdout.buffer.write(b'[backend] ' + line)
            except Exception:
                pass
    t = threading.Thread(target=pump, daemon=True)
    t.start()
    return p

def start_dev_server():
    handler = ProxyHandler
    httpd = socketserver.ThreadingTCPServer((DEV_HOST, DEV_PORT), handler)
    print(f'Dev server listening on http://{DEV_HOST}:{DEV_PORT}/, serving {USE_DIR}')
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd

if __name__ == '__main__':
    # Start backend
    backend_proc = start_backend()
    # Wait until backend responds (simple polling)
    for i in range(60):
        try:
            with urlopen(f'http://{BACKEND_HOST}:{BACKEND_PORT}/api/books', timeout=1) as r:
                break
        except Exception:
            time.sleep(0.2)
    # Start dev server
    httpd = start_dev_server()
    # Start watcher
    watcher = threading.Thread(target=watch_changes, daemon=True)
    watcher.start()
    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print('Backend process exited')
                break
    except KeyboardInterrupt:
        pass
    print('Shutting down...')
    try:
        httpd.shutdown()
    except Exception:
        pass
    try:
        backend_proc.terminate()
    except Exception:
        pass
    sys.exit(0)
