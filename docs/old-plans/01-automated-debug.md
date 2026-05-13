# 01 — Автоматизированная отладка (smoke expansion)

Цель: быстро получать диагностические артефакты и однозначно определять, какие визуализации не отрисовались (и почему). Это база для параллельной отладки.

1) Что расширяем в `scripts/ui_smoke.mjs` и тестах:
  - Явные селекторы готовности для визуализаций:
    - Heatmap: `#hm canvas, #hm svg, #hm .vega-embed`.
    - Network: `#net canvas, #net svg`.
    - Tokens / Sentiment: `#chart canvas, #chart svg`, `#sent canvas, #sent svg`.
  - Добавить таймауты и полезные ошибки: если после N секунд селектор не появляется, фиксируем HTML и console.log и помечаем ошибку.
  - Собирать `api.json` с данными preflight (books, files, bookSummary) для того book, на котором запускаем визуализации.
  - Включить флаги headful/headless и упрощённый mobile viewport (регистрация viewport 375x667) для мобильного smoke.

2) Что сохраняем как артефакты:
  - `report.json` — итог выполнения smoke (routes, errors, timing)
  - `api.json` — snapshot API (books, files, bookSummary)
  - `console.log` — все console.* сообщения, захваченные во время прогона
  - HTML snapshot: сохранённый `document.documentElement.outerHTML`
  - Screenshots: PNG по каждому роуту

3) Тесты:
  - Обновить `frontend/tests/ui_smoke.test.mjs` чтобы гарантировать стабильность ROUTES и new-ready selectors.
  - Добавить тест, который симулирует отсутствие `token_freq_by_chapter.csv` и наличие — и проверяет, что heatmap выведет либо `#hm` с canvas, либо текст `Нет данных`.

4) Ожидаемый результат первого прогона:
  - smoke должен уметь однозначно сказать: heatmap -> OK/FAIL (и почему), network -> OK/FAIL.
