# Облако слов — первый рабочий вариант

Цель: быстро получить PNG облако слов из уже имеющейся таблицы частот без вмешательства в основной пайплайн.

Скрипт: scripts/plot_wordcloud_from_counts.py
- Источник: outputs/tables/{text_id}_word_counts.csv (term,count,per_1k). Этот файл генерирует scripts/generate_word_counts.py.
- Конфиг: configs/cloud.yml (шрифт, размеры, фон, маска и т.п.).
- Зависимости: wordcloud, pyyaml (pandas не обязателен).

Примеры запуска
- Минимальный:
  python scripts/plot_wordcloud_from_counts.py --text-id test_book
- С явным путём к CSV:
  python scripts/plot_wordcloud_from_counts.py --text-id test_book --counts-path outputs/tables/test_book_word_counts.csv --scale sqrt --top-n 300

Результаты
- PNG: outputs/figures/wordclouds/{text_id}/{text_id}__unit-forms__scale-...__top-...__.png
- meta.json рядом (параметры запуска, путь к источнику и т.д.)

Сообщения об ошибках
- Развёрнутые и с подсказками (нет файла, пустые данные, проблемы со шрифтом/маской и т.д.).

Следующие шаги
- Добавить lite‑backend (Pillow) для Termux без wordcloud/numpy/matplotlib.
- Расширить скрипт для чтения outputs/<book_id>/tokens.csv.
- Интеграция в веб‑интерфейс через новые эндпоинты /api/figures и /api/figure_download.
