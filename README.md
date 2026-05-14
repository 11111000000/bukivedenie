# bukivedenie

Python-бэкенд + ванильный ES-module фронтенд для работы с книгами, визуализациями и smoke-проверками.

## Что важно знать

- Канонический UI живёт в `frontend/`.
- Бэкенд живёт в `src/webapp.py`.
- Браузерный smoke пишет артефакты в `artifacts/ui-smoke/`.
- Основной экран фронтенда: `#/books`.

## Что есть в репозитории

- `flake.nix` — dev-shell и `nix run`-приложения.
- `frontend/package.json` — команды фронтенда (`dev`, `build`, `test`, `smoke`).
- `scripts/backend.sh` — запуск только бэкенда на `127.0.0.1:8000`.
- `scripts/dev.sh` и `scripts/dev_rollup.sh` — полный цикл backend + frontend.
- `scripts/ui_smoke.sh` и `scripts/ui_smoke.mjs` — smoke с артефактами и автозапуском бэкенда при необходимости.

## Быстрый цикл разработки

1. Войти в shell: `nix develop --impure`
2. Установить зависимости фронтенда: `make frontend-install`
3. Запустить разработку: `make dev`
4. Открыть приложение: `http://127.0.0.1:5173`
5. Проверить smoke: `make ui-smoke`

## Запуск по слоям

- Только shell: `nix develop --impure`
- Только бэкенд: `nix run --impure .#backend` или `python -m src.webapp --host 127.0.0.1 --port 8000`
- Только фронтенд-сборка: `make frontend-build`
- Только тесты Python: `pytest`
- Только тесты фронтенда: `cd frontend && npm test`
- Только smoke: `nix run --impure .#smoke` или `make ui-smoke`

## Где смотреть результат

- Логи: `logs/`
- Smoke-артефакты: `artifacts/ui-smoke/`
- HTML снимки: `artifacts/ui-smoke/html/`
- Скриншоты: `artifacts/ui-smoke/screens/`
- Итог smoke: `artifacts/ui-smoke/report.json`

## Что установит `nix develop`

- `python3`
- `pytest`
- `nodejs_22`
- `chromium`
- `git`
- `curl`
- `make`

`direnv allow` можно выполнить один раз, чтобы shell поднимался автоматически.
