import os
import sys
from pathlib import Path
import subprocess
import json

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / 'scripts'
OUTPUTS = ROOT / 'outputs'
TABLES = OUTPUTS / 'tables'


def ensure_min_counts(text_id='test_book'):
    # Создаём минимальный CSV таблицу частот, если её нет
    TABLES.mkdir(parents=True, exist_ok=True)
    path = TABLES / f'{text_id}_word_counts.csv'
    if not path.exists():
        path.write_text('text_id,term,count,per_1k\n' +
                        f'{text_id},мир,50,10.0\n' +
                        f'{text_id},война,40,8.0\n' +
                        f'{text_id},и,100,20.0\n' +
                        f'{text_id},любовь,30,6.0\n' +
                        f'{text_id},князь,25,5.0\n', encoding='utf-8')
    return path


def run_script(text_id='test_book'):
    path = ensure_min_counts(text_id)
    cmd = [sys.executable, str(SCRIPTS / 'plot_wordcloud_counts_legacy.py'), '--text-id', text_id, '--counts-path', str(path), '--top-n', '3', '--min-count', '1']
    proc = subprocess.run(cmd, capture_output=True)
    return proc


def test_generates_png_and_meta(tmp_path):
    os.chdir(ROOT)
    text_id = 'test_book'
    proc = run_script(text_id)
    assert proc.returncode == 0, f'Process failed: {proc.stderr.decode("utf-8",errors="replace")}'
    out_dir = OUTPUTS / 'figures' / 'wordclouds' / text_id
    pngs = list(out_dir.glob('*.png'))
    metas = list(out_dir.glob('*.meta.json'))
    assert pngs, 'PNG не создан'
    assert metas, 'meta.json не создан'


def test_errors_are_verbose(tmp_path):
    os.chdir(ROOT)
    # несуществующий файл
    cmd = [sys.executable, str(SCRIPTS / 'plot_wordcloud_counts_legacy.py'), '--text-id', 'nope', '--counts-path', str(TABLES / 'nope.csv')]
    proc = subprocess.run(cmd, capture_output=True)
    assert proc.returncode != 0
    stderr = proc.stderr.decode('utf-8', errors='replace')
    assert 'Таблица частот не найдена' in stderr or 'CSV не найден' in stderr
