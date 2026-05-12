#!/usr/bin/env python3
import json
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import time
import socket
from pathlib import Path

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


def run_server():
    from src.webapp import Handler
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


def get_json(path):
    with urlopen(f'http://{HOST}:{PORT}{path}') as r:
        return json.loads(r.read().decode('utf-8'))


def test_endpoints_basic():
    th = Thread(target=run_server, daemon=True)
    th.start()
    assert wait_port(HOST, PORT), 'server did not start'

    # books should return JSON
    data = get_json('/api/books')
    assert 'books' in data

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

