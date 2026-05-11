#!/usr/bin/env python3
"""
Скрипт нормализации исходного текста.

Читает исходный файл (txt/fb2.txt), выполняет:
- очистку HTML/FB2 тегов
- Unicode NFC нормализацию
- унификация кавычек и тире
- нормализацию пробелов

Сохраняет нормализованный текст и метаданные.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

import yaml

# --- Константы ---
DEFAULT_CONFIG_PATH = "configs/pipeline.yml"

# Regex для очистки
FB2_TAG_PATTERN = re.compile(r'<[^>]+>')
HTML_ENTITY_PATTERN = re.compile(r'&[a-zA-Z]+;')

# Унификация кавычек и тире
QUOTE_MAP = {
    '"': '"',
    '"': '"',
    '"': '"',
    '"': '"',
    "'": '"',
    "'": '"',
}

DASH_MAP = {
    '-': '—',
    '–': '—',
    '−': '—',
}


def load_config(config_path: str) -> dict:
    """Загрузка конфигурации из YAML."""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def normalize_unicode(text: str, norm_type: str = 'NFC') -> str:
    """Unicode нормализация."""
    import unicodedata
    return unicodedata.normalize(norm_type, text)


def strip_tags(text: str) -> str:
    """Удаление HTML/FB2 тегов."""
    text = FB2_TAG_PATTERN.sub('', text)
    text = HTML_ENTITY_PATTERN.sub('', text)
    return text


def unify_quotes(text: str) -> str:
    """Унификация кавычек."""
    result = text
    for src, dst in QUOTE_MAP.items():
        result = result.replace(src, dst)
    return result


def unify_dashes(text: str) -> str:
    """Унификация тире."""
    result = text
    for src, dst in DASH_MAP.items():
        result = result.replace(src, dst)
    return result


def normalize_spaces(text: str) -> str:
    """Нормализация пробелов."""
    # Замена неразрывных пробелов
    text = text.replace('\u00a0', ' ')
    text = text.replace('\u2007', ' ')
    text = text.replace('\u202f', ' ')
    # Множественные пробелы → один
    text = re.sub(r' +', ' ', text)
    # Трим каждой строки
    lines = [line.strip() for line in text.split('\n')]
    return '\n'.join(lines)


def normalize_text(text: str, config: dict) -> str:
    """Полная нормализация текста."""
    norm_cfg = config.get('normalization', {})
    
    # Unicode нормализация
    norm_type = norm_cfg.get('unicode_norm', 'NFC')
    text = normalize_unicode(text, norm_type)
    
    # Удаление тегов
    if norm_cfg.get('strip_tags', True):
        text = strip_tags(text)
    
    # ё → е
    if norm_cfg.get('yo_to_e', False):
        text = text.replace('ё', 'е')
        text = text.replace('Ё', 'Е')
    
    # Кавычки
    if norm_cfg.get('unify_quotes', True):
        text = unify_quotes(text)
    
    # Тире
    if norm_cfg.get('unify_dashes', True):
        text = unify_dashes(text)
    
    # Пробелы
    text = normalize_spaces(text)
    
    return text


def compute_sha1(text: str) -> str:
    """SHA1 хэш текста."""
    return hashlib.sha1(text.encode('utf-8')).hexdigest()


def process_file(input_path: str, text_id: str, output_dir: str, config: dict) -> dict:
    """Обработка одного файла."""
    # Чтение
    with open(input_path, 'r', encoding='utf-8') as f:
        raw_text = f.read()
    
    lines_in = len(raw_text.split('\n'))
    chars_in = len(raw_text)
    
    # Нормализация
    normalized = normalize_text(raw_text, config)
    
    lines_out = len(normalized.split('\n'))
    chars_out = len(normalized)
    sha1 = compute_sha1(normalized)
    
    # Сохранение нормализованного текста
    texts_dir = Path(output_dir) / config.get('paths', {}).get('processed_texts', 'data/processed/texts')
    texts_dir.mkdir(parents=True, exist_ok=True)
    output_text_path = texts_dir / f"{text_id}.txt"
    
    with open(output_text_path, 'w', encoding='utf-8') as f:
        f.write(normalized)
    
    # Сохранение метаданных
    meta_dir = Path(output_dir) / config.get('paths', {}).get('processed_meta', 'data/processed/meta')
    meta_dir.mkdir(parents=True, exist_ok=True)
    
    meta = {
        'text_id': text_id,
        'source_path': str(input_path),
        'lines_in': lines_in,
        'chars_in': chars_in,
        'lines_out': lines_out,
        'chars_out': chars_out,
        'sha1': sha1,
        'norm_version': '1.0',
        'run_time': datetime.now().isoformat(),
    }
    
    meta_path = meta_dir / f"{text_id}.json"
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    
    return meta


def main():
    parser = argparse.ArgumentParser(description='Нормализация исходного текста')
    parser.add_argument('--input', '-i', required=True, help='Путь к входному файлу или папке')
    parser.add_argument('--text-id', '-t', help='Идентификатор текста (если вход — файл)')
    parser.add_argument('--config', '-c', default=DEFAULT_CONFIG_PATH, help='Путь к конфигу')
    parser.add_argument('--output-dir', '-o', default='.', help='Папка для outputs')
    
    args = parser.parse_args()
    
    # Загрузка конфига
    config_path = args.config
    if not os.path.exists(config_path):
        config_path = os.path.join(os.path.dirname(__file__), '..', config_path)
    
    config = load_config(config_path)
    
    input_path = Path(args.input)
    
    if input_path.is_file():
        # Один файл
        text_id = args.text_id or input_path.stem
        meta = process_file(str(input_path), text_id, args.output_dir, config)
        print(f"✓ Нормализовано: {text_id}")
        print(f"  Строки: {meta['lines_in']} → {meta['lines_out']}")
        print(f"  Символы: {meta['chars_in']} → {meta['chars_out']}")
        print(f"  SHA1: {meta['sha1']}")
    elif input_path.is_dir():
        # Папка с файлами
        txt_files = list(input_path.glob('*.txt')) + list(input_path.glob('*.fb2.txt'))
        for txt_file in txt_files:
            text_id = args.text_id or txt_file.stem
            meta = process_file(str(txt_file), text_id, args.output_dir, config)
            print(f"✓ Нормализовано: {text_id}")
    else:
        print(f"✗ Вход не найден: {input_path}")
        sys.exit(1)


if __name__ == '__main__':
    main()