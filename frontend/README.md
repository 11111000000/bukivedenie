Frontend (vanilla ES modules) — README
=====================================

Кратко
------
Проект фронтенда минималистичен: ванильные ES-модули, визуализации через vega/vis-network/wordcloud. Для разработки на машине с Node есть возможность dev-server на основе Rollup (watch + serve) или browser-sync. В средах с ограничениями (Termux/Android) доступен статический режим: фронт подключается через CDN и отдаётся backend'ом (src/webapp.py).

Расположение
-----------
- frontend/ — исходники фронтенда (опционально для dev/build на машине с Node) — использует Rollup/watch или статический CDN-режим.
- src/web_view/ — статический фронтенд, который отдаёт backend (используется в production / mobile)

Требования
----------
- Python 3.8+ — для backend (src.webapp.py)
- Node.js + npm (только если вы хотите запускать rollup dev/watch или собирать бандл)

Установка (Node / dev)
----------------------
Перейдите в каталог frontend и установите зависимости.

# В каталог фронтенда
cd /storage/emulated/0/Projects/bukivedenie/frontend

# Попробуйте стандартную установку (если окружение поддерживает симлинки и нативные биндинги)
npm ci

# Если окружение (напр. Termux) не позволяет создавать симлинки, используйте флаг --no-bin-links
npm ci --no-bin-links || npm install --no-bin-links

Прим.: на некоторых Android/Termux окружениях сборка из‑за нативных модулей (esbuild/rolldown) может падать. В этом случае используйте статический режим (см. раздел ниже) или запускайте Vite на другой машине (PC) и копируйте dist в src/web_view.

Скрипты package.json
--------------------
В frontend/package.json определены скрипты:
- npm run setup — установить зависимости (npm ci)
- npm run dev — запустить Vite dev server (HMR) на http://localhost:5173
- npm run build — собрать продакшн-бандл (dist/)
- npm run preview — preview сборки
- npm run deploy — собрать и скопировать dist/* → ../src/web_view/

Dev: запуск (локально, при наличии Node)
--------------------------------------
1) Установите зависимости (см. выше)
2) Запустите Python backend (чтобы dev proxy имел куда направлять /api):

cd /storage/emulated/0/Projects/bukivedenie
python -m src.webapp --host 127.0.0.1 --port 8000

3) В другом терминале запустите Vite dev:

cd /storage/emulated/0/Projects/bukivedenie/frontend
npm run dev

4) Откройте в браузере (на устройстве, где запущен Vite):
http://127.0.0.1:5173/

Примечание: Vite настроен проксировать /api → http://127.0.0.1:8000, поэтому fetch('/api/...') будет работать без CORS.

Build & deploy (prod)
---------------------
Если на вашей машине работает npm build, выполните:

cd frontend
npm run build
npm run deploy

Это создаст сборку и скопирует её в ../src/web_view/ — backend (src.webapp.py) будет отдавать собранные файлы на http://127.0.0.1:8000/.

Статический режим (без Node)
----------------------------
На устройствах с ограничениями (Termux) рекомендую использовать статический режим: frontend размещён в src/web_view и использует CDN для библиотек (vega, vis-network, wordcloud). В этом случае достаточно запустить только backend:

cd /storage/emulated/0/Projects/bukivedenie
python -m src.webapp --host 127.0.0.1 --port 8000

и открыть:
http://127.0.0.1:8000/

Тесты / smoke-check
-------------------
Ручной smoke‑тест: tests/frontend_smoke.md — шаги для проверки в браузере.

Автоматический базовый smoke: запустите backend и выполните простой скрипт (пример):

python - << 'PY'
import json, socket, time
from http.server import ThreadingHTTPServer
from src.webapp import Handler
from urllib.request import urlopen

HOST='127.0.0.1'; PORT=8766

srv = ThreadingHTTPServer((HOST, PORT), Handler)
import threading
threading.Thread(target=srv.serve_forever, daemon=True).start()

# wait
for _ in range(50):
    try:
        s = socket.create_connection((HOST, PORT), timeout=0.1); s.close(); break
    except Exception:
        time.sleep(0.05)

with urlopen(f'http://{HOST}:{PORT}/api/books') as r:
    data = json.loads(r.read().decode())
    print('books keys:', list(data.keys()))

with urlopen(f'http://{HOST}:{PORT}/') as r:
    print('index length', len(r.read()))

print('SMOKE OK')
PY

Подсказки для Termux
--------------------
- Если npm install падает из‑за нативных бинарей (esbuild/rolldown), используйте --no-bin-links или переходите на статический режим.
- Для доступа к серверу с мобильного браузера убедитесь, что вы открываете правильный URL (обычно http://127.0.0.1:8000/).
- Чтобы открыть URL автоматически из Termux:
  termux-open-url http://127.0.0.1:8000/

Контакты и дальнейшие шаги
-------------------------
- Если хотите, могу попытаться настроить Vite‑build на вашей машине (потребует, возможно, корректировок прав и установки дополнительных пакетов). Либо можно делать билд на ПК и копировать dist в src/web_view.

EOF