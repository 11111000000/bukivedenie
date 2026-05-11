Резюме: что найдено в phots + snapshot содержимого outputs/

1) Содержимое phots/ (файлы и краткое описание)

- README.md
  Краткое руководство по пайплайну облака слов: структура проекта, быстрый старт, команды Makefile и ожидаемые выходы (tables/, figures/ и т.д.).

- README_cloud_first_version.md
  Заметки и рекомендации для «cloud-first» версии проекта: как организовать загрузку/обработку в облаке.

- STRUCTURE.md
  Простое описание структуры проекта после архивирования: где лежит src/, data/, outputs/ и т.д.; примечания по архивам.

- analysis_chekhov_note.md
  Заметки/анализ, конкретные наблюдения по корпусу Чехова (анализ текста, кейсы обнаружения глав/диалогов и т.п.).

- mistaks.md
  Список замеченных багов/ошибок (typos, проблемы в разборе), план фиксов.

- plan_impl_analyze_text_mvp.md
  План реализации MVP для analyze_text.py и extractor (архитектура, этапы, зависимости, Termux-ограничения).

- plan_master.md
  Более большой план развития проекта (roadmap): улучшения NER, визуализации, интеграции.

- plan_ner_from_tokens.md
  План по извлечению NER на основе токенов (pipeline, газетиры, эвристики).

- plan_ner_with_capital_only.md
  Экспериментальный план NER, основанный на заглавных словах (ограничения, метрики).

- plan_wordcloud_visualization_fp.md
  Заметки по визуализации облака слов (front-end, выбор шрифта, масштабирование, layout).

- run_migration_plan.md
  Короткие заметки про миграции (архивирование старых данных и перенос).

- termux_quickstart.md
  Инструкции по быстрому старту в Termux: setup, зависимости, запуск analyze_text.

- webapp_analysis.md
  Замечания по веб‑интерфейсу: API, безопасность, рендеринг файлов, проблемы с token_by_chapter.

Файл создан: phots/summary_and_outputs_snapshot.md (этот файл).


2) Snapshot содержимого outputs/ (на момент проверки)

Общее дерево (файлы, сгруппированы по директориям):

- processed/
  - tolstoj_lew_nikolaewich-text_1_normalized.txt
  - test_book_normalized.txt
  - test_book_sentences.jsonl

- tables/
  - test_book_word_counts.csv
  - test_book_surface_tokens.csv

- test_book/ (outputs/test_book/)
  - tokens.csv
  - chapters_summary.json
  - characters.csv
  - character_freq_by_chapter.csv
  - cooccurrence_edges.csv
  - sentiment_by_chapter.csv
  - hapax.csv
  - complexity_metrics.json
  - run_metadata.json
  - punctuation_counts.csv
  - cloud_generation.log
  - token_freq_by_chapter.csv

- чехов-письмо/ (outputs/чехов-письмо/)
  - chapters_summary.json
  - tokens.csv
  - cooccurrence_edges.csv
  - characters.csv
  - complexity_metrics.json
  - hapax.csv
  - character_freq_by_chapter.csv
  - sentiment_by_chapter.csv
  - run_metadata.json
  - punctuation_counts.csv

- tolstoj_lew_nikolaewich-text_1/ (outputs/tolstoj_lew_nikolaewich-text_1/)
  - chapters_summary.json
  - tokens.csv
  - cooccurrence_edges.csv
  - characters.csv
  - complexity_metrics.json
  - hapax.csv
  - character_freq_by_chapter.csv
  - sentiment_by_chapter.csv
  - token_freq_by_chapter.csv
  - punctuation_counts.csv
  - run_metadata.json
  - cloud_generation.log

- tolstoj_lew_nikolaewich-text_2/ (outputs/tolstoj_lew_nikolaewich-text_2/)
  - chapters_summary.json
  - tokens.csv
  - cooccurrence_edges.csv
  - characters.csv
  - complexity_metrics.json
  - hapax.csv
  - character_freq_by_chapter.csv
  - sentiment_by_chapter.csv
  - cloud_generation.log
  - punctuation_counts.csv
  - run_metadata.json

- tolstoj_lew_nikolaewich-text_3/ (outputs/tolstoj_lew_nikolaewich-text_3/)
  - chapters_summary.json
  - tokens.csv
  - cooccurrence_edges.csv
  - characters.csv
  - complexity_metrics.json
  - hapax.csv
  - character_freq_by_chapter.csv
  - sentiment_by_chapter.csv
  - punctuation_counts.csv
  - run_metadata.json

- tolstoj_lew_nikolaewich-text_4/ (outputs/tolstoj_lew_nikolaewich-text_4/)
  - chapters_summary.json
  - tokens.csv
  - cooccurrence_edges.csv
  - characters.csv
  - complexity_metrics.json
  - hapax.csv
  - character_freq_by_chapter.csv
  - sentiment_by_chapter.csv
  - token_freq_by_chapter.csv
  - punctuation_counts.csv
  - run_metadata.json
  - cloud_generation.log


3) Какие «книги»/идентификаторы обнаружены

На основе структуры outputs/ обнаружены следующие book_id / наборы данных:
- test_book
- чехов-письмо
- tolstoj_lew_nikolaewich-text_1
- tolstoj_lew_nikolaewich-text_2
- tolstoj_lew_nikolaewich-text_3
- tolstoj_lew_nikolaewich-text_4

Для каждого из них имеются (как минимум) следующие артефакты:
- chapters_summary.json — сводка по главам (названия, оффсеты, длины)
- tokens.csv — общие частоты токенов
- character-related файлы: characters.csv и character_freq_by_chapter.csv
- cooccurrence_edges.csv — ребра для графа персонажей
- sentiment_by_chapter.csv — тональность по главам (если включено)
- hapax.csv, complexity_metrics.json, punctuation_counts.csv — дополнительные метрики
- run_metadata.json и cloud_generation.log — вспомогательные логи/метаданные
- В некоторых книгах присутствует token_freq_by_chapter.csv (предвычислённый CSV), в других — его нет, но UI использует серверный /api/token_by_chapter как fallback.

4) Примечания и рекомендации

- Для быстрой отладки UI: test_book содержит полный набор файлов, включая token_freq_by_chapter.csv и таблицы в outputs/tables/, поэтому использовать test_book для проверки виджета token_by_chapter удобно.

- Есть отдельная папка processed/ где лежат нормализованные тексты и sentences.jsonl (processed/*_sentences.jsonl) — эти файлы используются сервером для динамического подсчёта частот по главам при отсутствии предвычисленного CSV.

- Если нужно, могу:
  - сгенерировать короткий CSV-дамп с перечнем файлов и их размеров (bytes) для archiving/diff;
  - добавить в phots README краткую инструкцию, какие файлы гарантированно создаются analyze_text.py и какие опциональны (--dump-surfaces, --dump-sentences);
  - переместить этот snapshot в phots/outputs_snapshot_TIMESTAMP.txt с таймстампом.

---
Файл записан: storage/shared/bukivedenie/phots/summary_and_outputs_snapshot.md
