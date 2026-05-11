#!/usr/bin/env python3
"""
Скрипт построения облака слов из таблицы частот.

Читает таблицу частот (vocab_lemma_counts.csv или vocab_form_counts.csv),
фильтрует, выбирает Top-N, вычисляет веса и генерирует облако слов.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

import yaml
import pandas as pd
import numpy as np

try:
    from wordcloud import WordCloud
    WORDCLOUD_AVAILABLE = True
except ImportError:
    WORDCLOUD_AVAILABLE = False
    print("⚠ wordcloud не установлен. Установка: pip install wordcloud")

try:
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    print("⚠ matplotlib не установлен. Установка: pip install matplotlib")


# --- Константы ---
DEFAULT_CONFIG_PATH = "configs/cloud.yml"


def load_config(config_path: str) -> dict:
    """Загрузка конфигурации из YAML."""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def load_stopwords(stopwords_path: str) -> set:
    """Загрузка стоп-слов."""
    stopwords = set()
    if os.path.exists(stopwords_path):
        with open(stopwords_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    stopwords.add(line.lower())
    return stopwords


def compute_weights(
    df: pd.DataFrame,
    scale: str = 'sqrt',
    per1k_col: str = 'per_1k',
) -> pd.DataFrame:
    """Вычисление весов для визуализации."""
    if scale == 'sqrt':
        df['weight'] = np.sqrt(df[per1k_col])
    elif scale == 'log':
        df['weight'] = np.log1p(df[per1k_col])
    elif scale == 'linear':
        df['weight'] = df[per1k_col]
    elif scale == 'tfidf':
        if 'tfidf' in df.columns:
            df['weight'] = df['tfidf']
        else:
            df['weight'] = df[per1k_col]
    else:
        df['weight'] = df[per1k_col]
    
    # Нормализация к [0, 1] для wordcloud
    max_weight = df['weight'].max()
    if max_weight > 0:
        df['weight_norm'] = df['weight'] / max_weight
    
    return df


def generate_wordcloud(
    freqs: Dict[str, float],
    config: dict,
) -> WordCloud:
    """Генерация облака слов."""
    wc_params = {
        'font_path': config.get('font_path', '/system/fonts/NotoSans-Regular.ttf'),
        'width': config.get('width', 1600),
        'height': config.get('height', 1000),
        'background_color': config.get('background_color', 'white'),
        'max_words': config.get('max_words', 400),
        'collocations': config.get('collocations', False),
        'random_state': config.get('random_state', 42),
        'prefer_horizontal': config.get('prefer_horizontal', 0.9),
        'colormap': config.get('colormap', 'viridis'),
    }
    
    mask_path = config.get('mask_path')
    if mask_path and os.path.exists(mask_path):
        from PIL import Image
        mask = Image.open(mask_path)
        wc_params['mask'] = mask
    
    wc = WordCloud(**wc_params)
    wc.generate_from_frequencies(freqs)
    
    return wc


def save_wordcloud(
    wc: WordCloud,
    output_path: str,
    dpi: int = 200,
) -> None:
    """Сохранение облака в PNG."""
    if not MATPLOTLIB_AVAILABLE:
        print("⚠ matplotlib не доступен, сохранение через to_file")
        wc.to_file(output_path)
        return
    
    plt.figure(figsize=(wc.width/100, wc.height/100))
    plt.imshow(wc, interpolation='bilinear')
    plt.axis('off')
    plt.tight_layout(pad=0)
    plt.savefig(output_path, dpi=dpi, bbox_inches='tight')
    plt.close()


def save_meta(meta: dict, output_path: str) -> None:
    """Сохранение метаданных."""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description='Построение облака слов')
    parser.add_argument('--text-id', '-t', required=True, help='Идентификатор текста')
    parser.add_argument('--counts-path', '-c', help='Путь к таблице частот')
    parser.add_argument('--unit', '-u', choices=['lemmas', 'forms'], default='lemmas',
                        help='Единица учёта')
    parser.add_argument('--scale', '-s', choices=['sqrt', 'log', 'linear', 'tfidf'],
                        default='sqrt', help='Масштабирование веса')
    parser.add_argument('--top-n', '-n', type=int, default=400,
                        help='Максимальное число слов')
    parser.add_argument('--min-count', '-m', type=int, default=5,
                        help='Минимальная частота')
    parser.add_argument('--config', '-C', default=DEFAULT_CONFIG_PATH,
                        help='Путь к конфигу cloud.yml')
    parser.add_argument('--stopwords', '-S', default='configs/stopwords_ru.txt',
                        help='Путь к стоп-словам')
    parser.add_argument('--output-dir', '-o', default='outputs/figures/wordclouds',
                        help='Папка для outputs')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    
    args = parser.parse_args()
    
    # Проверка доступности libraries
    if not WORDCLOUD_AVAILABLE:
        print("✗ wordcloud не установлен")
        sys.exit(1)
    
    # Загрузка конфига
    config_path = args.config
    if not os.path.exists(config_path):
        config_path = os.path.join(os.path.dirname(__file__), '..', config_path)
    
    config = load_config(config_path)
    config['random_state'] = args.seed
    
    # Поиск таблицы частот
    if args.counts_path:
        counts_path = args.counts_path
    else:
        tables_dir = Path('outputs/tables')
        counts_path = tables_dir / f"vocab_{args.unit}_counts.csv"
    
    if not os.path.exists(counts_path):
        print(f"✗ Таблица частот не найдена: {counts_path}")
        sys.exit(1)
    
    # Загрузка данных
    df = pd.read_csv(counts_path)
    df = df[df['text_id'] == args.text_id]
    
    if len(df) == 0:
        print(f"✗ Нет данных для text_id: {args.text_id}")
        sys.exit(1)
    
    # Стоп-слова (если ещё не фильтрованы)
    stopwords_path = args.stopwords
    if not os.path.exists(stopwords_path):
        stopwords_path = os.path.join(os.path.dirname(__file__), '..', stopwords_path)
    stopwords = load_stopwords(stopwords_path)
    
    if stopwords:
        df = df[~df['term'].isin(stopwords)]
    
    # Фильтры
    df = df[df['count'] >= args.min_count]
    
    # Top-N
    df = df.sort_values('per_1k', ascending=False).head(args.top_n)
    
    if len(df) < 20:
        print(f"⚠ Мало терминов после фильтрации: {len(df)}")
    
    # Веса
    df = compute_weights(df, scale=args.scale)
    
    # Dictionary для wordcloud
    freqs = dict(zip(df['term'], df['weight']))
    
    # Генерация
    wc = generate_wordcloud(freqs, config)
    
    # Output path
    output_dir = Path(args.output_dir) / args.text_id
    output_dir.mkdir(parents=True, exist_ok=True)
    
    filename = (
        f"{args.text_id}__unit-{args.unit}__scale-{args.scale}__"
        f"top-{args.top_n}__bg-{config.get('background_color', 'white')}.png"
    )
    output_path = output_dir / filename
    
    save_wordcloud(wc, str(output_path), dpi=config.get('dpi', 200))
    
    # Meta
    meta = {
        'text_id': args.text_id,
        'unit': args.unit,
        'scale': args.scale,
        'top_n': args.top_n,
        'min_count': args.min_count,
        'terms_count': len(df),
        'font_path': config.get('font_path'),
        'random_state': args.seed,
        'output_path': str(output_path),
        'run_time': datetime.now().isoformat(),
    }
    meta_path = output_dir / filename.replace('.png', '.meta.json')
    save_meta(meta, str(meta_path))
    
    # Summary
    print(f"✓ Облако создано: {args.text_id}")
    print(f"  Terms: {len(df)}")
    print(f"  Scale: {args.scale}")
    print(f"  Output: {output_path}")
    
    # Top-10 для проверки
    print("\nTop-10 terms:")
    for i, (term, count, per_1k) in enumerate(df[['term', 'count', 'per_1k']].head(10).itertools()):
        print(f"  {i+1}. {term}: {count} ({per_1k:.2f} per_1k)")


if __name__ == '__main__':
    main()