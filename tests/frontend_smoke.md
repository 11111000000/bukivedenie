Frontend smoke test plan (manual fallback)

Use `make ui-smoke` or `cd frontend && npm run smoke` for the canonical smoke run.

1) Start backend: python -m src.webapp --host 127.0.0.1 --port 8000
2) In another terminal start frontend: cd frontend && npm run dev
3) Open http://127.0.0.1:5173/ and land on `#/book/<book>`.
4) Expect: Topbar and book overview visible, with the main sections in view.
5) Smoke artifacts land in `artifacts/ui-smoke/` (`report.json`, `api.json`, `console.log`, `html/*.html`, `screens/*.png`).
6) If files are available for the selected book:
   - Navigate to #/book/<book>
   - Open Tokens: check bar chart renders
   - Open Word Cloud: check cloud renders
   - Open Network: check graph renders if cooccurrence_edges.csv exists
   - Open Sentiment: check line chart renders if sentiment_by_chapter.csv exists
   - Open Heatmap: check heatmap renders
   - Open Files: list files and open file viewer (csv/json/jsonl)
7) Errors should be displayed as simple messages; console has no uncaught exceptions.
