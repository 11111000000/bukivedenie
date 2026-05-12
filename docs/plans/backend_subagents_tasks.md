Backend subagents - concrete tasks

This file collects the short, actionable tasks for each backend subagent so work can be run in parallel.

Subagent A — source of truth (STATUS: done ✅)
- Ensure `/api/books` is robust when outputs/ or data/ are missing — implemented (guarding OUTPUTS_DIR)
- Harden `/api/run_analysis` input validation and timeouts — implemented (reject traversal, map TimeoutExpired→504)
- Tests added: missing outputs, run_analysis traversal, run_analysis timeout — implemented and passing

Subagent B — compact book summary (STATUS: done ✅)
- `/api/book_summary` returns: `book`, `ready`, `summary`, `text_index`, `fragments`, `punctuation_timeline` (implemented)
- In-process caching by file mtimes implemented (`_BOOK_SUMMARY_CACHE`)
- Tests added that assert payload shape and stability

Next actions:
- (opt) add HTTP caching headers (Cache-Control, ETag) so clients and proxies can avoid repeated calls
- (opt) expose `last_modified` or `etag` fields in payload for client-side caching decisions

Subagent C — fragments, timeline, index (STATUS: done ✅)
- `/api/book_fragments` and `/api/punctuation_timeline` implemented and tested
- `/api/book_index` and `/api/chapter_stats` implemented (lightweight, derived from chapters_summary.json and raw text)
- CSV fallback and pagination fixes applied (read full CSV then slice)

Next actions:
- Improve `book_index` to include paragraph/sentence token mapping when available (requires processed sentences jsonl output)
- Add token_coverage endpoint for coverage curves (phase 2)

Subagent D — safety & regression (STATUS: done ✅)
- `safe_join` hardened; path traversal rejection improved and tested
- file download filename sanitization fixed; tests added (preserve '+' and sanitize quotes/newlines)

Next actions:
- Expand negative tests for other endpoints that accept filenames/paths (e.g., `file_parsed`, `figure_download` with complex names)

Subagent E — integration & selection state (STATUS: started)
- Frontend stubs added:
  - `frontend/src/state.js` (minimal global state helper)
  - `frontend/src/api.js` extended to call `/api/book_index`, `/api/chapter_stats`, `/api/compare_books`, `/api/motif_series`
  - `frontend/src/views/*` updated to call `bookIndex` and `chapterStats` where appropriate

Next actions (frontend work required):
- Wire Book Atlas to use `book_fragments`/`book_index` for brush/selection
- Implement selection propagation using `state.js` and add UI handlers for click/brush
- Replace raw previews with excerpts fetched from `/api/book_fragments`

Subagent F — smoke & artifacts (STATUS: scaffolded)
- `scripts/ui_smoke.mjs` present and can run browserless; static server wrapper will serve `frontend/`
- Smoke harness integration: needs to be wired to CI and to use the running backend in test env

Next actions:
- Add a smoke job in CI that starts the backend, runs the smoke script, and collects artifacts
- Extend smoke scenarios to include click-to-viewer and brush interactions (requires frontend wiring)

Order of operations
1. D (safety) and A (source of truth) first — blocks to the rest if unsafe.
2. B and C in parallel — ensure payloads are available and cheap.
3. E (integration) — connect frontend.
4. F (smoke) — end-to-end checks.
