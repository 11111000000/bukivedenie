План реализации: вспомогательная таблица «capital-only» + сохранение разбиения на предложения и подключение словарей для whitelist/blacklist

Цель
- Изменить pipeline подсчёта токенов и NER так, чтобы:
  1) generate_word_counts сохранял нормализованный текст и отдельно — разбиение на предложения;
  2) build вспомогательную таблицу surface_tokens.csv, которая фиксирует поверхностные формы (case-preserving) и отмечает те токены, которые встречаются ТОЛЬКО с заглавной первой буквой и не имеют нижнего‑регистрового аналога (capital‑only);
  3) подключить локальные словари (gazetteers) — whitelist и blacklist — и предусмотреть способ их обновления;
  4) дать чёткую схему использования этой вспомогательной таблицы и словарей в src/extractor/ner_heuristic.py для отсеивания шума и сборки персонажей.

Результат
- Новый файлы/артефакты, которые появятся:
  - outputs/processed/{text_id}_normalized.txt (уже есть)
  - outputs/processed/{text_id}_sentences.jsonl  — токенизированные предложения (одна строка JSON = одно предложение, с token list и offsets)
  - outputs/tables/{text_id}_word_counts.csv (существующий, lower forms)
  - outputs/tables/{text_id}_surface_tokens.csv (surface, lower, count, first_offset, sentence_index, is_capitalized_count, is_lower_count)
  - configs/names_whitelist.txt (gazetteer имен и фамилий, один элемент на строку)
  - configs/names_blacklist.txt (частые шумные слова с заглавной буквы)

Ключевые идеи
- Собрать surface_tokens.csv: при токенизации текста хранить каждую surface форму (как встречается в тексте), её lower() вариант и счётчики встреч как capitalized (первая буква заглавная) и как lowercase (первый символ нижний). Токены, у которых is_lower_count == 0 и is_capitalized_count > 0 считаем capital_only candidates.
- Сохранить разбиение на предложения: это позволит точно определять is_first_in_sentence и проверять соседние токены при расширении multiword имен.
- Подключить локальные словари (whitelist/blacklist/gazetteers) в configs/ и использовать их при ранней фильтрации.

Детализованные изменения (шаги)

Шаг 0 — инфраструктура и конфиги (малый, быстрый)
- Добавить в репозиторий папку configs/ если ещё нет.
- Создать пустые файлы:
  - configs/names_whitelist.txt
  - configs/names_blacklist.txt
  - configs/speech_verbs_ru.txt
  - configs/name_titles_ru.txt
- Заполнить их начальными значениями (см. раздел «Рекоммендуемые источники и примеры») — можно начать с небольших списков и расширять.

Шаг 1 — доработать scripts/generate_word_counts.py (core changes)
- Новые опции командной строки:
  --dump-surfaces (bool) — если true, создаёт outputs/tables/{text_id}_surface_tokens.csv
  --dump-sentences (bool) — если true, сохраняет outputs/processed/{text_id}_sentences.jsonl
- Внутри main(), после normalize_text:
  - Использовать razdel.sentenize(text) для разбиения на предложения.
  - Для каждого предложения получить токены (razdel.tokenize) с offsets (razdel token objects содержат start/end), сохранить структуру предложения: {sentence_index, start_offset, end_offset, tokens: [{text, start, end, is_first_in_sentence}]} и записать ее как JSONL (каждая строка — JSON одного предложения). Это даст быстрый доступ к is_first_in_sentence и соседям.
- При сборе words для counts сохранять также surface forms:
  - Для каждой токенизации добавлять в dict surface_map[surface] = {lower: surface.lower(), count_total, count_capitalized, count_lower, first_offset, first_sentence_index}
  - Определение capitalized: если surface[0].isupper() (Unicode-aware). Lower occurrence: surface[0].islower(). (Для токенов, содержащих не‑букву сначала, пробовать найти первый буквеный символ.)
- После подсчёта частот вывести outputs/tables/{text_id}_surface_tokens.csv со столбцами:
    surface, lower, count_total, count_capitalized, count_lower, first_offset, first_sentence_index
- Существующий outputs/tables/{text_id}_word_counts.csv остаётся (lower forms) — совместимость.

Шаг 2 — правки формата и место хранения
- Разрешить outputs path = outputs/tables/ и outputs/processed/ (как уже сделано) и гарантировать, что ner_heuristic читает surface file при наличии.

Шаг 3 — обновить src/extractor/ner_heuristic.py чтобы использовать surface_tokens.csv и sentences.jsonl
- Новая логика (в high level):
  1) Загрузить surface_tokens.csv -> обнаружить capital_only set: surfaces where count_lower == 0 and count_capitalized > 0 and surface not in names_blacklist and meets length/char rules.
  2) Кандидаты single = capital_only ∩ pass_basic_filters
  3) Получить sentences (streaming) из {text_id}_sentences.jsonl — это позволит точно определять для каждого occurrence соседей и is_first_in_sentence
  4) Проход по sentences: если token.surface in single_candidates, проверить соседей (правило: следующий токен начинается с заглавной буквы И не является первым в предложении). Это формирует multiword candidates.
  5) Для каждого candidate (single/multi) выполнить морфологическую проверку (pymorphy2) и scoring (см. далее)
  6) Вывод characters.csv

Шаг 4 — чёткие механизмы фильтрации (подробно)
- Формальные (hard) фильтры применяются при формировании single_candidates:
  - token length >= min_len (default 2)
  - token contains at least one letter (Unicode \p{L})
  - not digits-only
  - not in configs/names_blacklist.txt (case-insensitive check comparing lower())
  - not punctuation-only

- Capital-only selection rule:
  - surface.count_lower == 0 and surface.count_capitalized >= min_capital_count (default 1)
  - surface.lower() not in global stopwords
  - optionally: frequency threshold (count_total >= min_freq_single)

- Morphological filter (soft):
  - parse = morph.parse(surface)[0]
  - if 'Name'/'Surn'/'Pat' in parse.tag => morph_confirmed True
  - try to inflect to nominative: nom = parse.inflect({'nomn'}) or parse.normal_form; use nom as canonical token
  - if POS in penalize_set (VERB, INTJ, ADJF when strongly adjective) => penalize

- Context filter (soft):
  - speech_context: presence of speech verb from configs/speech_verbs_ru.txt within window [-3,+3]
  - title_context: preceding token in configs/name_titles_ru.txt
  - dialog_context: token occurs inside direct speech (sentence or token has quote markers) or line begins with dash
  - is_first_in_sentence ratio: if >0.8 and no speech_context => penalize

- Multiword extension rule:
  - If token T ∈ single_candidates found in sentence at pos i, check j=i+1..i+2 tokens for Titlecase tokens not at sentence start. Build T N and T N M up to max_words (default 3) with modality:
    - require that N is not in blacklist and not punctuation
    - require that at least one of the tokens in the multi has morph_confirmed or speech/title context

- Scoring & thresholds:
  score = w_freq * log(1+count_total) + w_morph * morph_confirmed + w_context * context_score + w_multi * multi_bonus
  Defaults:
    w_freq=1.0, w_morph=1.5, w_context=1.0, w_multi=0.5
  Keep if score >= min_score_keep (default 1.0)

Шаг 5 — словари (whitelist, blacklist, gazetteers): подключение и форматы
- Файлы в configs/ (один элемент в строке, UTF-8, комментарии #)
  - configs/names_whitelist.txt — имена/фамилии в нормальной форме (можно использовать lower). Пример: "анна", "петров"
  - configs/names_blacklist.txt — слова, которые часто встречаются только с заглавной, но не являются именами (междометия, заголовки, названия глав, начала абзацев и т.п.). Пример: "ах","ap","br","capital","dieua" и т. п.
  - configs/speech_verbs_ru.txt — глаголы речи (сказал, ответил, произнёс и т.д.)
  - configs/name_titles_ru.txt — предшествующие титулы (господин, граф, месье, мисс и т.д.)
- Источники: начать с простых локальных списков; затем можно пополнить следующими внешними наборами (ручное скачивание/конвертация):
  - OpenCorpora lists (имен, фамилий) — можно извлечь имена/фамилии
  - Wikidata dumps (entities with instance of human + label ru) — собрать топ‑имен
  - public name lists (gov statistics of given names)
- Формат: plain text, one token per line; loader читает lower() и использует set membership.

Шаг 6 — интеграция с analyze_text.py и workflow
- В analyze_text.py (orchestrator) добавить шаг:
  - Если outputs/tables/{text_id}_surface_tokens.csv и outputs/processed/{text_id}_sentences.jsonl есть — передать их в ner_heuristic
  - Если их нет, ner_heuristic может иметь режим, при котором он сам выполнит tokenize/sentenize (slower)
- Новая CLI flow:
  1) python scripts/generate_word_counts.py --text-id BOOK --dump-surfaces --dump-sentences
  2) python -m src.analyze_text analyze --input data/raw/BOOK.txt --output-dir outputs --run-ner (внутри analyze_text.py вызывается ner_heuristic.extract_characters(...))

Шаг 7 — тесты и отладка
- Добавить tests/test_ner_capital_only.py с кейсами из tasks/mistake.md:
  - Примеры: "\"Анна\nШерер\"", "Ах", "Dieu", различные склонения Анны
  - Проверки: capital_only candidates включает ожидаемые формы; multi extension формирует "Анна Шерер"; blacklist слова исключены
- Добавить опцию --verbose/--debug в ner_heuristic для вывода ner_debug.json (candidates, reasons for drop/accept)

Шаг 8 — производительность и кеширование
- Кешировать pymorphy2.parse и .inflect результаты (functools.lru_cache(maxsize=10000)). Для параллельных запусков можно сохранять кеш на диск (pickle) при --save-cache флаге
- Стриминг: sentences.jsonl можно считывать построчно, не загружая весь текст в память
- Ограничить морфологическую проверку только до кандидатов и их ближайших соседей (не всех токенов)

Шаг 9 — контроль качества / ручная корректировка
- После первой прогона генерировать top N candidates в outputs/<book>/ner_review.csv с колонками: surface_examples, canonical_candidate, score, reason; дать interface в web_view для просмотра и пометки false positives/negatives (опционально)
- Собранные пометки использовать для улучшения configs/names_blacklist.txt и configs/merge_rules.json

Шаг 10 — timeline и оценка
- Шаг 0: создать конфиги и базовые файлы — 0.25 дня
- Шаг 1: доработать generate_word_counts (dump surfaces + sentences JSONL) — 0.5 дня
- Шаг 2: реализовать ner_heuristic чтение surface_tokens и sentences, базовые фильтры single_candidates (capital_only) и multi expansion — 0.75 дня
- Шаг 3: добавить pymorphy2 normalisation, caching и scoring — 0.5 дня
- Шаг 4: кластеризация / fuzzy merge и экспорт characters.csv + tests — 0.5–0.75 дня
- Шаг 5: интеграция в analyze_text.py, debug output, документация — 0.5 дня
Итого: ~3–3.5 рабочих дней на разработку рабочего решения (MVP)

Примеры файлов (схемы)
- outputs/tables/{text_id}_surface_tokens.csv
  columns: surface, lower, count_total, count_capitalized, count_lower, first_offset, first_sentence_index
  пример:
    "Анна", "анна", 120, 120, 0, 1042, 3
    "Ах", "ах", 22, 22, 0, 342, 1
    "переехав", "переехав", 1, 0, 1, 11234, 78

- outputs/processed/{text_id}_sentences.jsonl
  каждая строка JSON:
    {"sentence_index": 0, "start_offset": 0, "end_offset": 232, "tokens": [{"text":"Анна","start":0,"end":4,"is_first":true}, {"text":"Павловна","start":5,"end":13,"is_first":false}, ...]}


Рекомендации по словарям (откуда взять быстро)
- Начать с простого ручного whitelist/blacklist (несколько сотен элементов) — быстро даст эффект.
- Постепенно дополнять:
  - OpenCorpora (names/families lists)
  - Wikidata (labels для entities / человек) — выгружать локально и фильтровать по ru labels
  - Имена из публичных списков (statistical name registries)


Заключение
- Предложенная схема (capital-only candidates из surface_tokens + расширение по предложениям + pymorphy2 + словари) даёт сбалансированный и воспроизводимый путь к высокому precision для персонажного NER в художественных текстах, при этом оставляя возможность увеличить recall через whitelist/gazetteers.
- Важно: изменить generate_word_counts чтобы он сохранял surface/case информацию и разбиение на предложения — это ключевой шаг для корректной работы ner_heuristic.

Дальше я могу:
- Внести правки в scripts/generate_word_counts.py (опцию --dump-surfaces и --dump-sentences) и добавить пример outputs/tables/{text_id}_surface_tokens.csv;
- Реализовать prototype src/extractor/ner_heuristic.py, который читает эти файлы и выводит characters.csv;
- Подготовить начальные configs/* списки (whitelist/blacklist/speech_verbs/titles) с базовыми значениями.

Напишите, какой из трёх шагов (generate_word_counts change / ner_heuristic prototype / configs populate) начать в первую очередь — я выполню. 
