# 03 — План реализации (пошагово)

Фазы (короткие итерации, каждый шаг должен быть тестируем):

Phase A — Setup automated debug
 1. Расширить `scripts/ui_smoke.mjs` ready селекторами и артефактами (docs/plans/01-automated-debug.md).
 2. Обновить `frontend/tests/ui_smoke.test.mjs` для новых селекторов.
 3. Запустить smoke локально, собрать артефакты.

Phase B — Viz fixes (параллельно)
 1. Fix: heatmap — гарантировать `#hm` перед renderSpec (в `frontend/src/views/heatmap.js`).
 2. Fix: network — добавить проверку на container и диагностическое сообщение.
 3. Проверить tokens, sentiment, wordcloud на race conditions.

Phase C — Router & SPA polish
 1. Минимальный патч: избегать перерисовки header/topbar и боковой панели при переключении виджетов; обновлять только `#view`.
 2. Улучшение: перехват кликов на внутренних ссылках и soft-hash navigation (preventDefault + location.hash change) чтобы избежать двойного jump/render.

Phase D — UX
 1. Унифицировать цвета/паддинги/карточки и сделать breakpoint <820px.
 2. Убрать слишком большие paddings и уменьшить min-height у графиков для мобильных.

Phase E — Integration & verify
 1. Объединить фиксы, прогнать smoke (desktop + mobile), фикс багов, если обнаружены.
 2. Финальный PR и описание изменений.

Минимальные изменения кода приоритетны: фикс heatmap и smoke-проверки — обязательные.
