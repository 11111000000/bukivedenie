Разработка фронта и бэка в одном процессе (Live‑reload)
======================================================

Цель
----
Запустить одновременно backend (Python) и frontend с живой перезагрузкой без ручного копирования артефактов в src/web_view.

Кратко о доступных вариантах frontend разработки
------------------------------------------------
- Rollup (watch + serve) — основной dev-воркфлоу для проекта: rollup.config.js и npm-скрипты (dev:rollup, dev:bs) собраны для разработки с живой перезагрузкой.
- Локальный статический режим (src/web_view/index.html) — для случаев, когда Node недоступен.

Общая архитектура
------------------
- backend: src/webapp.py (служит API на 127.0.0.1:8000 по умолчанию).
- frontend: каталог frontend/ с исходниками и сборкой в frontend/dist.
- При разработке dev-сервер frontend (rollup serve or browser-sync) обслуживает UI на порту 5173 и/или напрямую проксирует обращения к backend (/api -> http://127.0.0.1:8000), чтобы избежать CORS.
- Сборка для деплоя копируется в src/web_view/, откуда backend может раздавать статические файлы.

Утилиты для удобства
---------------------
- scripts/dev.sh — запускает backend + frontend watcher (rollup или browser-sync) и собирает логи.
- scripts/dev_rollup.sh — запускает backend + rollup watcher и собирает логи (полезно на Termux/системах).
- Makefile содержит цели для установки зависимостей, запуска dev и сборки.

Запуск (машина с Node/npm)
-------------------------
1) Установите зависимости (в корневом каталоге проекта):

make frontend-install

Эквивалент вручную:
cd frontend
npm ci

2) Запуск dev (backend + frontend watcher):

make dev-all

Это выполнит scripts/dev.sh, который:
- запускает backend (python -m src.webapp --host 127.0.0.1 --port 8000)
- пытается запустить frontend через npm run dev:rollup или npm run dev:bs
- пишет логи в logs/backend-dev.log и logs/frontend-dev.log

По умолчанию после успешного старта:
- backend: http://127.0.0.1:8000
- frontend (serve): http://127.0.0.1:5173

Запуск с Rollup (watch + serve)
-------------------------------
Проект использует rollup как основной инструмент разработки фронтенда (watch + rollup-plugin-serve + livereload).

1) Установите зависимости как выше (make frontend-install).
2) Запустите rollup watcher + backend вместе:

make dev-rollup

Это выполнит scripts/dev_rollup.sh и запустит:
- backend на 127.0.0.1:8000
- rollup watcher (cd frontend && node frontend/node_modules/rollup/dist/bin/rollup -c -w)

Логи для rollup: logs/rollup-dev.log (и logs/backend-dev.log для backend).

Альтернативы (ручной запуск):
- Запустить только rollup watcher в frontend:
  cd frontend && npm run dev:rollup
- Запустить browser-sync proxy (если хотите проксировать backend и наблюдать за src/web_view):
  cd frontend && npm run dev:bs

Сборка и деплой фронтенда
-------------------------
- Сборка через rollup (или скрипт build):
  cd frontend && npm run build
  или из корня: make frontend-build

- Скопировать результат в backend static:
  make frontend-build
  (копирует frontend/dist/* -> src/web_view/)

- Есть shortcut npm script в frontend/package.json:
  npm run deploy  # build + cp dist -> ../src/web_view/

Запуск только backend (без Node)
--------------------------------
Если на хосте нет Node/npm или вы не хотите запускать dev-сервер

python -m src.webapp --host 127.0.0.1 --port 8000

и откройте в браузере: http://127.0.0.1:8000/ — backend раздаст index.html из src/web_view, если в него скопированы артефакты.

Примечания по Termux/Android
---------------------------
- На Termux часто возникают проблемы с нативными биндингами (esbuild/rollup и т.п.). Возможные решения:
  - npm ci --no-bin-links (попытка установки без символических ссылок)
  - если ничего не помогает — делать сборку на обычном ПК и копировать dist/ в src/web_view
  - для наблюдения за изменениями используйте make dev-rollup (скрипт dev_rollup.sh более приспособлен к простому rollup watcher)

Логи
----
- При работе через scripts/dev.sh: logs/backend-dev.log и logs/frontend-dev.log
- При работе через scripts/dev_rollup.sh: logs/backend-dev.log и logs/rollup-dev.log

Полезные Makefile цели
----------------------
- make frontend-install  — установить зависимости frontend
- make dev-all           — backend + frontend watcher (scripts/dev.sh)
- make dev-rollup        — backend + rollup watcher (scripts/dev_rollup.sh)
- make frontend-build    — собрать frontend и скопировать dist -> src/web_view
- make frontend-deploy   — alias на frontend-build

Где смотреть конфиги
--------------------
- frontend/package.json — список npm-скриптов (dev:rollup, dev:bs, build, deploy)
- frontend/rollup.config.js — конфигурация rollup (serve + livereload для dev)


Дальше
-----
- Развивайте frontend в frontend/ с rollup/watch (livereload). По окончании работы используйте make frontend-build или npm run deploy для переноса собранных артефактов в src/web_view.

Если нужно, могу дополнить README примерами команд для отладки ошибок установки в Termux, или добавить секцию с типичными ошибками и их решениями.
