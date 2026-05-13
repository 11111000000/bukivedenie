# 04 — Исполнительный (Execution) план: распараллеливание субагентов и точные шаги

Цель: получить максимально точную, воспроизводимую дорожную карту работ по автоматизированной отладке (smoke), локализации и фиксам фронта, а затем — внедрить улучшения UX/SPA/визуализаций. План ориентирован на параллельную работу нескольких субагентов с минимальными, локальными изменениями в каждой итерации.

Структура плана
- Подготовка (0): гарантировать работоспособность окружения и собрать baseline артефактов.
- Параллельные субагенты (1): Router, Viz, UX, Smoke — каждый выполняет автономную исследовательскую и диагностическую работу.
- Исправления (2): короткие, приоритетные патчи (Heatmap, Vega guard, Network guard, WordCloud guard) — можно делать параллельно с UX-планированием.
- Интеграция и верификация (3): прогон smoke, исправление найденных проблем, финальные UX-правки.

Ожидаемые артефакты
- docs/plans/* (этот набор) — планы, чеклисты
- artifacts/ui-smoke/* — report.json, api.json, console logs, html snapshots, screenshots
- patches/* или git branches — минимальные фиксы
- tests/ — обновлённые smoke тесты

Общие принципы
- Малые правки: prefer smallest-correct-change
- Surface-first для публичных контрактов (см. SURFACE.md)
- Smoke-first: перед большими исправлениями у нас должен быть рабочий smoke, который даёт детерминированные артефакты
- Все изменения через отдельные ветки и PRs (один цель — один PR)

Окружение и предпосылки
- Команда должна иметь локально: python3, nodejs, chromium, git, make
- Для smoke использовать scripts/ui_smoke.mjs (обновлённый) и frontend/tests/ui_smoke.test.mjs
- Стартовая ветка: создаём ветку `fix/smoke-and-audit` для диагностики и фиксов

Timeboxing (оценки для планирования)
- Подготовка: 0.5–1ч
- Каждый субагент (audit) — 1–3ч (зависит от объёма и выявленных проблем)
- Приоритетные quick-fixes — 0.5–2ч каждый
- Интеграция + полный smoke — 1–2ч

Параллельные субагенты — точные задачи и команды

1) subagent-smoke (smoke/debug expansion)
  - Роль: сделать smoke детерминированным, собрать артефакты и добавить ready-селекторы для всех viz.
  - Вход: scripts/ui_smoke.mjs, frontend/tests/ui_smoke.test.mjs
  - Выход: обновлённый ui_smoke runner, список failing routes, artifacts/*
  - Конкретные шаги:
    1. Локально: node scripts/ui_smoke.mjs --api-base http://127.0.0.1:8000 --out artifacts/ui-smoke
    2. Запустить mobile run: SMOKE_MOBILE=1 node scripts/ui_smoke.mjs --api-base http://127.0.0.1:8000
    3. Сохранить report.json и собрать per-route console logs
    4. Отправить результаты subagent-int (integration) и другим субагентам
  - Acceptance: report.json показывает готовность маршрутов или даёт reproducible ошибки/stack traces

2) subagent-router (Router / SPA audit)
  - Роль: найти все места, где large DOM subtree заменяются, предложить минимальные изменения чтобы убрать flash.
  - Вход: frontend/src/main.js, frontend/src/router.js, frontend/src/ui/topbar.js, frontend/src/views/booksList.js
  - Выход: отчёт с точными строками (innerHTML), план патчей (snippets) и список smoke-ассертов для проверки мерцания.
  - Конкретные шаги (параллельно с subagent-smoke):
    1. Выполнить static grep: grep -n "innerHTML" frontend/src/views/*.js
    2. Составить карту replace-путей (которые перезаписывают #view / #app)
    3. Предложить минимум: смена pattern "early loading innerHTML" на локальный loader + mount.replaceChildren(fragment)
  - Acceptance: smoke показывает отсутствие полной очистки #view между двумя быстрыми навигациями (на основе page snapshots)

3) subagent-viz (Viz audit)
  - Роль: проверить визуализации на race conditions, missing containers и external deps; подготовить minimal patches.
  - Вход: frontend/src/views/heatmap.js, networkGraph.js, tokensChart.js, wordCloud.js, frontend/src/viz/vegaHelper.js, frontend/src/api.js
  - Выход: точечные патчи (heatmap container creation, vega guard, network guard, wordcloud guard), smoke-asserts для каждой viz
  - Конкретные шаги:
    1. Проверить heatmap precomputed branch — создать #hm перед renderSpec
    2. Добавить null-checks в vegaHelper и улучшенную ошибку
    3. Проверить network container size and exist, catch and render readable error
    4. Guard для echarts-wordcloud dynamic import
  - Acceptance: smoke отмечает присутствие canvas/svg для каждой viz при наличии данных

4) subagent-ux (UX / Layout)
  - Роль: разработать компактный mobile-first shell и предложить минимальные CSS+HTML изменения
  - Вход: frontend/src/style.css, frontend/src/views/* (overview/booksList), frontend/src/ui/topbar.js
  - Выход: CSS-патчи, mapping inline→classes, screenshots (desktop/mobile) до и после
  - Конкретные шаги:
    1. Добавить mobile-first CSS (см. docs/plans/UX-design.md)
    2. Извлечь 2–3 наиболее заметных inline-стиля в классы (topbar, карточки, meter)
    3. Проверить результат через smoke mobile run
  - Acceptance: layout адекватный на ширине 390px (нет горизонтального разрыва, book chips — scrollable)

Оркестрация и взаимодействие субагентов
- Каждый субагент работает локально и пушит результаты в git ветку `fix/<scope>-<id>`.
- subagent-smoke стартует первым (или параллельно сразу с viz audit) чтобы собрать baseline.
- subagent-viz и subagent-router используют артефакты smoke (api.json, console.log, screenshots) как вход.
- subagent-ux можно запускать параллельно с subagent-viz, т.к. он не зависит от внутренних данных, а только от DOM/стилей.

Минимальные quick-fixes (приоритеты)
1. Heatmap container guard (high) — файл: frontend/src/views/heatmap.js
2. Vega guard (medium) — frontend/src/viz/vegaHelper.js
3. Network container & size check (medium) — frontend/src/views/networkGraph.js
4. WordCloud dynamic import guard (low) — frontend/src/views/wordCloud.js
5. Small SPA fix: replace early mount.innerHTML loaders by local loader + replaceChildren (high)

Точные тесты и smoke-asserts (автоматизация)
- Для каждого route в scripts/ui_smoke.mjs добавить ready селекторы (см. docs/plans/01-automated-debug.md)
- Проверки при smoke:
  - #view содержит .dashboard-shell и .dashboard-atlas-panel на dashboard route
  - Heatmap: document.querySelector('#hm canvas, #hm svg, #hm .vega-embed')
  - Network: document.querySelector('#net canvas')
  - Tokens: document.querySelector('#chart canvas, #chart svg')
  - WordCloud (smoke mode): #cloud span elements OR #cloud canvas

Rollback и риски
- Все изменения минимальны и локальны; при регрессе откатить ветку и вернуть исходный код
- Риск: статические импорты vis-network/echarts могут требовать пересборки бандла; guard не решит проблему при отсутствии пакетов — это сборочная/CI задача

Коммуникация и отчётность
- Каждый субагент публикует в ветке краткий report.md с findings + патчем или PR-веткой
- Integration agent (subagent-int) собирает PRs, запускает smoke, публикует final report и артефакты

Следующие шаги (concrete)
1. Подтверди: можно ли мне применить quick-fix патчи (heatmap + vega guard + network guard + wordcloud guard) и запустить smoke? Это даст детерминированные артефакты для планирования следующих PR.
2. Я запускаю subagent-smoke и возвращаю report.json + ключевые screenshots + короткие выводы.

---
Автор: opencode agent
Время подготовки: ~текущая сессия
