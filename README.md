# bukivedenie

Проект для лингвистического анализа книг. Основной UI теперь живёт в `site/`.

## Что важно знать

- Статическая витрина живёт в `site/`.
- Данные для витрины лежат в `outputs/` и копируются в `site/public/data/`.
- Браузерный smoke пишет артефакты в `artifacts/ui-smoke/`.

## Что есть в репозитории

- `flake.nix` — dev-shell и `nix run`-приложения для `site`.
- `site/` — Vite-приложение для статической витрины.
- `scripts/build_site_data.py` — сборка `site/public/data` из `outputs/`.
- `Makefile` — команды для локальной разработки и сборки.

## Быстрый цикл разработки

1. Войти в shell: `nix develop --impure`
2. Установить зависимости: `make site-install`
3. Подготовить данные: `make site-data`
4. Запустить разработку: `make site-dev`
5. Открыть приложение: `http://127.0.0.1:5173`

## Как запустить статический site локально

1. Установить зависимости: `cd site && npm install`
2. Подготовить данные для витрины: `python scripts/build_site_data.py --source outputs --target site/public/data`
3. Запустить dev-сервер: `cd site && npm run dev`
4. Открыть адрес из Vite, обычно `http://127.0.0.1:5173`
5. Для production-сборки: `cd site && npm run build`

### Что делает `site`

- Показывает список книг из `site/public/data/index.json`.
- Загружает CSV/JSON напрямую из `site/public/data/outputs/<book>/`.
- Работает без отдельного API.
- Если после изменения данных список книг не обновился, заново запусти `make site-data`.

### Полезные команды

- Пересобрать данные витрины: `make site-data`
- Собрать витрину: `make site-build`
- Запустить production preview: `make site-preview`
- Почистить site-артефакты: `make clean`

## Запуск по слоям

- Только shell: `nix develop --impure`
- Только site-dev: `nix run --impure .#dev` или `make site-dev`
- Только site preview: `nix run --impure .#preview` или `make site-preview`
- Только сборка site: `make site-build`
- Только smoke: `nix run --impure .#smoke` или `make ui-smoke`

## Где смотреть результат

- Логи: `logs/`
- Smoke-артефакты: `artifacts/ui-smoke/`
- HTML снимки: `artifacts/ui-smoke/html/`
- Скриншоты: `artifacts/ui-smoke/screens/`
- Итог smoke: `artifacts/ui-smoke/report.json`
- Статическая витрина после сборки: `site/dist/`

## Что установит `nix develop`

- `python3`
- `pytest`
- `nodejs_22`
- `git`
- `curl`
- `make`

`direnv allow` можно выполнить один раз, чтобы shell поднимался автоматически.
