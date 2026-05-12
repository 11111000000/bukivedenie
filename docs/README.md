# Bukivedenie — Конвейер облака слов

Воспроизводимый пайплайн для построения облака слов из текста на русском языке.

## Структура

```
bukivedenie/
├─ configs/           # Конфигурации
│  ├─ stopwords_ru.txt # Стоп-слова
│  ├─ cloud.yml        # Параметры визуализации
│  ├─ pipeline.yml     # Параметры пайплайна
├─ scripts/           # Скрипты
│  ├─ ingest_normalize.py  # Нормализация текста
│  ├─ compute_counts.py    # Подсчёт частот
│  ├─ plot_wordcloud.py    # Визуализация
├─ data/
│  ├─ raw/             # Исходные тексты
│  ├─ processed/       # Нормализованные тексты + метаданные
├─ outputs/
│  ├─ tables/          # CSV с частотами
│  ├─ figures/         # PNG облака слов
├─ requirements.txt
├─ Makefile
├─ README.md
```

## Быстрый start

### 1. Установка зависимостей

```bash
cd desim/bukivedenie
pip install -r requirements.txt
```

### 2. Подготовка текста

Положите исходный текст в `data/raw/`:

```bash
# Пример:
# data/raw/tolstoy_viwm.txt
```

### 3. Запуск пайплайна

```bash
# Всё сразу:
make all TEXT_ID=tolstoy_viwm

# Или по шагам:
make ingest TEXT_ID=tolstoy_viwm
make counts TEXT_ID=tolstoy_viwm UNIT=lemmas
make cloud TEXT_ID=tolstoy_viwm SCALE=sqrt TOPN=400
```

### 4. Результат

- Нормализованный текст: `data/processed/texts/{TEXT_ID}.txt`
- Таблица частот: `outputs/tables/vocab_lemma_counts.csv`
- Облако слов: `outputs/figures/wordclouds/{TEXT_ID}/...png`

## Параметры

### UNIT (единица учёта)
- `lemmas` — леммы (рекомендуется для русского)
- `forms` — формы слов

### SCALE (масштабирование веса)
- `sqrt` — сглаживает доминирование топ-слов
- `log` — более агрессивное сглаживание
- `linear` — без сглаживания

### TOPN
- Максимальное число слов в облаке (300–500 рекомендуется)

## Проверка шрифта

Для кириллицы нужен шрифт с поддержкой русских букв. В `configs/cloud.yml` указан:
```yaml
font_path: "/system/fonts/NotoSans-Regular.ttf"
```

Если шрифт не найден, положите DejaVuSans.ttf в `configs/fonts/` и обновите конфиг.

## Следующие шаги

См. `phots/plan_pipeline_wordcloud_from_text.md` — подробный план развития пайплайна.