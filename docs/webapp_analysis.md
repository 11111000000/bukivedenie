Анализ и внесённые изменения в src/webapp.py

Дата: 2026-05-10
Автор: AI assistant

Краткое описание проекта
- src/webapp.py — простой ThreadingHTTPServer, обслуживает SPA (src/web_view/index.html) и набор API эндпойнтов:
  - /api/raw_files — список исходных .txt файлов
  - /api/raw — получение содержимого исходного текста
  - POST /api/raw_save — сохранение отредактированного исходного файла
  - /api/run_analysis — запуск анализа (subprocess вызов src/analyze_text.py)
  - /api/files, /api/file, /api/file_download — доступ к outputs/<book>/

Проблемы, найденные при ревью
1. Path traversal при сохранении сырого файла
   - В do_POST('/api/raw_save') имя файла использовалось напрямую: file_path = RAW_DIR / unquote_plus(name)
   - Злоумышленник мог передать имя с ../ и записать за пределами RAW_DIR

2. Content-Disposition filename неэкранируется
   - При скачивании файла header формировался как f'filename="{name}"' без санитаризации. Наличие двойных кавычек или управляющих символов может нарушить заголовок.

3. Синхронный и небезопасный запуск анализа
   - /api/run_analysis вызывал subprocess.run без таймаута. Длинные или зависшие процессы будут блокировать поток обработчика.
   - Нет механизма фоновой очереди/статуса задач (в будущем рекомендую реализовать job queue и /api/job_status).

4. На фронтенде index.html: примитивный CSV‑парсер (split(',') и innerHTML вставка) — риск некорректного парсинга и XSS при злонамеренном содержимом. (Не менялось в этой правке — рекомендовано как следующий шаг.)

Внесённые изменения (пункт 1: критические исправления безопасности)
1. При сохранении raw (POST /api/raw_save):
   - Заменил прямую запись RAW_DIR / name на безопасный safe_join(RAW_DIR, unquote_plus(name)).
   - При invalid filename возвращается HTTP 400.

2. При скачивании файла (GET /api/file_download):
   - Добавил sanitization имени файла: safe_name = os.path.basename(unquote_plus(name)) и удаление двойных кавычек и управляющих символов.
   - Используется safe_name в Content-Disposition.

3. В /api/run_analysis: добавлен timeout для subprocess.run (300 секунд) и обработка subprocess.TimeoutExpired (возвращает error: 'analysis timed out').
   - Добавлен комментарий о необходимости фоновой очереди для будущих улучшений.

Рекомендации по дальнейшим правкам (prioritized)
- Исправить фронтенд: заменить naive CSV parsing на PapaParse или добавить серверный endpoint, отдающий CSV в JSON (headers + rows). Также при вставке в DOM использовать textContent или создавать text nodes, чтобы избежать XSS.
- Сделать запуск анализа неблокирующим: добавить job queue (на файловой основе или в памяти) и /api/job_status, чтобы UI мог опрашивать состояние; либо использовать multiprocessing + background threads.
- Логирование: подключить logging в webapp.py и логировать запросы/ошибки в logs/webapp.log.
- Ограничить доступ по хосту/токену при разворачивании сервера в сети (security).
- Сохранять полный stdout/stderr процесса анализа в outputs/<book_id>/run.log для отладки.

Файлы, изменённые
- storage/shared/bukivedenie/src/webapp.py — внесены правки: safe_join при записи raw, sanitization filename при скачивании, timeout для subprocess.run.

Как проверить изменения
- Запустить сервер: python -m src.webapp
- В веб-интерфейсе открыть raw file list и попробовать сохранить файл с именем "../test.txt" — сервер должен вернуть ошибку.
- Попробовать скачать outputs файл с подозрительными символами в имени — имя в Content-Disposition должно быть очищено.
- Запустить анализ на большом файле и прервать процесс (если выполняется >300s) — сервер вернёт анализ timed out.

Если нужно, могу сразу:
- Исправить фронтенд CSV‑парсинг и безопасную вставку в DOM (phots/front_end_fix.md план и правки).
- Добавить фоновые задачи / simple job queue с endpoint'ом /api/job_status.

Конец файла.
