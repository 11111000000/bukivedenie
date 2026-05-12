# Surface

## Backend dashboard contract

- `GET /api/book_summary?book=<book_id>` returns a cheap, compare-friendly JSON payload for dashboard-first visualizations.
- Payload includes `book`, `ready`, `status`, `summary` (absolute book-level counts), `text_index` (stable token frequency rows), `fragments` (ordered chapter fragments), and `punctuation_timeline` (ordered punctuation rows).
- `GET /api/books` returns each book with `ready` and `status` markers.
- `GET /api/book_index?book=<book_id>&offset=<n>&size=<n>` returns ordered chapter-index rows with the same chapter fragment shape used by `fragments`.
- `GET /api/book_fragments?book=<book_id>&offset=<n>&size=<n>` returns ordered chapter-fragment rows.
- `GET /api/punctuation_timeline?book=<book_id>&offset=<n>&size=<n>` returns ordered punctuation counts by chapter.

## Frontend dashboard shell contract

- The books shell keeps the selected-book context in app state and reuses it when the `/books` route is reopened without an explicit book.
- The book overview surfaces the selected book as a first-class navigation context back to the atlas shell.
