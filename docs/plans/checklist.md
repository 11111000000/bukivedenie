# Checklist и критерии успеха

Kритерии успеха (must):
- Smoke: `#/books` показывает `.dashboard-shell` и `.dashboard-atlas-panel`.
- Heatmap: при наличии данных `#hm canvas|svg` присутствует; при отсутствии — отображается `Нет данных`.
- Network: при наличии `cooccurrence_edges.csv` на странице `#net canvas` присутствует.
- Навигация не вызывает полной перезагрузки index.html (проверяем загрузки ресурса и отсутствие 302/200 fetch на index).
- Нет фатальных console.error сообщений при первом прогоне smoke.

Tasks:
- [ ] Расширить smoke runner и тесты
- [ ] Исправить heatmap
- [ ] Диагностика network
- [ ] Минимальный SPA-shell патч
- [ ] Адаптивная CSS правка
- [ ] Интеграционный прогон и финальная проверка
