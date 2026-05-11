# Визуализация облака слов — функциональный план и интеграция в веб-интерфейс

Цель: создать воспроизводимую визуализацию «облака слов/символов», которая не модифицирует исходные данные анализа, основана на чистых функциях и легко встраивается в текущий HTML‑просмотрщик.

## Принципы (FP)
- Чистые функции: трансформации и раскладка не имеют побочных эффектов.
- Иммутабельность: доменные структуры неизменяемые (frozen dataclass).
- Разделение IO и вычислений: чтение/запись файлов — только в тонких обёртках.
- Детерминизм: все рандом‑решения завязаны на явный seed.
- Визуализация не влияет на данные: читаем tokens.csv/vocab_*.csv/punctuation_counts.csv, пишем только в outputs/figures/wordclouds/…

## Источники данных
- Книга: outputs/<book_id>/tokens.csv (token,count,rank,per_1k) — основной источник.
- Альтернатива: outputs/tables/vocab_{lemmas|forms}_counts.csv + фильтр по text_id.
- Облако символов: outputs/<book_id>/punctuation_counts.csv (punct,count,per_1k).
- По главам (если есть): outputs/<book_id>/token_freq_by_chapter.csv.

## Архитектура модулей
1) cloud.domain (чисто)
- TermFreq(term: str, count: int, per_1k: float)
- CloudConfig (параметры визуализации)
- WeightedTerm(term, weight: float)
- SizedTerm(term, font_size: float, rotate_deg: int)
- PlacedWord(term, x: int, y: int, font_size: float, rotate_deg: int, color: str, bbox: tuple)
- Mask (битовая маска допустимых пикселей)

2) cloud.parse (IO → доменные структуры)
- load_config(path) -> CloudConfig
- read_stopwords(path) -> Set[str]
- read_freqs_from_tokens_csv(path) -> List[TermFreq]
- read_freqs_from_vocab_csv(path, text_id) -> List[TermFreq]
- read_mask(path) -> Mask

3) cloud.transform (чисто)
- filter_terms(freqs, stopwords, min_count, per1k_min) -> List[TermFreq]
- select_topn(freqs, n) -> List[TermFreq]
- scale_weights(freqs, scale: linear|sqrt|log|tfidf) -> List[WeightedTerm]
- to_font_sizes(weighted, min_font, max_font) -> List[SizedTerm]
- assign_rotations(sized, rotate_ratio, rotate_angles, seed) -> List[SizedTerm]
- assign_colors(items, palette|colormap, seed) -> List[(item, color)]

4) cloud.layout (чисто)
- layout_spiral(sized_terms, canvas_w, canvas_h, mask, seed) -> List[PlacedWord]
  - Позиции по архимедовой спирали; проверка пересечений по битовой маске/боксам.

5) cloud.render (чисто)
- render_png(placements, font_path, width, height, bg) -> bytes|PIL.Image
- render_svg(placements, width, height, bg) -> str
- desktop_wordcloud_backend(weighted_terms, config) -> PIL.Image (обёртка вокруг wordcloud)

6) cloud.pipeline (оркестрация; чисто для вычислений, IO на краях)
- build_cloud_artifacts({freqs, config, mask?, seed, backend}) -> {placements, manifest, png?, svg?}

7) CLI/скрипты (IO)
- scripts/plot_wordcloud.py: читает конфиг/CSV/маску/стоп‑слова, вызывает cloud.pipeline, сохраняет PNG+manifest.

## Backend’ы
- Desktop: wordcloud + numpy (+matplotlib опционально). Быстро, если доступно.
- Lite (Termux): Pillow + чистый Python (спираль, битмаски), без numpy/pandas/matplotlib.
- Выбор: --backend [auto|desktop|lite]. seed обязателен для детерминизма.

## Конфиг (configs/cloud.yml — дополнить)
- Уже: font_path, width, height, background_color, max_words, min_count, per1k_min, scale, colormap, random_state, prefer_horizontal, collocations, dpi, mask_path, unit_default.
- Добавить: backend_default, min_font, max_font, rotate_ratio, rotate_angles, palette (для lite), per_chapter, topn_default.

## Выходы
- PNG: outputs/figures/wordclouds/{book_id}/{book_id}__unit-..__scale-..__top-..__bg-..__.png
- manifest.json рядом с PNG: список слов с весами/координатами/цветами (для lite) или, при desktop, хотя бы веса/цвета без координат.
- SVG (опционально) тем же именем.

## Тесты
- Порядок размеров монотонен по весам.
- Отсутствие пересечений (на малом наборе) в lite.
- Детерминизм по seed.
- Валидность SVG/PNG на маленьком эталоне.

---

# Внедрение в текущий HTML (src/web_view)

## Новые серверные эндпоинты (src/webapp.py)
1) GET /api/figures?book=<book>
- Возвращает список файлов PNG/SVG и *.meta.json/*.manifest.json из outputs/figures/wordclouds/<book>/.

2) GET /api/figure_download?book=<book>&name=<file>
- Стримит байты изображения/файла (Content-Type: image/png или image/svg+xml / application/json).

3) POST /api/cloud_generate
- Параметры (JSON или query): book, unit, scale, topn, backend, seed.
- Запускает генерацию (через cloud.pipeline или scripts/plot_wordcloud.py), возвращает список созданных файлов.

Примечание: альтернативно можно расширить /api/files для включения фигур, но лучше отдельная группа /api/figure*.

## Правки фронтенда
1) UI вкладка «Облако слов»
- В index.html добавить контейнер под превью облака и панель управления.
- В static/app.js реализовать:
  - loadFigures(book): запрашивает /api/figures, показывает последний PNG.
  - Панель параметров (scale, topN, unit, backend, seed) и кнопка «Сгенерировать» → POST /api/cloud_generate → обновляет список и превью.
  - Если есть manifest.json — кнопка «Показать границы/подсказки»: рисовать overlay поверх <img> (canvas) по данным manifest (hover: слово/частота).

2) Рендерер
- В static/file_renderer.js опционально добавить поддержку manifest.json (рендер таблицы слов по весам/цветам) как fallback.

3) Поведение без результатов
- Если фигур пока нет — показывать подсказку и кнопку «Сгенерировать облако».

## Минимальные шаги (пошагово)
1) Backend визуализации
- Реализовать src/cloud/{domain,parse,transform,layout,render,pipeline}.py (lite + desktop обёртка).
- Обновить scripts/plot_wordcloud.py: делегировать в cloud.pipeline; поддержать tokens.csv и vocab_*.csv; исправить mask → np.array, убрать .itertools().
- Добавить Makefile цель: cloud TEXT_ID=... SCALE=... TOPN=... BACKEND=...

2) Сохранение результатов
- Генерировать в outputs/figures/wordclouds/{book}/ PNG + *.meta.json (+manifest.json, опц.) по схеме имени.

3) API в веб‑сервере
- В src/webapp.py добавить /api/figures, /api/figure_download, /api/cloud_generate (вызов python -m scripts/plot_wordcloud.py … или cloud.pipeline напрямую).

4) UI
- index.html: секция «Облако слов» внутри правой панели.
- static/app.js: loadFigures(book), управление параметрами, кнопка «Сгенерировать», отображение <img src="/api/figure_download?...">.
- При наличии manifest: canvas‑overlay подсветка слов при hover.

5) Тесты
- Проверить lite backend на Termux (topN≈300–400): время, память, шрифты.
- Проверить desktop backend на ПК: корректность mask/colormap/seed.
- Проверить UI: генерация, обновление, edge‑кейсы (нет данных, пустая маска).

## Расширения (позже)
- Сетка облаков по главам (если есть token_freq_by_chapter.csv).
- «Облако символов» из punctuation_counts.csv.
- Интерактивная d3/wordcloud2.js визуализация из manifest.json без растера.
