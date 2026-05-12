# План реализации MVP: analyze_text.py + extractor (по plan_master.md)

Важно: скрипт Python запускается в Termux (Android). Все решения и зависимости учитывают ограничения Termux: по умолчанию — только чисто‑питоновые пакеты, без тяжёлых нативных сборок. Предусмотрен облегчённый requirements_termux.txt и режим без pandas/numpy.

Цель: за 2–3 итерации сделать детерминированный CLI‑скрипт, который принимает текст(ы) и выдаёт готовые для анализа данные (CSV/JSON) без LLM и тяжёлых моделей. Платформа: Termux (Android), Python 3.10+.

1) Архитектура и структура файлов
- Новые файлы/директории
  - src/extractor/__init__.py — пакет
  - src/extractor/core.py — ядро конвейера (нормализация, разбиение, токенизация)
  - src/extractor/chapters.py — детекция глав
  - src/extractor/dialogs.py — детекция диалогов/цитат
  - src/extractor/ner_heuristic.py — эвристический NER по заглавным словам
  - src/extractor/cooccur.py — ко‑встречаемость (по предложению/абзацу)
  - src/extractor/metrics.py — частоты, hapax, Yule’s K, Honore’s R и др.
  - src/extractor/sentiment.py — lexicon‑based тональность (ru/en), опционально VADER
  - src/extractor/io.py — экспорт CSV/JSON, структура outputs/<book_id>/
  - src/extractor/config.py — dataclass конфигурации + валидация
  - src/analyze_text.py — Typer‑CLI, точка входа
  - tests/ — pytest тесты на ключевые узлы (минимум)
- Использовать уже имеющееся: preprocessing/normalize.py, tokenize.py — реиспользовать/адаптировать при необходимости.

2) Требования и зависимости
- Termux‑минимум (см. requirements_termux.txt — уже добавлен):
  - razdel>=0.3.0, regex>=2023.10.3 — разбиение/токенизация (чистый Python)
  - typer>=0.9.0 — CLI
  - dawg-python, pymorphy2, pymorphy2-dicts-ru — лемматизация RU без C++ DAWG
  - vaderSentiment — опционально для EN тональности
  - tqdm — прогресс‑бары (без лишних зависимостей)
- Полный requirements.txt (десктоп): можно оставить как есть для пайплайна облака слов, но для analyze_text.py по умолчанию НЕ требуются numpy/pandas/matplotlib.
- Словари/лексиконы:
  - configs/lexicons/ru_sentiment.tsv (простая шкала −1..+1)
  - configs/stopwords_{ru,en}.txt (при необходимости)
- Избегаем: spaCy/Natasha, torch/transformers по умолчанию (в Termux ставятся тяжело). Включать только по флагам в будущем.

3) Конвейер (детерминированный)
- Вход: файл .txt или директория .txt —> список (book_id, raw_text)
- Нормализация (core.py):
  - NFC, CRLF->LF, унификация кавычек/тире/многоточий, нормализация пробелов, удаление управляющих символов
- Разбиение на абзацы и предложения (core.py):
  - абзацы: 2+ переводов строки; poetry_mode (1 перенос) — флаг future
  - предложения: regex по [.!?…] с учётом кавычек/скобок; исключить общие аббревиатуры/инициалы/URL/email
- Токенизация (core.py):
  - Unicode‑aware; типы: word, number, punct, symbol, abbrev, roman, url, email
  - нижний регистр + базовая лемматизация для ru через pymorphy2 (флаг)
- Главы (chapters.py):
  - авто‑детекция по паттерну; override через --chapter-pattern
- Диалоги/цитаты (dialogs.py):
  - is_dialog: строки/предложения, начинающиеся с тире/кавычек
- Эвристический NER (ner_heuristic.py):
  - последовательности Заглавных Слов; составные имена; частоты; first_offset
- Ко‑встречаемость (cooccur.py):
  - по предложению/абзацу; вес = число совместных появлений
- Метрики и словари (metrics.py):
  - частоты токенов (forms/lemmas), rank, per_1k
  - hapax legomena
  - Yule’s K, Honore’s R, лексическая плотность
- Тональность (sentiment.py):
  - по словарю (ru/en) — простой суммарный скор по главам/окнам
  - опционально VADER для en (по флагу)
- Экспорт (io.py):
  - чистый csv/json (модуль csv/json), без pandas
  - outputs/<book_id>/tokens.csv
  - chapters_summary.json
  - characters.csv
  - character_freq_by_chapter.csv
  - cooccurrence_edges.csv
  - sentiment_by_chapter.csv
  - frequency_dictionary.csv
  - hapax.csv
  - complexity_metrics.json
  - run_metadata.json (время, флаги, версии)

4) CLI интерфейс (analyze_text.py на Typer)
- Обязательные параметры:
  - --input PATH (файл .txt или директория с .txt)
  - --output-dir DIR
  - --lang [ru|en|auto]
- Опции:
  - --chapter-pattern REGEX
  - --ner [off|heuristic] (по умолчанию heuristic)
  - --sentiment [off|lexicon|vader] (по умолчанию lexicon)
  - --cooccurrence-level [sentence|paragraph] (по умолчанию sentence)
  - --use-lemmas/--no-use-lemmas (по умолчанию use-lemmas для ru)
  - --parquet (опционально позже; в Termux по умолчанию off)
  - --workers N, --verbose, --dry-run
- Особенности Termux:
  - multiprocessing только при guard if __name__ == "__main__" и контекст spawn
  - ограничивать число воркеров (обычно 2–4 ядра на телефоне)
  - пути по умолчанию в $HOME/…; для доступа к shared storage: termux-setup-storage
- Возврат: сводный JSON в stdout + пути к экспортам в outputs/

5) Этапы работ и сроки
- Этап 0 (0.5 дня): каркас
  - создать пакеты extractor/, config dataclass, Typer‑CLI, парсинг входов
  - прочитать один .txt, проброс конфигурации
- Этап 1 (1–1.5 дня): ядро
  - нормализация, абзацы, предложения, токенизация; базовые частоты; экспорт tokens.csv, frequency_dictionary.csv
  - unit‑тесты на разбиение/токенизацию
- Этап 2 (1 день): главы, диалоги, NER (heuristic)
  - chapters_summary.json, characters.csv, character_freq_by_chapter.csv
  - тесты на главы/персонажи
- Этап 3 (0.5–1 день): ко‑встречаемость, сложность
  - cooccurrence_edges.csv, hapax.csv, complexity_metrics.json
- Этап 4 (0.5 дня): тональность + сводка
  - sentiment_by_chapter.csv, сводный JSON, run_metadata.json
- Этап 5 (0.5 дня): полировка под Termux
  - оптимизация памяти/скорости, логгирование, документация в README.md
  - проверка установки зависимостей на чистом Termux, фиксация инструкций и известных проблем
Итого: ~4–5 дней чистого времени.

6) Тестирование и критерии приёмки
- tests/:
  - test_normalize_split.py — корректное разбиение на абзацы/предложения
  - test_tokenize.py — типы токенов, лемматизация ru
  - test_chapters.py — auto/override паттерны
  - test_ner_heuristic.py — выделение имён и частот
  - test_cooccur.py — корректные рёбра
  - test_metrics.py — частоты, hapax, Yule/Honore на эталонных мини‑корпусах
  - test_sentiment.py — знаки по главам (ручные кейсы)
- Приёмка MVP:
  - Запуск: python -m src.analyze_text --input data/raw/book.txt --output-dir outputs --lang ru
  - В outputs/<book_id>/ сформированы все файлы из раздела 3; время < 60с на текст ~1–2 МБ в Termux; память < 300 МБ.

7) Риски и решения
- Сложные аббревиатуры/инициалы ломают сплит — расширяем список исключений в regex
- Смешанные языки — lang=auto по символам и базовым словарям
- Ограничения Termux — отключаем тяжёлое по умолчанию; параллельность по файлам (--workers)
- Отсутствие лексиконов — добавить простые встроенные минимальные списки, затем расширять через configs/

8) Интеграция с текущим проектом
- Не ломаем существующий пайплайн облака слов; общий код выносим в extractor/core.py и при желании используем из scripts/compute_counts.py
- README: добавить раздел «Аналитика текста (MVP)» с примерами

10) Termux: практические инструкции
- Установка окружения:
  - pkg update && pkg upgrade
  - pkg install python git
  - termux-setup-storage  # для доступа к /storage/emulated/0
  - cd desim/bukivedenie && pip install --upgrade pip
  - pip install -r requirements_termux.txt
- Запуск:
  - python -m src.analyze_text --input data/raw/book.txt --output-dir outputs --lang ru --workers 2
- Папки/пути:
  - outputs пишем в $HOME/desim/bukivedenie/outputs; при желании указывать --output-dir "/storage/emulated/0/Download/bukivedenie"
- Шрифты/визуализации:
  - analyze_text.py не требует matplotlib; визуализация облака слов — отдельный пайплайн. Для него в Termux использовать системные шрифты: /system/fonts/NotoSans-Regular.ttf
- Отказоустойчивость:
  - при недоступности pymorphy2 автоматически падать в режим без лемматизации (--no-use-lemmas)
  - весь экспорт — простые csv/json, без pandas/numpy

9) Следующие шаги после MVP
- Параметрический экспорт Parquet; лёгкий REST (FastAPI) по флагу
- Улучшение NER (Natasha/spaCy — по флагу, не по умолчанию)
- Визуализации (ECharts/Chart.js) поверх экспортов
