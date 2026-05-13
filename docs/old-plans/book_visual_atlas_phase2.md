# План: визуальный atlas книг, фаза 2

## Цель
Сделать фронтенд действительно красивым и полезным для книг: не только dashboard shell, а набор выразительных, синхронных визуализаций, которые помогают читать, сравнивать и исследовать текст.

## Диалектический разбор
### Тезис
Базовый atlas уже есть: selected-book контекст, compact dashboard, summary blocks, token chart, punctuation preview, text viewer, file context, route fallback.

### Антитезис
Сейчас это всё ещё набор хороших блоков, а не полноценный визуальный atlas. Не хватает крупных визуальных осей, структуры книги, сравнения и визуального ритма.

### Синтез
Сохранить current shell и нарастить на него phase-2 визуальные панели, не вводя новый frontend framework и не ломая текущие маршруты.

## Бритва Оккама
Самый быстрый путь к красивому atlas:
1. не переписывать архитектуру;
2. не переносить всё в backend;
3. не создавать лишний abstraction layer;
4. добавить только те графики и библиотеки, которые дают максимальный визуальный эффект на книге.

## Что должно появиться в phase 2
- **Book Atlas** как крупная центральная панель;
- **Chapter Structure**: sunburst / icicle / treemap для архитектуры книги;
- **Coverage Curve**: кривая покрытия словаря и насыщения текста;
- **Chapter Heatmap**: плотность по главам/фрагментам;
- **Compare View**: сравнение двух книг или фрагментов;
- **Network View**: более выразительный граф связей;
- **Word Cloud**: если он уже есть, довести его до stylistic parity;
- **Text Viewer**: связь с atlas и compare;
- **Files/summary**: оставить как навигационный и контекстный слой.

## Рекомендуемый стек
- `echarts` как основной engine для:
  - sunburst
  - treemap
  - line/area charts
  - heatmaps
  - compact summaries
- `echarts-wordcloud` для облака слов.
- `cytoscape` для network/graph views.
- `vega-lite` оставить только для тех экранов, где уже дешевле не переписывать.

## Что нужно от backend
Фаза 2 становится красивой, если backend отдаёт стабильно индексированные структуры.

Минимальные payload'ы:
- `book_index` или `text_index`;
- `book_summary`;
- `book_fragments`;
- `token_coverage`;
- `punctuation_timeline`;
- `compare_books`;
- `chapter_stats`;
- `dialogue_spans` и `motif_series` — если данные уже есть, но это не блокирует MVP phase 2.

## Параллельные субагенты
### Субагент A: Atlas core
**Задача:** сделать `Book Atlas` настоящей центральной визуализацией.

**Что сделать:**
- выделить один центральный atlas container;
- добавить визуальную иерархию вокруг него;
- сделать hover/click контекст понятным;
- связать atlas с text viewer и compare actions.

**Файлы:**
- `frontend/src/views/booksList.js`
- `frontend/src/style.css`
- возможно, `frontend/src/router.js`

### Субагент B: Chapter structure visuals
**Задача:** добавить визуальную структуру книги.

**Что сделать:**
- sunburst или icicle по главам/разделам;
- treemap или stacked summary по длинам глав;
- компактную архитектуру книги в отдельной панели.

**Файлы:**
- `frontend/src/views/bookOverview.js`
- `frontend/src/views/booksList.js`
- `frontend/src/viz/*` при необходимости

### Субагент C: Coverage + rhythm
**Задача:** добавить визуальный ритм и насыщение текста.

**Что сделать:**
- coverage curve;
- chapter heatmap;
- punctuational rhythm as line/area/strip chart;
- связать панели с существующими token and punctuation payloads.

**Файлы:**
- `frontend/src/views/booksList.js`
- `frontend/src/views/tokensChart.js`
- `frontend/src/views/bookOverview.js`
- `frontend/src/style.css`

### Субагент D: Compare view
**Задача:** дать понятное сравнение двух книг/фрагментов.

**Что сделать:**
- small compare chooser in dashboard or dedicated view;
- side-by-side or delta view;
- route fallback в existing book routes.

**Файлы:**
- `frontend/src/views/bookOverview.js`
- `frontend/src/router.js`
- `frontend/src/views/booksList.js`

### Субагент E: Network + word cloud polish
**Задача:** довести сильные графы до визуального parity с atlas.

**Что сделать:**
- улучшить network styling / layout;
- сделать word cloud более elegant и consistent;
- ограничить высоту, скролл и empty states.

**Файлы:**
- `frontend/src/views/networkGraph.js`
- `frontend/src/views/wordCloud.js`
- `frontend/src/style.css`

### Субагент F: Dependencies
**Задача:** подключить недостающие библиотеки только если они реально улучшают визуализацию.

**Что сделать:**
- обновить `frontend/package.json`;
- добавить только полезные библиотеки;
- сохранить `npm test`, `npm run build`, `npm run smoke` зелёными.

**Файлы:**
- `frontend/package.json`
- `frontend/package-lock.json`

### Субагент G: Tests and contracts
**Задача:** зафиксировать helpers, routes и визуальные contracts.

**Что сделать:**
- unit tests для normalization helpers;
- smoke contract for route order and artifact naming;
- tests for compare/coverage helpers if added;
- keep current frontend smoke contract stable.

**Файлы:**
- `frontend/tests/*.test.mjs`
- `scripts/ui_smoke.mjs`
- `tests/frontend_smoke.md`

## Порядок выполнения
1. Atlas core.
2. Chapter structure visuals.
3. Coverage and rhythm.
4. Compare view.
5. Network and word cloud polish.
6. Dependencies only if needed.
7. Tests and smoke.

## MVP критерии
- atlas feels like a book map, not a dashboard;
- at least 3 panels are truly visual, not textual previews;
- selected book context is obvious;
- click-through back to text remains simple;
- routes/fallback still work;
- tests and smoke stay green.

## Stop rule
Если новая визуализация не помогает чтению/сравнению книги или не заметна визуально, её откладываем и не раздуваем scope.
