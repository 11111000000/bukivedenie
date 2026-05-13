# 02 — Субагенты: роли, входы, выходы

Ниже описаны субагенты, которые можно запускать параллельно. Каждый субагент — автономная задача с чётким входом и выходом.

1) Router / SPA audit (subagent-router)
  - Вход: `frontend/src/main.js`, `frontend/src/router.js`, `frontend/src/ui/topbar.js`, `frontend/index.html`
  - Задачи:
    - Найти все места, где происходит `innerHTML` полного контейнера и оценить, как минимизировать перерисовку.
    - Предложить минимальные изменения для перехода к плавной навигации (например, при клике сперва preventDefault, менять hash через API и обновлять только view).
  - Выход: патч (минификс) + список регрессий и тестов.

2) Viz audit (subagent-viz)
  - Вход: `frontend/src/views/*`, `frontend/src/viz/vegaHelper.js`, `frontend/src/api.js`
  - Задачи:
    - Проверить каждый виджет: где ожидается контейнер, где возможен race condition, где отсутствует fallback.
    - Сделать точечные исправления (например, heatmap precomputed branch должен создать `#hm`).
  - Выход: список багфиксов + тесты/smoke-assertions.

3) UX / Layout (subagent-ux)
  - Вход: `frontend/src/style.css`, вьюхи с inline-стилями, `frontend/index.html`
  - Задачи:
    - Создать мобильный-first макет: breakpoint < 820px.
    - Вынести повторяющиеся inline-стили в классы.
    - Снижение полей и плотность карточек.
  - Выход: CSS-патч + примеры экранов (desktop/mobile snapshot setup).

4) Smoke / Debug expansion (subagent-smoke)
  - Вход: `scripts/ui_smoke.mjs`, `frontend/tests/ui_smoke.test.mjs`
  - Задачи:
    - Внедрить ready-селекторы для viz и расширить артефакты.
    - Сделать удобный JSON-выход для CI и локальной отладки.
  - Выход: обновлённый smoke runner и тесты.

5) Integration agent (subagent-int)
  - Вход: все вышеназванные изменения
  - Задачи:
    - Свести вместе патчи, прогнать smoke, зафиксировать артефакты.
    - Финальный pass по UX.
  - Выход: report.json, исправления по результатам smoke.
