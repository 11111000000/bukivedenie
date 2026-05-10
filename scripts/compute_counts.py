#!/usr/bin/env python3
"""
Скрипт подсчёта частот слов (форм и лемм).

Читает нормализованный текст, выполняет:
- токенизацию (razdel)
- лемматизацию (pymorphy2, опционально)
- фильтрацию (стоп-слова, длина, is_alpha)
- подсчёт частот

Сохраняет таблицу частот в CSV.
"""

import argparse
import os
import sys
from pathlib import Path
from collections import Counter
from typing import List, Tuple, Optional, Set

import yaml
import pandas as pd

try:
    from razdel import tokenize
    from pymorphy2 import MorphAnalyzer
    MORPH_AVAILABLE = True
except ImportError:
    MORPH_AVAILABLE = False
    print("⚠ pymorphy2 или razdel не установлены. Лемматизация не доступна.")


# --- Константы ---
DEFAULT_CONFIG_PATH = "configs/pipeline.yml"
DEFAULT_STOPWORDS_PATH = "configs/stopwords_ru.txt"


def load_config(config_path: str) -> dict:
    """Загрузка конфигурации из YAML."""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def load_stopwords(stopwords_path: str) -> Set[str]:
    """Загрузка стоп-слов из файла."""
    stopwords = set()
    with open(stopwords_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                stopwords.add(line.lower())
    return stopwords


def tokenize_text(text: str) -> List[str]:
    """Токенизация текста через razdel."""
    tokens = [t.text for t in tokenize(text)]
    return tokens


def lemmatize_tokens(tokens: List[str], morph: Optional['MorphAnalyzer'] = None) -> List[str]:
    """Лемматизация токенов."""
    if morph is None:
        return [t.lower() for t in tokens]
    
    lemmas = []
    for token in tokens:
        parsed = morph.parse(token)
        if parsed:
            lemmas.append(parsed[0].normal_form.lower())
        else:
            lemmas.append(token.lower())
    return lemmas


def filter_tokens(
    tokens: List[str],
    stopwords: Set[str],
    min_len: int = 2,
    keep_digits: bool = False,
    keep_punct: bool = False,
    lower: bool = True,
) -> List[str]:
    """Фильтрация токенов."""
    filtered = []
    for token in tokens:
        t = token.lower() if lower else token
        
        # Длина
        if len(t) < min_len:
            continue
        
        # Стоп-слова
        if t in stopwords:
            continue
        
        # Пунктуация
        if not keep_punct and t in '.,;:!?—…"«»()[]{}':
            continue
        
        # Цифры
        if not keep_digits and t.isdigit():
            continue
        
        # Только буквы (для русского текста)
        if not t.isalpha():
            # Можно разрешить слова с дефисом или апострофом
            if '-' not in t and "'" not in t:
                continue
        
        filtered.append(t)
    
    return filtered


def compute_frequencies(tokens: List[str]) -> Counter:
    """Подсчёт частот токенов."""
    return Counter(tokens)


def save_counts(
    counts: Counter,
    text_id: str,
    output_path: str,
    tokens_in_scope: int,
) -> None:
    """Сохранение частот в CSV."""
    # Пер-1k
    data = []
    for term, count in counts.items():
        per_1k = (count / tokens_in_scope * 1000) if tokens_in_scope > 0 else 0.0
        data.append({
            'text_id': text_id,
            'term': term,
            'count': count,
            'per_1k': round(per_1k, 4),
        })
    
    df = pd.DataFrame(data)
    
    # Если файл существует — дописываем (для разных text_id)
    if os.path.exists(output_path):
        existing = pd.read_csv(output_path)
        # Удаляем строки с этим text_id если есть
        existing = existing[existing['text_id'] != text_id]
        df = pd.concat([existing, df], ignore_index=True)
    
    df.to_csv(output_path, index=False, encoding='utf-8')


def process_text(
    text_path: str,
    text_id: str,
    unit: str,
    stopwords: Set[str],
    config: dict,
) -> dict:
    """Обработка текста и подсчёт частот."""
    # Чтение текста
    with open(text_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    counts_cfg = config.get('counts', {})
    
    # Токенизация
    tokens = tokenize_text(text)
    
    # Лемматизация или формы
    if unit == 'lemmas' and MORPH_AVAILABLE:
        morph = MorphAnalyzer()
        terms = lemmatize_tokens(tokens, morph)
    else:
        terms = [t.lower() for t in tokens]
    
    # Фильтрация
    min_len = counts_cfg.get('min_token_len', 2)
    keep_digits = counts_cfg.get('keep_digits', False)
    keep_punct = counts_cfg.get('keep_punct', False)
    lower = counts_cfg.get('lower', True)
    
    filtered = filter_tokens(
        terms,
        stopwords,
        min_len=min_len,
        keep_digits=keep_digits,
        keep_punct=keep_punct,
        lower=lower,
    )
    
    # Число токенов в scope (для per_1k)
    tokens_in_scope = len(filtered)
    
    # Подсчёт частот
    counts = compute_frequencies(filtered)
    
    return {
        'text_id': text_id,
        'counts': counts,
        'tokens_total': len(tokens),
        'tokens_filtered': tokens_in_scope,
        'unique_terms': len(counts),
    }


def main():
    parser = argparse.ArgumentParser(description='Подсчёт частот слов')
    parser.add_argument('--text-id', '-t', required=True, help='Идентификатор текста')
    parser.add_argument('--unit', '-u', choices=['lemmas', 'forms'], default='lemmas',
                        help='Единица учёта: леммы или формы')
    parser.add_argument('--stopwords', '-s', default=DEFAULT_STOPWORDS_PATH,
                        help='Путь к файлу стоп-слов')
    parser.add_argument('--config', '-c', default=DEFAULT_CONFIG_PATH,
                        help='Путь к конфигу')
    parser.add_argument('--output-dir', '-o', default='outputs/tables',
                        help='Папка для таблиц')
    parser.add_argument('--append', '-a', action='store_true',
                        help='Дописывать к существующей таблице')
    
    args = parser.parse_args()
    
    # Загрузка конфига
    config_path = args.config
    if not os.path.exists(config_path):
        config_path = os.path.join(os.path.dirname(__file__), '..', config_path)
    
    config = load_config(config_path)
    
    # Стоп-слова
    stopwords_path = args.stopwords
    if not os.path.exists(stopwords_path):
        stopwords_path = os.path.join(os.path.dirname(__file__), '..', stopwords_path)
    
    stopwords = load_stopwords(stopwords_path)
    
    # Поиск нормализованного текста
    texts_dir = Path('.') / config.get('paths', {}).get('processed_texts', 'data/processed/texts')
    text_path = texts_dir / f"{args.text_id}.txt"
    
    if not text_path.exists():
        print(f"✗ Текст не найден: {text_path}")
        sys.exit(1)
    
    # Обработка
    result = process_text(str(text_path), args.text_id, args.unit, stopwords, config)
    
    # Вывод таблицы
    output_file = f"vocab_{args.unit}_counts.csv"
    output_path = Path(args.output_dir) / output_file
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    save_counts(
        result['counts'],
        args.text_id,
        str(output_path),
        result['tokens_filtered'],
    )
    
    # Summary
    print(f"✓ Частоты подсчитаны: {args.text_id}")
    print(f"  Единица: {args.unit}")
    print(f"  Токенов (total): {result['tokens_total']}")
    print(f"  Токенов (after filter): {result['tokens_filtered']}")
    print(f"  Unique terms: {result['unique_terms']}")
    print(f"  Output: {output_path}")
    
    # Top-20
    print("\nTop-20 terms:")
    top20 = result['counts'].most_common(20)
    for term, count in top20:
        per_1k = count / result['tokens_filtered'] * 1000 if result['tokens_filtered'] > 0 else 0
        print(f"  {term}: {count} ({per_1k:.2f} per_1k)")


if __name__ == '__main__':
    main()