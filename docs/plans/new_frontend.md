Новый план фронтенда: путь простоты (без фреймворков)
=====================================================

Кратко
------
Мы упрощаем фронтенд до ванильных ES‑модулей с быстрым dev‑циклом, без React/SPA‑фреймворков и без самодельных dev‑tools. Используем готовые, проверенные решения там, где это уместно: Rollup (watch+serve) или простой CDN‑режим для сборки/разработки, Vega‑Lite для графиков, vis‑network для графов, wordcloud2.js для облака слов, лёгкую CSS‑библиотеку для базовой типографики.

Главные принципы (в духе простоты)
- Не изобретать заново: не пишем собственные dev‑панели, роутеры‑монстры и компоненты‑фреймворки.
- Меньше зависимостей — быстрее «холодный старт» и меньше поддержки.
- Backend уже парсит данные (/api/file_parsed) — на фронте только визуализируем и управляем запросами.
- Mobile‑first: интерфейс удобен на телефоне; для разработки — стандартные браузерные DevTools и Vite HMR.

Ключевые решения
----------------
1) Dev‑сервер и сборка: Rollup (vanilla) или простой статический режим
   - Используем rollup + rollup-plugin-serve + rollup-plugin-livereload для watch/serve и live‑reload.
   - В качестве альтернативы можно работать через browser-sync, который проксирует backend и следит за изменениями в src/web_view.
   - Для окружений без Node используйте CDN‑index.html (static), который подключает библиотеки напрямую.

2) Язык: обычные ES‑модули (без фреймворков)
   - Опционально можно будет перейти на TypeScript (vanilla‑ts), но изначально — чистый JS.

3) Визуализации (готовые библиотеки)
   - Основные графики: Vega‑Lite + vega‑embed (bar, line, histogram, heatmap, stacked и т.д.).
   - Сеть персонажей (co‑occurrence): vis‑network (минимальный код для получения хорошей интерактивности — зум/пан/подсветка).
   - Облако слов: wordcloud2.js (canvas‑based, быстро и просто).
   - D3 НЕ подключаем по умолчанию (добавим только при реальной необходимости low‑level кастомизации).

4) UI/стили
   - Pico.css (CDN) — минимальный базовый стиль без сборки и классовых фреймворков.
   - Свой небольшой CSS (layout.css, mobile.css) — только точечные правки.

5) Dev‑tools
   - Не реализуем свои. Используем Vite HMR и стандартные DevTools/remote debugging.

Состав библиотек (точный)
-------------------------
Устанавливаем через npm в проекте frontend/:
- vite — dev‑сервер и сборка
- vega, vega‑lite, vega‑embed — визуализации диаграмм
- vis‑network — визуализация графа персонажей
- wordcloud — wordcloud2.js для облака слов
- (без axios — используем fetch; без D3 — по умолчанию не тащим)

CDN‑альтернативы (для нулевого режима без node)
- Vega: https://cdn.jsdelivr.net/npm/vega@5
- Vega‑Lite: https://cdn.jsdelivr.net/npm/vega-lite@5
- vega‑embed: https://cdn.jsdelivr.net/npm/vega-embed@6
- vis‑network: https://cdn.jsdelivr.net/npm/vis-network@9
- wordcloud2.js: https://cdn.jsdelivr.net/npm/wordcloud
- Pico.css: https://unpkg.com/@picocss/pico@1.*/css/pico.min.css

Архитектура файлов
------------------
frontend/
  index.html           # точка входа, подключает /src/main.js, Pico.css по CDN
  package.json
  rollup.config.js     # конфиг rollup (serve + livereload для dev)
  src/
    main.js            # инициализация, простой hash‑router, монтирование view
    api.js             # fetchJson(path, opts): минимальная обёртка над fetch
    router.js          # очень простой hash‑router (#/books, #/book/:id, ...)
    ui/
      topbar.js        # верхняя панель навигации
    views/
      booksList.js     # список книг (GET /api/books)
      bookOverview.js  # обзор книги (metadata, быстрые ссылки)
      filesList.js     # файлы книги (GET /api/files)
      fileViewer.js    # просмотр CSV/JSON/JSONL (исп. /api/file_parsed)
      tokensChart.js   # топ‑N токенов (Vega‑Lite bar)
      wordCloud.js     # облако слов (wordcloud2.js)
      networkGraph.js  # сеть персонажей (vis‑network)
      sentimentChart.js# тональность по главам (Vega‑Lite line)
    viz/
      vegaHelper.js    # renderSpec(el, spec, options) через vega‑embed
      networkHelper.js # createNetwork(el, nodes, edges)
    styles/
      base.css
      layout.css
      mobile.css

Навигация и дизайн (mobile‑first)
---------------------------------
- Простой topbar: назад, заголовок, ссылка «Книги».
- Hash‑роутинг:
  - #/books — список книг
  - #/book/:id — обзор книги (краткая статистика, действия: Tokens, WordCloud, Network, Sentiment, Files)
  - #/book/:id/viz/tokens — бар‑чарт частот
  - #/book/:id/viz/wordcloud — облако слов
  - #/book/:id/viz/network — сеть персонажей
  - #/book/:id/viz/sentiment — линия тональностей по главах
  - #/book/:id/files — список файлов
  - #/book/:id/file/:name — просмотр файла
- На мобильном: вертикальные списки, крупные тапы, минимализм интерфейса, упор на содержимое.

Связь с backend (что используем)
--------------------------------
- GET /api/books — список книг (картинки/кнопки перехода)
- GET /api/files?book= — список файлов книги
- GET /api/file_parsed?book=&name= — безопасный просмотр для CSV/JSON/JSONL
- GET /api/token_by_chapter?book=&token= — данные для распределения по главам
- GET /api/figures?book= и /api/figure_download — если нужны готовые изображения
- GET /api/run_analysis?raw= — запуск анализа (кнопка на Books/Overview)
- GET /api/cloud_generate?book= — генерация облака (кнопка на Overview)

Dev proxy / proxy-сервер
------------------------
При использовании rollup-plugin-serve или browser-sync можно настроить проксирование /api → http://127.0.0.1:8000. scripts/dev.sh и scripts/dev_rollup.sh ожидают, что frontend-serve будет слушать порт 5173, либо что browser-sync будет проксировать backend и подавать статику.


Производственный режим
----------------------
Два варианта:
1) Копирование dist в web_view (по умолчанию)
   - npm run build → frontend/dist → копируем в src/web_view/
   - webapp.py продолжит отдавать index.html и статику из WEB_ROOT (src/web_view)

2) Перенастроить WEB_ROOT на ../frontend/dist
   - Изменить WEB_ROOT в src/webapp.py, чтобы раздавать из frontend/dist напрямую.
   - Плюс: не копируем файлы. Минус: зависимость от расположения каталога.

Makefile: задачи
----------------
frontend-install:
	cd frontend && npm ci

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build
	rm -rf src/web_view/* || true
	cp -r frontend/dist/* src/web_view/

frontend-deploy: frontend-build

Шаги внедрения
---------------
1) Бэкап текущего фронта
   mkdir -p archives
   tar -czf archives/web_view-backup-$(date +%Y%m%d-%H%M%S).tar.gz src/web_view

2) Scaffold минимального фронта (Vite vanilla)
   npm create vite@latest frontend -- --template vanilla
   cd frontend && npm install
   npm install vega vega-lite vega-embed vis-network wordcloud

3) Настройка proxy (vite.config.js) и базовых скриптов (package.json)
   - dev, build, preview

4) Реализация базовой навигации и страниц
   - #/books, #/book/:id, #/book/:id/files, #/book/:id/file/:name
   - Подключить Pico.css по CDN в index.html

5) Визуализации (минимальный набор)
   - tokensChart.js (Vega‑Lite bar: топ‑N из tokens.csv)
   - wordCloud.js (wordcloud2.js: из tokens.csv)
   - networkGraph.js (vis‑network: из cooccurrence_edges.csv)
   - sentimentChart.js (Vega‑Lite line: из sentiment_by_chapter.csv)

6) Сборка и деплой
   - npm run build
   - копирование dist/* в src/web_view/ (или смена WEB_ROOT)

7) Документация и поддержка
   - Короткий README в frontend/ (команды dev/build, структура модулей)
   - Поддерживаем минимальный код: без самописных тулбаров и тяжёлых зависимостей

Почему это оптимально
---------------------
- Соответствует требованию «современно, но просто»: HMR и сборка есть, но без фреймворков и лишних слоёв.
- Использует готовые, лёгкие библиотеки для сложных задач визуализации (диаграммы/графы/облака), избегая «изобретения велосипеда».
- Лёгкий вход для агента/разработчика: простая файловая структура, минимум конфигов, возобновляемость по README/Makefile.

Альтернативный нулевой режим (без node) — справка
-----------------------------------------------
Если принципиально нужен «без node» режим:
- index.html + CDN (vega, vega‑lite, vega‑embed, vis‑network, wordcloud, Pico.css)
- ES‑модули в src/web_view/static/js/* (type="module")
- Локальный сервер: python -m http.server (без HMR)
- Минусы: нет proxy/HMR, сложнее масштабировать. Рекомендуется только при жёстких ограничениях окружения.

Оценка усилий
-------------
- Бэкап и scaffold: 30–40 минут
- База навигации и страницы: 1–2 часа
- 3–4 ключевые визуализации: 2–4 часа
- Сборка/деплой/полировка: 30–60 минут
Итого: ~4–8 часов до удобного MVP.
