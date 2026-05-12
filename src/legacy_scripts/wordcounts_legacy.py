#!/usr/bin/env python3
"""
Скрипт подсчёта частоты упоминаний всех слов в тексте.

Читает текст из data/raw, выполняет нормализацию, токенизацию
и сохраняет:
  1. Нормализованный текст в новый файл (не перезаписывая исходный)
  2. CSV таблицу с частотами всех слов

Работает БЕЗ лемматизации (считает по формам слов).
Для лемматизации требуется pymorphy2, который может не работать на Python 3.13.

Использование:
    python scripts/generate_word_counts.py --text-id tolstoj_lew_nikolaewich-text_1
"""

import argparse
import os
import sys
import re
import json
import csv
from pathlib import Path
from collections import Counter
from typing import List, Set

try:
    import pandas as pd
except ImportError:
    pd = None

try:
    from razdel import sentenize, tokenize
    from razdel import tokenize as razdel_tokenize
except ImportError:
    sentenize = None
    tokenize = None
    razdel_tokenize = None


TOKEN_RE = re.compile(r"[A-Za-zА-Яа-яЁё]+(?:-[A-Za-zА-Яа-яЁё]+)*", re.UNICODE)
SENTENCE_RE = re.compile(r".*?(?:[.!?…]+(?:\s+|$)|$)", re.DOTALL)


# --- Константы ---
DEFAULT_STOPWORDS_PATH = "configs/stopwords_ru.txt"


def load_stopwords(path: str) -> Set[str]:
    """Загрузить стоп-слова из файла."""
    stopwords = set()
    if not os.path.exists(path):
        print(f"⚠ Файл стоп-слов не найден: {path}")
        return stopwords

    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                stopwords.add(line.lower())

    print(f"✓ Загружено {len(stopwords)} стоп-слов")
    return stopwords


def normalize_text(text: str) -> str:
    """
    Базовая нормализация текста:
    - Unicode NFC
    - Замена неразрывных пробелов
    - Унификация кавычек и тире
    - Удаление HTML/FB2 тегов
    """
    import unicodedata

    # Unicode нормализация
    text = unicodedata.normalize('NFC', text)

    # Неразрывные пробелы → обычные
    text = text.replace('\u00a0', ' ')
    text = text.replace('\u2007', ' ')
    text = text.replace('\u202f', ' ')

    # Удаление HTML/FB2 тегов
    text = re.sub(r'<[^>]+>', '', text)

    # Удаление HTML сущностей
    text = re.sub(r'&[a-zA-Z]+;', '', text)

    # Унификация кавычек
    quotes = {'"': '"', '"': '"', '"': '"', '"': '"', "'": '"', "'": '"'}
    for src, dst in quotes.items():
        text = text.replace(src, dst)

    # Унификация тире
    dashes = {'-': '-', '-': '-', '-': '-'}
    for src, dst in dashes.items():
        text = text.replace(src, dst)

    # Нормализация пробелов
    text = re.sub(r' +', ' ', text)

    return text


def tokenize_and_filter(
    text: str,
    stopwords: Set[str],
    min_len: int = 2,
) -> List[str]:
    """
    Токенизация и фильтрация текста.

    Возвращает список слов (в нижнем регистре) после фильтрации.
    БЕЗ лемматизации - работает с формами слов.
    """
    if tokenize is not None:
        tokens = [t.text for t in tokenize(text)]
    else:
        tokens = [m.group(0) for m in TOKEN_RE.finditer(text)]

    filtered = []
    for token in tokens:
        # Приводим к нижнему регистру
        token_lower = token.lower()

        # Пропускаем слишком короткие
        if len(token_lower) < min_len:
            continue

        # Пропускаем стоп-слова
        if token_lower in stopwords:
            continue

        # Пропускаем чистую пунктуацию
        if token_lower in '.,;:!?-..."«»()[]{}':
            continue

        # Пропускаем чистые цифры
        if token_lower.isdigit():
            continue

        # Оставляем только слова (буквы + возможно дефис)
        # Разрешаем слова с дефисом (по-русски)
        clean_token = token_lower.replace('-', '').replace("'", '')
        if not clean_token.isalpha():
            continue

        filtered.append(token_lower)

    return filtered


def compute_frequencies(words: List[str]) -> Counter:
    """Подсчёт частот слов."""
    return Counter(words)


def save_to_csv(
    counts: Counter,
    text_id: str,
    output_path: str,
    tokens_total: int,
) -> None:
    """
    Сохранение частот в CSV.

    Колонки: text_id, term, count, per_1k
    """
    data = []
    for term, count in counts.items():
        per_1k = (count / tokens_total * 1000) if tokens_total > 0 else 0.0
        data.append({
            'text_id': text_id,
            'term': term,
            'count': count,
            'per_1k': round(per_1k, 4),
        })

    # Сортировка по убыванию частоты
    data.sort(key=lambda x: x['count'], reverse=True)

    if pd is not None:
        df = pd.DataFrame(data)
        df.to_csv(output_path, index=False, encoding='utf-8')
        saved_count = len(df)
    else:
        with open(output_path, 'w', encoding='utf-8', newline='') as fh:
            writer = csv.DictWriter(fh, fieldnames=['text_id', 'term', 'count', 'per_1k'])
            writer.writeheader()
            writer.writerows(data)
        saved_count = len(data)
    print(f"✓ Сохранено {saved_count} уникальных терминов в {output_path}")


def _tokenize_sentence(text: str):
    if razdel_tokenize is not None:
        return list(razdel_tokenize(text))
    return [type('Token', (), {'text': m.group(0), 'start': m.start(), 'stop': m.end()}) for m in TOKEN_RE.finditer(text)]


def _sentences_with_offsets(text: str):
    if sentenize is not None:
        return list(sentenize(text))
    sentences = []
    pos = 0
    for match in SENTENCE_RE.finditer(text):
        chunk = match.group(0)
        if not chunk:
            continue
        start = pos
        end = start + len(chunk)
        sentences.append(type('Sentence', (), {'text': chunk, 'start': start, 'stop': end}))
        pos = end
    return sentences


def find_text_file(text_id: str, raw_dir: str) -> Path:
    """
    Поиск файла с текстом по text_id.

    Ищет в raw_dir и подпапках.
    """
    raw_path = Path(raw_dir)

    # Прямое совпадение
    candidates = [
        raw_path / f"{text_id}.txt",
        raw_path / f"{text_id}.fb2.txt",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    # Поиск по подпапкам
    for txt_file in raw_path.rglob(f"{text_id}*.txt"):
        if text_id in txt_file.stem:
            return txt_file

    return None


def main():
    parser = argparse.ArgumentParser(
        description='Подсчёт частоты упоминаний всех слов в тексте'
    )
    parser.add_argument(
        '--text-id', '-t',
        required=True,
        help='Идентификатор текста (имя файла без расширения)'
    )
    parser.add_argument(
        '--input-dir', '-i',
        default='data/raw',
        help='Папка с исходными текстами (по умолчанию: data/raw)'
    )
    parser.add_argument(
        '--output-dir', '-o',
        default='outputs',
        help='Папка для выходов (по умолчанию: outputs)'
    )
    parser.add_argument(
        '--stopwords', '-s',
        default=DEFAULT_STOPWORDS_PATH,
        help='Путь к файлу стоп-слов'
    )
    parser.add_argument(
        '--min-len', '-m',
        type=int,
        default=2,
        help='Минимальная длина слова (по умолчанию: 2)'
    )
    parser.add_argument(
        '--use-lemmas', '-l',
        action='store_true',
        help='Использовать лемматизацию (требуется pymorphy2)'
    )
    parser.add_argument(
        '--dump-surfaces',
        action='store_true',
        help='Сохранить таблицу surface_tokens.csv (вспомогательная для NER)'
    )
    parser.add_argument(
        '--dump-sentences',
        action='store_true',
        help='Сохранить sentences.jsonl (токенизированные предложения)'
    )

    args = parser.parse_args()

    # === ШАГ 1: Поиск файла с текстом ===
    text_file = find_text_file(args.text_id, args.input_dir)

    if text_file is None:
        print(f"✗ Текст не найден: {args.text_id}")
        print(f"  Искано в: {args.input_dir}")
        sys.exit(1)

    print(f"✓ Найден исходный текст: {text_file}")

    # === ШАГ 2: Чтение исходного текста ===
    with open(text_file, 'r', encoding='utf-8') as f:
        raw_text = f.read()

    print(f"  Размер исходного текста: {len(raw_text)} символов")

    # === ШАГ 3: Нормализация текста ===
    normalized_text = normalize_text(raw_text)
    print(f"  Размер после нормализации: {len(normalized_text)} символов")

    # === ШАГ 4: Сохранение нормализованного текста в НОВЫЙ файл ===
    output_dir = Path(args.output_dir)
    processed_dir = output_dir / 'processed'
    tables_dir = output_dir / 'tables'
    # ensure base dirs exist
    processed_dir.mkdir(parents=True, exist_ok=True)
    tables_dir.mkdir(parents=True, exist_ok=True)

    # Имя нового файла: {text_id}_normalized.txt
    normalized_filename = f"{args.text_id}_normalized.txt"
    normalized_path = processed_dir / normalized_filename

    with open(normalized_path, 'w', encoding='utf-8') as f:
        f.write(normalized_text)

    print(f"✓ Нормализованный текст сохранён: {normalized_path}")
    print(f"  (исходный файл не изменён)")

    # === ШАГ 5: Загрузка стоп-слов ===
    stopwords_path = args.stopwords
    if not os.path.exists(stopwords_path):
        stopwords_path = os.path.join(os.path.dirname(__file__), '..', stopwords_path)

    stopwords = load_stopwords(stopwords_path)

    # === ШАГ 6: Токенизация и фильтрация ===
    print("Токенизация и фильтрация слов...")

    words = tokenize_and_filter(
        normalized_text,
        stopwords,
        min_len=args.min_len,
    )

    print(f"✓ Получено {len(words)} слов после фильтрации")

    # === ШАГ 6b: Optional surfaces and sentences dump ===
    if args.dump_sentences or args.dump_surfaces:
        try:
            print('→ Генерация токенизированных предложений (для --dump-sentences/--dump-surfaces)')
            sentences = []
            surfaces = {}
            sent_index = 0
            for s in _sentences_with_offsets(normalized_text):
                st = s.text
                start = s.start
                end = s.stop
                toks = []
                for t in _tokenize_sentence(st):
                    tok_text = t.text
                    toks.append({'text': tok_text, 'start': start + t.start, 'end': start + t.stop, 'is_first': (t.start==0)})
                    lower = tok_text.lower()
                    rec = surfaces.setdefault(lower, {'surface': tok_text, 'lower': lower, 'count_total':0, 'count_capitalized':0, 'count_lower':0, 'first_offset': None, 'first_sentence_index': None})
                    rec['count_total'] += 1
                    if tok_text and tok_text[0].isupper():
                        rec['count_capitalized'] += 1
                    else:
                        rec['count_lower'] += 1
                    if rec['first_offset'] is None:
                        rec['first_offset'] = start + t.start
                        rec['first_sentence_index'] = sent_index
                sentences.append({'sentence_index': sent_index, 'start_offset': start, 'end_offset': end, 'tokens': toks, 'text': st})
                sent_index += 1
            # save sentences.jsonl
            if args.dump_sentences:
                processed_dir.mkdir(parents=True, exist_ok=True)
                sent_path = processed_dir / f"{args.text_id}_sentences.jsonl"
                with open(sent_path, 'w', encoding='utf-8') as fh:
                    for s in sentences:
                        fh.write(json.dumps(s, ensure_ascii=False) + "\n")
                print(f"✓ Saved sentences JSONL: {sent_path}")
            # save surface tokens
            if args.dump_surfaces:
                tables_dir.mkdir(parents=True, exist_ok=True)
                sf_path = tables_dir / f"{args.text_id}_surface_tokens.csv"
                import csv
                with open(sf_path, 'w', encoding='utf-8', newline='') as fh:
                    writer = csv.writer(fh)
                    writer.writerow(['surface','lower','count_total','count_capitalized','count_lower','first_offset','first_sentence_index'])
                    for key, rec in sorted(surfaces.items(), key=lambda x: -x[1]['count_total']):
                        writer.writerow([rec['surface'], rec['lower'], rec['count_total'], rec['count_capitalized'], rec['count_lower'], rec['first_offset'] if rec['first_offset'] is not None else '', rec['first_sentence_index'] if rec['first_sentence_index'] is not None else ''])
                print(f"✓ Saved surface tokens CSV: {sf_path}")
        except Exception as e:
            print('✗ Error while dumping sentences/surfaces:', e)
            import traceback
            traceback.print_exc()

    # === ШАГ 7: Подсчёт частот ===
    counts = compute_frequencies(words)
    print(f"✓ Уникальных слов: {len(counts)}")

    # === ШАГ 8: Сохранение CSV таблицы ===
    tables_dir = output_dir / 'tables'
    tables_dir.mkdir(parents=True, exist_ok=True)

    csv_filename = f"{args.text_id}_word_counts.csv"
    csv_path = tables_dir / csv_filename

    save_to_csv(counts, args.text_id, str(csv_path), len(words))

    # === Вывод топ-20 ===
    print("\n" + "="*60)
    print("TOP-20 самых частых слов:")
    print("="*60)

    top20 = counts.most_common(20)
    for i, (term, count) in enumerate(top20, 1):
        per_1k = count / len(words) * 1000 if len(words) > 0 else 0
        print(f"{i:2}. {term:20} {count:5} ({per_1k:.2f} per_1k)")

    print("\n" + "="*60)
    print("✓ ГОТОВО!")
    print("="*60)
    print(f"  Нормализованный текст: {normalized_path}")
    print(f"  Таблица частот: {csv_path}")
    print("\nПримечание: подсчёт выполнен по формам слов (без лемматизации).")
    print("Для лемматизации установите pymorphy2 и запустите с флагом --use-lemmas")


if __name__ == '__main__':
    main()
