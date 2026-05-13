import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BROWSER_PATH_CANDIDATES, DEFAULT_OUT_DIR, ROUTES, artifactPaths, browserLaunchArgs, launchBrowser, preflight, routeUrl, slugify } from '../../scripts/ui_smoke.mjs'

test('smoke route manifest stays stable', () => {
  const dashboard = ROUTES.find(route => route.name === 'dashboard')
  const overview = ROUTES.find(route => route.name === 'overview')
  const widget = ROUTES.find(route => route.name === 'widget')
  const fileRoute = ROUTES.find(route => route.name === 'file')

  assert.ok(ROUTES.length >= 6)
  assert.equal(ROUTES[0].name, 'dashboard')
  assert.equal(ROUTES[0].kind, 'dashboard')
  assert.deepEqual(dashboard, {
    name: 'dashboard',
    hash: '#/books',
    kind: 'dashboard',
    ready: '#view .dashboard-shell, #view .dashboard-atlas-panel',
  })
  assert.deepEqual(overview, {
    name: 'overview',
    hash: '#/book/{book}',
    kind: 'overview',
    ready: '#view details',
  })
  assert.equal(fileRoute?.ready, '#view table, #view pre')
  assert.deepEqual(widget, {
    name: 'widget',
    hash: '#/books/{book}/widget/{widget}',
    kind: 'widget',
    ready: '#view .dashboard-widget--focus, #view .dashboard-atlas-panel',
  })
  assert.equal(slugify('Heatmap / token × chapter'), 'heatmap-token-chapter')
  assert.equal(routeUrl('http://127.0.0.1:8000', ROUTES[0], 'book-a', 'file.csv'), 'http://127.0.0.1:8000/#/books')
  assert.equal(routeUrl('http://127.0.0.1:8000', widget, 'book-a', 'tokens.csv'), 'http://127.0.0.1:8000/#/books/book-a/widget/tokens')
  assert.equal(DEFAULT_OUT_DIR, 'artifacts/ui-smoke')
  assert.ok(BROWSER_PATH_CANDIDATES.includes('/data/data/com.termux/files/usr/bin/chromium'))
  assert.ok(typeof dashboard?.ready === 'string' && dashboard.ready.includes('.dashboard-atlas-panel'))
  assert.deepEqual(artifactPaths('/tmp/out', 'dashboard', 'Book Atlas'), {
    htmlPath: '/tmp/out/html/book-atlas__dashboard.html',
    screenshotPath: '/tmp/out/screens/book-atlas__dashboard.png',
  })
  assert.deepEqual(artifactPaths('/tmp/out', 'file', 'Book Atlas'), {
    htmlPath: '/tmp/out/html/book-atlas__file.html',
    screenshotPath: '/tmp/out/screens/book-atlas__file.png',
  })
  assert.equal(browserLaunchArgs('/usr/bin/chromium', true).headless, false)

  // new readiness selectors for viz routes should be present
  const network = ROUTES.find(r => r.name === 'network')
  const heatmap = ROUTES.find(r => r.name === 'heatmap')
  assert.ok(network && typeof network.ready === 'string')
  assert.ok(network.ready.includes('#net .network-node') || network.ready.includes('#net .node'))
  assert.ok(heatmap && typeof heatmap.ready === 'string')
  assert.ok(heatmap.ready.includes('#hm .heatmap-tile') || heatmap.ready.includes('#hm .heatmap-layer'))
})

test('browser launch helper falls back cleanly when launch fails', async () => {
  const browser = await launchBrowser({ launch: async () => { throw new Error('boom') } }, '/usr/bin/chromium', false)
  assert.equal(browser, null)
})

test('preflight captures book summary shape', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    if(String(url).includes('/api/books')) return new Response(JSON.stringify({ books: ['alpha'] }), { status: 200 })
    if(String(url).includes('/api/files')) return new Response(JSON.stringify({ files: ['tokens.csv'] }), { status: 200 })
    if(String(url).includes('/api/book_summary')) return new Response(JSON.stringify({ book: 'alpha', ready: true, status: 'ready', summary: {}, text_index: [], fragments: [], punctuation_timeline: [] }), { status: 200 })
    return new Response('{}', { status: 200 })
  }
  try{
    const report = await preflight('http://127.0.0.1:8000', '')
    assert.equal(report.ok, true)
    assert.deepEqual(report.books, ['alpha'])
    assert.deepEqual(report.files, ['tokens.csv'])
    assert.equal(report.selectedBook, 'alpha')
    assert.equal(report.bookSummary?.book, 'alpha')
    assert.equal(report.bookSummary?.ready, true)
    assert.equal(report.bookSummary?.status, 'ready')
    assert.ok(Array.isArray(report.bookSummary?.text_index))
    assert.ok(Array.isArray(report.bookSummary?.fragments))
    assert.ok(Array.isArray(report.bookSummary?.punctuation_timeline))
    // selectedBook and bookSummary shapes
    assert.equal(typeof report.selectedBook, 'string')
    assert.ok(report.bookSummary && typeof report.bookSummary === 'object')
  }finally{
    globalThis.fetch = originalFetch
  }
})
