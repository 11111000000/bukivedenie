Frontend smoke test plan (manual)

1) Start backend: python -m src.webapp --host 127.0.0.1 --port 8000
2) Open http://127.0.0.1:8000/
3) Expect: Topbar and Books page visible.
4) If outputs/<book>/ exists:
   - Navigate to #/book/<book>
   - Open Tokens: check bar chart renders
   - Open Word Cloud: check cloud renders
   - Open Network: check graph renders if cooccurrence_edges.csv exists
   - Open Sentiment: check line chart renders if sentiment_by_chapter.csv exists
   - Open Heatmap: check heatmap renders
   - Open Files: list files and open file viewer (csv/json/jsonl)
5) Errors should be displayed as simple messages; console has no uncaught exceptions.
