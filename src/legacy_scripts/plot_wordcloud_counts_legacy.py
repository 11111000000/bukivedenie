#!/usr/bin/env python3
"""
Построение облака слов из простой таблицы частот вида
outputs/tables/{text_id}_word_counts.csv (term,count,per_1k).

Использование:
  python scripts/plot_wordcloud_from_counts.py --text-id test_book
  python scripts/plot_wordcloud_from_counts.py --text-id test_book --counts-path outputs/tables/test_book_word_counts.csv --scale sqrt --top-n 300

Особенности:
- Максимально развёрнутые сообщения об ошибках с подсказками.
- Поддержка stopwords.
- Маска (PNG) из configs/cloud.yml, если указана.
- Масштабирование весов: sqrt|log|linear по per_1k (если нет — по count).
- Запись PNG и .meta.json в outputs/figures/wordclouds/{text_id}/
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List

import yaml

# Опциональные зависимости
try:
    import pandas as pd  # type: ignore
    PANDAS_AVAILABLE = True
except Exception:
    PANDAS_AVAILABLE = False

try:
    from wordcloud import WordCloud  # type: ignore
    WORDCLOUD_AVAILABLE = True
except Exception:
    WORDCLOUD_AVAILABLE = False


def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def load_config(config_path: str) -> dict:
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        eprint(f"✗ Конфиг не найден: {config_path}\n  Подсказка: укажите --config или создайте configs/cloud.yml")
        sys.exit(2)
    except Exception as e:
        eprint(f"✗ Ошибка чтения конфига {config_path}: {e}")
        sys.exit(2)


def load_stopwords(stopwords_path: str) -> set:
    sw = set()
    try:
        if os.path.exists(stopwords_path):
            with open(stopwords_path, 'r', encoding='utf-8') as f:
                for line in f:
                    s = line.strip()
                    if s and not s.startswith('#'):
                        sw.add(s.lower())
    except Exception as e:
        eprint(f"⚠ Не удалось загрузить стоп-слова из {stopwords_path}: {e}")
    return sw


def read_counts_csv(path: Path) -> List[dict]:
    """Читает CSV (pandas если доступен, иначе csv.reader) и возвращает list[dict]."""
    if PANDAS_AVAILABLE:
        try:
            df = pd.read_csv(path)
            # приведение названий к ожидаемым
            cols = [c.lower() for c in df.columns]
            ren = {}
            if 'term' not in cols and 'token' in cols:
                ren[df.columns[cols.index('token')]] = 'term'
            if ren:
                df = df.rename(columns=ren)
            out = df.to_dict(orient='records')
            return out
        except Exception as e:
            eprint(f"⚠ Не удалось прочитать CSV через pandas ({path}): {e}. Пытаюсь csv.reader …")
    import csv
    try:
        with open(path, 'r', encoding='utf-8', newline='') as fh:
            reader = csv.reader(fh)
            rows = list(reader)
        if not rows:
            return []
        headers = rows[0]
        body = rows[1:]
        out = [dict(zip(headers, r)) for r in body]
        # типы
        for r in out:
            if 'count' in r and r['count'] != '':
                try: r['count'] = int(r['count'])
                except Exception: pass
            if 'per_1k' in r and r['per_1k'] != '':
                try: r['per_1k'] = float(r['per_1k'])
                except Exception: pass
        return out
    except FileNotFoundError:
        eprint(f"✗ CSV не найден: {path}\n  Подсказка: запустите scripts/generate_word_counts.py --text-id <ID> для создания таблицы частот.")
        sys.exit(1)
    except Exception as e:
        eprint(f"✗ Ошибка чтения CSV {path}: {e}")
        sys.exit(1)


def compute_weight(value: float, scale: str) -> float:
    if scale == 'sqrt':
        return value ** 0.5
    if scale == 'log':
        import math
        return math.log1p(value)
    return value  # linear


def build_freqs(rows: List[dict], scale: str, top_n: int, min_count: int, stopwords: set) -> Dict[str, float]:
    # нормализуем поля и фильтруем
    norm = []
    for r in rows:
        term = (r.get('term') or r.get('token') or '').strip()
        if not term:
            continue
        cnt = r.get('count')
        try:
            cnt = int(cnt)
        except Exception:
            cnt = 0
        per1k = r.get('per_1k')
        try:
            per1k = float(per1k)
        except Exception:
            per1k = float(cnt)
        if cnt < int(min_count):
            continue
        if term.lower() in stopwords:
            continue
        norm.append({'term': term, 'count': cnt, 'per_1k': per1k})
    # top-n по per_1k
    norm.sort(key=lambda x: x['per_1k'], reverse=True)
    if top_n and top_n > 0:
        norm = norm[:top_n]
    if not norm:
        eprint("✗ После фильтрации не осталось терминов.\n  Проверьте: --min-count, --top-n и список стоп‑слов.")
        sys.exit(1)
    # веса
    weights = [compute_weight(x['per_1k'], scale=scale) for x in norm]
    max_w = max(weights) if weights else 0.0
    if max_w <= 0:
        eprint("✗ Нулевые веса после масштабирования. Попробуйте scale=linear и уменьшите --min-count.")
        sys.exit(1)
    freqs = {x['term']: w for x, w in zip(norm, weights)}
    return freqs


def build_wordcloud(freqs: Dict[str, float], config: dict) -> "WordCloud":
    if not WORDCLOUD_AVAILABLE:
        eprint("✗ Модуль 'wordcloud' не установлен.\n  Установите: pip install wordcloud\n  В Termux используйте десктоп для визуализации или ждите lite‑backend.")
        sys.exit(3)
    params = {
        'font_path': config.get('font_path', '/system/fonts/NotoSans-Regular.ttf'),
        'width': int(config.get('width', 1600)),
        'height': int(config.get('height', 1000)),
        'background_color': config.get('background_color', 'white'),
        'max_words': int(config.get('max_words', 400)),
        'collocations': bool(config.get('collocations', False)),
        'random_state': int(config.get('random_state', 42)),
        'prefer_horizontal': float(config.get('prefer_horizontal', 0.9)),
        'colormap': config.get('colormap', 'viridis'),
    }
    mask_path = config.get('mask_path')
    if mask_path and os.path.exists(mask_path or ''):
        try:
            from PIL import Image  # type: ignore
            import numpy as np  # type: ignore
            params['mask'] = np.array(Image.open(mask_path))
        except Exception as e:
            eprint(f"⚠ Не удалось применить маску {mask_path}: {e}. Продолжаю без маски.")
    try:
        wc = WordCloud(**params)
        wc.generate_from_frequencies(freqs)
        return wc
    except OSError as e:
        eprint(f"✗ Ошибка шрифта: {e}\n  Проверьте font_path в configs/cloud.yml (например, /system/fonts/NotoSans-Regular.ttf или configs/fonts/DejaVuSans.ttf)")
        sys.exit(4)
    except Exception as e:
        eprint(f"✗ Не удалось сгенерировать облако: {e}")
        sys.exit(4)


def save_png(wc: "WordCloud", path: Path, dpi: int) -> None:
    try:
        # без matplotlib — напрямую
        wc.to_file(str(path))
    except Exception as e:
        eprint(f"✗ Не удалось сохранить PNG {path}: {e}")
        sys.exit(5)


def save_meta(meta: dict, path: Path) -> None:
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
    except Exception as e:
        eprint(f"⚠ Не удалось сохранить метаданные {path}: {e}")


def main():
    ap = argparse.ArgumentParser(description='Облако слов из {text_id}_word_counts.csv')
    ap.add_argument('--text-id', '-t', required=True, help='Идентификатор текста (имя файла без расширения)')
    ap.add_argument('--counts-path', '-c', help='Путь к CSV (по умолчанию: outputs/tables/{text_id}_word_counts.csv)')
    ap.add_argument('--config', '-C', default='configs/cloud.yml', help='Путь к cloud.yml')
    ap.add_argument('--stopwords', '-S', default='configs/stopwords_ru.txt', help='Стоп-слова')
    ap.add_argument('--scale', '-s', choices=['sqrt', 'log', 'linear'], default='sqrt', help='Масштабирование веса')
    ap.add_argument('--top-n', '-n', type=int, default=400, help='Максимум слов')
    ap.add_argument('--min-count', '-m', type=int, default=5, help='Минимальная частота')
    ap.add_argument('--output-dir', '-o', default='outputs/figures/wordclouds', help='Каталог для PNG')
    ap.add_argument('--seed', type=int, default=42, help='Random seed (random_state)')
    args = ap.parse_args()

    # Пути: сначала пробуем outputs/<text_id>/tokens.csv (приоритет), затем counts_path или outputs/tables/{text_id}_word_counts.csv
    tokens_path = Path('outputs') / args.text_id / 'tokens.csv'
    if tokens_path.exists():
        counts_path = tokens_path
    else:
        counts_path = Path(args.counts_path) if args.counts_path else Path('outputs/tables') / f"{args.text_id}_word_counts.csv"
        if not counts_path.exists():
            eprint(f"✗ Таблица частот не найдена: {counts_path}\n  Подсказка: выполните\n    python src/analyze_text.py analyze --input data/raw/{args.text_id}.txt --output-dir outputs --lang ru\n  или запустите scripts/generate_word_counts.py --text-id {args.text_id} или укажите --counts-path.")
            sys.exit(1)

    # Конфиг и стоп-слова
    cfg_path = args.config
    if not os.path.exists(cfg_path):
        alt = os.path.join(os.path.dirname(__file__), '..', cfg_path)
        if os.path.exists(alt):
            cfg_path = alt
    config = load_config(cfg_path)
    config['random_state'] = int(args.seed)

    sw_path = args.stopwords
    if not os.path.exists(sw_path):
        alt = os.path.join(os.path.dirname(__file__), '..', sw_path)
        if os.path.exists(alt):
            sw_path = alt
    stopwords = load_stopwords(sw_path)

    # Чтение и подготовка частот
    rows = read_counts_csv(counts_path)
    if not rows:
        eprint(f"✗ Пустая таблица: {counts_path}\n  Проверьте входные данные.")
        sys.exit(1)
    if not WORDCLOUD_AVAILABLE:
        eprint("✗ Модуль wordcloud недоступен. Установите: pip install wordcloud")
        sys.exit(3)
    freqs = build_freqs(rows, scale=args.scale, top_n=args.top_n, min_count=args.min_count, stopwords=stopwords)

    # Генерация
    wc = build_wordcloud(freqs, config)

    # Вывод
    out_dir = Path(args.output_dir) / args.text_id
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        eprint(f"✗ Не удалось создать каталог вывода {out_dir}: {e}")
        sys.exit(5)
    filename = (
        f"{args.text_id}__unit-forms__scale-{args.scale}__top-{args.top_n}__bg-{config.get('background_color', 'white')}.png"
    )
    out_path = out_dir / filename
    save_png(wc, out_path, dpi=int(config.get('dpi', 200)))

    # Meta
    meta = {
        'text_id': args.text_id,
        'scale': args.scale,
        'top_n': int(args.top_n),
        'min_count': int(args.min_count),
        'font_path': config.get('font_path'),
        'random_state': int(args.seed),
        'output_path': str(out_path),
        'run_time': datetime.now().isoformat(),
        'source': str(counts_path),
    }
    meta_path = out_dir / filename.replace('.png', '.meta.json')
    save_meta(meta, meta_path)

    # Summary
    print(f"✓ Облако создано: {args.text_id}")
    print(f"  Terms used: {len(freqs)}")
    print(f"  Scale: {args.scale}")
    print(f"  Output: {out_path}")


if __name__ == '__main__':
    main()
