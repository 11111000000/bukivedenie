# Быстрый старт в Termux

## 1. Установка окружения

```bash
# Обновление пакетов
pkg update && pkg upgrade

# Установка Python и git
pkg install python git

# Настройка доступа к хранилищу (опционально)
termux-setup-storage

# Переход в проект
cd ~/desim/bukivedenie

# Установка зависимостей
pip install --upgrade pip
# Установка minimal deps для analyze_text
pip install -r requirements_termux.txt
# Опционально: установить razdel для улучшенного разбиения на предложения
pip install razdel
# Если нужна VADER для английского sentiment:
# pip install vaderSentiment

# Если pymorphy2 вызывает ошибки в Termux, запускать с --no-use-lemmas или установить pymorphy2-dicts-ru
# pip install pymorphy2 pymorphy2-dicts-ru
```

## 2. Запуск анализа

```bash
# Анализ одного файла
python -m src.analyze_text \
    --input data/raw/test_book.txt \
    --output-dir outputs \
    --lang ru

# Анализ всех файлов в директории
python -m src.analyze_text \
    --input data/raw/ \
    --output-dir outputs \
    --lang ru \
    --workers 2

# С подробным выводом
python -m src.analyze_text \
    --input data/raw/test_book.txt \
    --output-dir outputs \
    --lang ru \
    --verbose
```

## 3. Просмотр результатов

```bash
# Список выходных файлов
ls -la outputs/test_book/

# Частотный словарь
head outputs/test_book/frequency_dictionary.csv

# Персонажи
cat outputs/test_book/characters.csv

# Метрики сложности
cat outputs/test_book/complexity_metrics.json

# Тональность по главам
cat outputs/test_book/sentiment_by_chapter.csv
```

## 4. CLI команды

```bash
# Полная справка
python -m src.analyze_text --help

# Справка по команде analyze
python -m src.analyze_text analyze --help

# Быстрая информация о файле
python -m src.analyze_text info --input data/raw/test_book.txt
```

## 5. Параметры CLI

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `--input` | Путь к .txt файлу или директории | (обязательно) |
| `--output-dir` | Директория для результатов | (обязательно) |
| `--lang` | Язык: ru, en, auto | ru |
| `--chapter-pattern` | Regex для детекции глав | авто |
| `--ner` | Режим NER: off, heuristic | heuristic |
| `--sentiment` | Тональность: off, lexicon, vader | lexicon |
| `--cooccurrence-level` | Уровень: sentence, paragraph | sentence |
| `--use-lemmas` | Лемматизация | True |
| `--workers` | Число воркеров | 2 |
| `--verbose` | Подробный вывод | False |
| `--dry-run` | Без записи на диск | False |

## 6. Выходные файлы

В `outputs/<book_id>/` создаются:

| Файл | Описание |
|------|----------|
| `tokens.csv` | Частоты токенов |
| `frequency_dictionary.csv` | Частотный словарь |
| `chapters_summary.json` | Сводка по главам |
| `characters.csv` | Персонажи (NER) |
| `character_freq_by_chapter.csv` | Частоты по главам |
| `cooccurrence_edges.csv` | Ко-встречаемость |
| `sentiment_by_chapter.csv` | Тональность |
| `hapax.csv` | Hapax legomena |
| `complexity_metrics.json` | Метрики сложности |
| `run_metadata.json` | Метаданные запуска |

## 7. Известные ограничения Termux

- **Память**: для больших текстов (>5 МБ) используйте `--workers 1`
- **Multiprocessing**: используется spawn, избегайте fork
- **Шрифты**: для визуализаций используйте `/system/fonts/NotoSans-Regular.ttf`
- **Хранилище**: доступ к `/storage/emulated/0` требует `termux-setup-storage`

## 8. Тестирование

```bash
# Запуск тестов
cd ~/desim/bukivedenie
python tests/test_core.py
python tests/test_metrics.py
```
