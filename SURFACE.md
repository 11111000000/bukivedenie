# Surface

## Backend dashboard contract

- `GET /api/book_summary?book=<book_id>` returns a cheap, compare-friendly JSON payload for dashboard-first visualizations.
- Payload includes `book`, `ready`, `status`, `summary` (absolute book-level counts), `text_index` (stable token frequency rows), `fragments` (ordered chapter fragments), and `punctuation_timeline` (ordered punctuation rows).
- `GET /api/books` returns each book with `ready` and `status` markers.
- `GET /api/book_index?book=<book_id>&offset=<n>&size=<n>` returns ordered chapter-index rows with the same chapter fragment shape used by `fragments`.
- `GET /api/book_fragments?book=<book_id>&offset=<n>&size=<n>` returns ordered chapter-fragment rows.
- `GET /api/punctuation_timeline?book=<book_id>&offset=<n>&size=<n>` returns ordered punctuation counts by chapter.

## Static dist contract

- `data/dist/index.json` is the manifest for prebuilt book data.
- `data/dist/index.json` entries include `book_id`, `title`, `raw_path`, `text_path`, `json_path`, `ready`, `status`, and `summary`.
- `data/dist/books/<book_id>.json` contains the full static payload for one book: summary, fragments, text index, punctuation timeline, chapter stats, token heatmap rows, cooccurrence edges, sentiment rows, and file metadata.
- Book payloads expose the fields consumed by the static frontend: `book`, `book_id`, `text_path`, `ready`, `status`, `files`, `fragments`, `text_index`, `punctuation_timeline`, `chapter_stats`, `token_by_chapter`, `cooccurrence_edges`, and `sentiment_by_chapter`.
- `data/dist/texts/<book_id>.txt` is the UTF-8 copy of the raw source text used by the static frontend.
- Generated dist files are committed to the repository and rebuilt from `data/raw`.

## Frontend dashboard shell contract

- The books shell keeps the selected-book context in app state and reuses it when the `/books` route is reopened without an explicit book.
- The book overview surfaces the selected book as a first-class navigation context back to the atlas shell.
- The atlas shell exposes the active visualization as `/books/<book>/widget/<key>` and keeps the selected widget in app state when the route omits it.
