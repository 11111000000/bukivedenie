План реализации NER‑pipeline из списка токенов + текст (для src/extractor/ner_heuristic.py)

Цель
- Надёжно извлекать список персонажей из литературного текста, используя двухэтапный алгоритм: сначала отбор кандидатов из списка токенов (frequency table), затем проверка и расширение по исходному тексту (поиск составных имён).
- Платформа: Termux/локальный Python (ограничить тяжёлые зависимости). Использовать razdel и pymorphy2; избегать spaCy/transformers по умолчанию.

Входы
- tokens.csv (или таблица частот): столбцы: token, count, rank, per_1k (ориентир)
- Исходный текст (.txt) из data/raw/<book>.txt
- Конфигурационные списки в configs/: blacklist, speech_verbs, titles, name_whitelist (опционально)

Выходы
- outputs/<book_id>/characters.csv (canonical_name, surfaces, count, first_offset, score, type)
- outputs/<book_id>/character_freq_by_chapter.csv (опционально)
- Логи/вспомогательные файлы: outputs/<book_id>/run_ner.log, outputs/<book_id>/ner_debug.json (при --verbose)

Общая идея (алгоритм)
1) Preprocessing text
  - Нормализация кавычек/тире, замена CRLF->LF
  - Склейка переносов внутри парных кавычек: "Анна\nШерер" -> "Анна Шерер"
  - Токенизация и разбиение на предложения (razdel). Для каждого токена сохранять: surface, start_offset, sentence_index, token_index_in_sentence, is_first_in_sentence

2) Build single-token candidates (from tokens list)
  - Фильтрация по формальным признакам:
    - Начинается с заглавной буквы (Unicode-aware)
    - Длина >= 2
    - Не содержит цифр/символов (разрешать дефис для сложных фамилий)
    - Не в blacklist (configs/names_blacklist.txt)
    - Частота >= min_freq_single (настраивается; default 1 для high-recall, 2-3 для strict)
  - Морфологическая проверка (pymorphy2):
    - parse = morph.parse(token)[0]
    - Получить normal_form = parse.normal_form
    - Определить morph_tags = parse.tag
    - Если 'Name'/'Surn'/'Pat' присутствует — mark high_confidence
    - Попытаться inflect({'nomn'}) чтобы получить именительный падеж (если возможно)
  - Сохранить mapping: canonical_single -> {surfaces set, freq_sum, offsets, morph_tags, base_score}

3) Scan text to form multi-token candidates
  - Для каждой позиции в тексте (по предложениям): если токен t нормализуется в canonical_single:
    - Проверить следующий токен n:
      - Условие для объединения: n[0] isupper AND (not n.is_first_in_sentence OR preceding token (or preceding char) is title like 'госпожа') AND n not blacklist
      - На практике: require (i+1 < len(sentence) and sentence.tokens[i+1].surface[0].isupper() and not sentence.tokens[i+1].is_first_in_sentence) OR (title before t OR title before n)
    - Если условие выполняется — candidate_multi = t + ' ' + n
    - Нормализовать оба токена, canonical_multi = norm(t) + ' ' + norm(n)
    - Также обрабатывать 3‑словные имена (проверять второе и третье слово при необходимости)
  - Специальный кейс: инициалы (I. I. Иванов) и формат "И. И. Иванов" — распознавать по паттерну (Capital\.){1,2} Capital

4) Scoring и фильтрация
  - Для каждой сущности (single или multi) вычислить score:
    score = w_freq * log(1 + freq) + w_morph * morph_score + w_context * context_score + w_len * len_bonus
    где:
      - freq = total occurrences (в tokens.csv + найденные в тексте)
      - morph_score = 1.0 если pymorphy2 пометил как Name/Surn/Pat, 0.5 если частично, 0.0 иначе
      - context_score = 1.0 если встречаются рядом глаголы речи/титулы/диалоги; 0.5 если встречается в диалогах; 0.0 иначе
      - len_bonus = +0.5 для multiword (2+) имен
      - веса по умолчанию: w_freq=1.0, w_morph=1.5, w_context=1.0, w_len=0.5 (подлежит калибровке)
  - Откинуть сущности с score < min_score (default 1.0)
  - Дополнительно: penalize candidates, которые >80% встречаются исключительно в начале предложений и не имеют speech_context

5) Кластеризация / объединение форм
  - Группировать по canonical form (normal_form токенов). Это объединяет склонённые формы.
  - Дальнейшее объединение похожих canonical групп: fuzzy matching
    - Использовать difflib.get_close_matches(key, keys, cutoff=fuzzy_thresh) с fuzzy_thresh default=0.85
    - Условия объединения: low-frequency группы + высокий token similarity OR сильная cooccurrence (часто появляются в одних абзацах)
  - Результат: финальные кластеры с canonical_name (выбор: наиболее частая surface или normalized form)

6) Export
  - characters.csv columns:
    canonical_name, canonical_norm, surfaces (pipe-separated top K), total_count, first_offset, score, type(single/multi), flags (morph_confirmed, in_dialogs, has_title)
  - character_freq_by_chapter.csv (опционально)
  - run_ner.log и ner_debug.json при --verbose: содержимое промежуточных структур

7) Интерактивный ревью (опционально)
  - Выдавать web UI preview top K кандидатов с checkbox accept/reject; сохранять правки в configs/whitelist.txt и configs/merge_rules.json


Детализация фильтрационных механизмов (чётко)

A. Формальные фильтры (жёсткие)
- Начальная буква: must match regex ^\p{Lu} (или в Python: token[0].isupper() с Unicode aware)
- Длина >= 2 символа (исключая апострофы и кавычки)
- Содержит >= 1 букву (regex [\p{L}])
- Не содержит цифр
- Не состоит только из пунктуации/символов
- Не входит в blacklist (configs/names_blacklist.txt) — список: междометия, иностранные междометия/восклицания, слова, часто встречающиеся в начале предложения, но не имена (пример: Ах, Oh, Eh, Dieux, Dieu, Ap, Br)

B. Морфологическая фильтрация (мягкие правила)
- pymorphy2 tags
  - If parse.tag contains 'Name' or 'Surn' or 'Pat' => morphological confirmation (strong positive)
  - If parse.tag.POS == 'NOUN' and capitalized => possible name (weaker)
  - If parse.tag.POS in {'VERB','ADJF','ADV','PRCL','INTJ'} => likely noise (penalize or drop)
- Inflection to nominative:
  - try: inflected = parse.inflect({'nomn'}) and use inflected.word_form as canonical
  - if inflect not supported or fails, fallback to parse.normal_form

C. Контекстные сигналы (усилители)
- Speech verbs window: check presence of speech verbs within window [-3,+3] tokens (configs/speech_verbs_ru.txt). If present => +context_score
- Titles: preceding tokens like {господин, госпожа, месье, мисс, граф, барон, доктор, полковник} => mark has_title and +context_score
- Dialogue markers: if occurrence inside direct speech or next to dash beginning line => +context_score
- Cooccurrence: if candidate co-occurs with already high-score character in same sentence or paragraph => boost

D. Penalizations
- If >80% occurrences at sentence start and no context signals => -penalty
- If majority of surfaces contain non-letter chars or are quoted fragments ("...") after cleanup => drop
- If token appears predominantly as lowercase in other contexts (mixed case) => lower trust

E. Merge logic (конкретика)
- Primary grouping key: tuple(normal_forms) for multiword or single normal_form for single.
- For groups with close spellings (difflib ratio >= fuzzy_thresh): merge if
  - sum_freq < merge_freq_threshold (например < 10) OR
  - cooccurrence_strength >= cooccur_thresh
- After merge recompute canonical_name by selecting surface with highest frequency or most complete multiword form


Интеграция с текущим скриптом (точные места изменить)
- Файл: src/extractor/ner_heuristic.py — создать/обновить
  - Функции:
    - preprocess_text_for_ner(text: str) -> TokenizedDoc (sentences/tokens with offsets)
    - build_single_candidates_from_tokens(tokens_csv_path: Path, min_freq:int) -> Dict[canonical, Candidate]
    - scan_text_expand_multis(doc: TokenizedDoc, single_candidates: Dict) -> Dict[canonical_multi, Candidate]
    - compute_scores_and_filter(candidates: Dict, config) -> Dict[canonical, Candidate]
    - cluster_and_merge(candidates: Dict, config) -> List[FinalCharacter]
    - export_characters(final_characters, out_dir)
  - Hook: analyze_text.py call flow — после подсчёта частот и до экспорта characters.csv вызвать ner_heuristic.extract_characters(input_text_path, tokens_csv_path, out_dir, config)

- Конфигурация: src/extractor/config.py / configs/ner.yml
  - параметры: min_freq_single, min_score, fuzzy_threshold, merge_freq_threshold, window_speech_verbs, use_pymorphy (bool), verbose

- Тесты: tests/test_ner_heuristic.py
  - кейсы: "Анна Павловна Шерер" (с переносами внутри кавычек), "Ах", "Dieu", "Анна/Анну/Анной" (склонения), инициалы, титулы


Псевдокод (упрощённый)

# сбор кандидатов single
single_candidates = {}
for token, count in tokens_table:
    if not is_capitalized(token): continue
    if len(token) < 2: continue
    if contains_digit(token): continue
    if token in blacklist: continue
    p = morph.parse(token)[0]
    morph_score = 1.0 if any(tag in p.tag for tag in ('Name','Surn','Pat')) else 0.0
    try:
        nom = p.inflect({'nomn'}).word_form
    except Exception:
        nom = p.normal_form
    key = nom
    update single_candidates[key] with surface token, freq += count, morph_score aggregated

# expand multi by scanning text
for sent in doc.sentences:
    for i, tok in enumerate(sent.tokens):
        key = normalize(tok.text)
        if key in single_candidates:
            if i+1 < len(sent.tokens):
                nxt = sent.tokens[i+1]
                if is_capitalized(nxt.text) and not nxt.is_first_in_sentence:
                    # form multi
                    nom1 = canonical(tok); nom2 = canonical(nxt)
                    keym = nom1 + ' ' + nom2
                    update multi_candidates[keym]

# scoring
for cand in all_candidates:
    score = w_freq * log(1+cand.freq) + w_morph * cand.morph_score + w_context * cand.context_score + w_len * (2 if multi else 1)
    if score >= min_score: keep

# cluster merge + export
merge_similar_keys(...)
export CSV


Требования к ресурсам и производительность
- Алгоритм проходит по token list и по тексту O(n_tokens + n_text_tokens). Для книги ~ 100k токенов это быстро (секунды–десятки секунд) в Python с razdel и pymorphy2.
- pymorphy2 парсинг может быть бутылочным горлышком — кешировать результаты по surface token.
- Для больших корпусов включить batch/caching и ограничение число парсингов (только для candidate tokens, а не для всех токенов в тексте).

Тестирование и валидация
- Создать gold sample (несколько глав) с ручной разметкой имен.
- Метрики: Precision/Recall/F1 для упоминаний и для сущностей (после кластеризации).
- Регулярная панель ошибок: хранить частые false positives в configs/names_blacklist.txt и улучшать правила.

Оценка времени реализации (ориентировочно)
- Создать файл и каркас функций: 0.5 дня
- Реализовать build_single_candidates + pymorphy2 + caching: 0.5 дня
- Реализовать scan_text_expand_multis + простое scoring: 0.5 дня
- Реализовать clustering/merge + export + тесты: 0.5–1 дня
- Интеграция с analyze_text, документация и отладка: 0.5 дня
Итого: ~2.5–3.5 рабочих дня (single developer). Можно получить минимально работающее решение за 1–1.5 дня.

Дальнейшие улучшения (после MVP)
- Интеграция gazetteer (списки имен/фамилий) для улучшения recall.
- Обучение CRF/transformer reranker на размеченных примерах.
- Coreference resolution для объединения упоминаний по документу.
- Интерактивный веб‑интерфейс для ревью и правок персонажей.

Файлы, которые следует добавить/обновить
- src/extractor/ner_heuristic.py (основной модуль)
- configs/names_blacklist.txt
- configs/speech_verbs_ru.txt
- configs/name_titles_ru.txt
- tests/test_ner_heuristic.py
- update analyze_text.py для вызова ner_heuristic

---
Файл создан автоматически — при желании внедрю прототип сразу в репозиторий и добавлю тесты. Напишите, если нужно, чтобы я реализовал первый функциональный шаг (сбор single candidates + pymorphy2 нормализация).