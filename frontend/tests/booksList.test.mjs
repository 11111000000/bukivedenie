import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAtlasMap, buildAtlasSummary, buildBookSignals, buildChapterStructure, buildFilesSummary, buildPunctuationTimeline, buildTokenBars, buildTokenSummary, pickPrimaryTextFile, pickTokensFile, selectedBookFromInput, selectedFragmentFromInput, selectedWidgetFromInput } from '../src/views/booksList.js'
import { buildOverviewActions, buildOverviewMetrics, buildPunctuationPreview as buildOverviewPunctuationPreview, buildTopTokens } from '../src/views/bookOverview.js'
import { buildViewerContext } from '../src/views/fileViewer.js'
import { api } from '../src/api.js'
import { buildNetworkStats, normalizeNetworkRows } from '../src/views/networkGraph.js'
import { buildTokenMetrics, normalizeTokenRows } from '../src/views/tokensChart.js'
import { normalizeWordCloudRows } from '../src/views/wordCloud.js'

test('dashboard helpers prefer the canonical token file and summarize rows', () => {
  assert.equal(pickTokensFile(['notes.txt', 'tokens.csv', 'other.csv']), 'tokens.csv')
  assert.equal(pickTokensFile(['chapter_tokens.csv', 'notes.txt']), 'chapter_tokens.csv')
  assert.deepEqual(buildTokenSummary([
    ['alpha', '12'],
    ['beta', 4],
    ['gamma', null],
  ]), [
    { token: 'alpha', count: 12 },
    { token: 'beta', count: 4 },
    { token: 'gamma', count: 0 },
  ])
})

test('dashboard picks the first text-like file for the shared preview', () => {
  assert.equal(pickPrimaryTextFile(['notes.csv', 'chapter-1.txt', 'appendix.md']), 'chapter-1.txt')
  assert.equal(pickPrimaryTextFile(['tables.csv', 'data.json']), '')
})

test('dashboard atlas summary exposes a viewer route and token signal', () => {
  const summary = buildAtlasSummary('book-a', ['chapter-1.txt', 'tokens.csv'], [
    { token: 'alpha', count: 12 },
    { token: 'beta', count: 4 },
  ])

  assert.equal(summary.fileCountText, '2 files available')
  assert.equal(summary.textCountText, '1 text fragment')
  assert.equal(summary.primaryTextFile, 'chapter-1.txt')
  assert.equal(summary.viewerHref, '#/book/book-a/file/chapter-1.txt')
  assert.deepEqual(summary.topToken, { token: 'alpha', count: 12 })
})

test('dashboard atlas summary leaves the viewer route empty without a primary text file', () => {
  assert.deepEqual(buildAtlasSummary('book-a', ['tokens.csv', 'data.csv'], []), {
    fileCountText: '2 files available',
    textCountText: '0 text fragments',
    primaryTextFile: '',
    tokensFile: 'tokens.csv',
    topToken: null,
    viewerHref: '',
  })
})

test('dashboard shell reuses the selected book when the route omits one', () => {
  assert.equal(selectedBookFromInput('', ['book-a', 'book-b'], 'book-b'), 'book-b')
  assert.equal(selectedBookFromInput('', ['book-a']), 'book-a')
})

test('dashboard shell reuses the selected fragment when the route omits one', () => {
  assert.equal(selectedFragmentFromInput('', ['chapter-1.txt', 'chapter-2.txt'], 'chapter-2.txt'), 'chapter-2.txt')
  assert.equal(selectedFragmentFromInput('', ['chapter-1.txt']), 'chapter-1.txt')
})

test('dashboard atlas map surfaces the selected book and linked fragments', () => {
  assert.deepEqual(buildAtlasMap('book-a', {
    primaryTextFile: 'chapter-1.txt',
    tokensFile: 'tokens.csv',
    viewerHref: '#/book/book-a/file/chapter-1.txt',
  }, ['chapter-1.txt'], { ready: true }, 'chapter-1.txt'), [
    { label: 'Book', value: 'book-a', href: '#/books/book-a', state: 'selected' },
    { label: 'Summary', value: 'ready', href: '', state: 'ready' },
    { label: 'Primary text', value: 'chapter-1.txt', href: '#/book/book-a/file/chapter-1.txt', state: 'linked' },
    { label: 'Tokens', value: 'tokens.csv', href: '#/books/book-a/widget/tokens', state: 'linked' },
    { label: 'Fragments', value: 'chapter-1.txt', href: '#/books/book-a/fragment/chapter-1.txt', state: 'selected' },
  ])
})

test('dashboard atlas map and overview actions point visualizations at the atlas widget route', () => {
  assert.equal(buildAtlasMap('book-a', { primaryTextFile: '', tokensFile: 'tokens.csv', viewerHref: '' }, [], null, '').find(item => item.label === 'Tokens')?.href, '#/books/book-a/widget/tokens')
  assert.deepEqual(buildOverviewActions('book-a').slice(1, 6), [
    { label: 'Tokens', href: '#/books/book-a/widget/tokens', kind: 'contrast' },
    { label: 'Word Cloud', href: '#/books/book-a/widget/wordcloud', kind: 'contrast' },
    { label: 'Network', href: '#/books/book-a/widget/network', kind: 'contrast' },
    { label: 'Sentiment', href: '#/books/book-a/widget/sentiment', kind: 'contrast' },
    { label: 'Heatmap', href: '#/books/book-a/widget/heatmap', kind: 'contrast' },
  ])
})

test('dashboard widget selection reuses the active widget when the route omits one', () => {
  assert.equal(selectedWidgetFromInput('', ['tokens', 'network'], 'network'), 'network')
  assert.equal(selectedWidgetFromInput('', ['tokens']), 'tokens')
})

test('book overview surfaces a first-hop return to the atlas shell', () => {
  assert.deepEqual(buildOverviewActions('book-a'), [
    { label: 'Atlas shell', href: '#/books', kind: 'secondary' },
    { label: 'Tokens', href: '#/books/book-a/widget/tokens', kind: 'contrast' },
    { label: 'Word Cloud', href: '#/books/book-a/widget/wordcloud', kind: 'contrast' },
    { label: 'Network', href: '#/books/book-a/widget/network', kind: 'contrast' },
    { label: 'Sentiment', href: '#/books/book-a/widget/sentiment', kind: 'contrast' },
    { label: 'Heatmap', href: '#/books/book-a/widget/heatmap', kind: 'contrast' },
    { label: 'Files', href: '#/book/book-a/files', kind: 'secondary' },
  ])
})

test('dashboard book menu and fragment lists stay block-oriented', () => {
  const html = `
    <nav class="book-chip-list"><ul class="dashboard-link-list"><li class="dashboard-link-list__item"><a class="book-chip"><strong>alpha</strong><span>Open book</span></a></li></ul></nav>
    <nav class="dashboard-widget-tabs"><ul class="dashboard-link-list"><li class="dashboard-link-list__item"><a class="dashboard-widget-tab is-active" href="#">Tokens</a></li></ul></nav>
    <ul class="dashboard-fragment-list"><li><a href="#"><strong>chapter-1.txt</strong><span>Open fragment</span></a></li></ul>
  `

  assert.match(html, /book-chip/)
  assert.match(html, /dashboard-widget-tab/)
  assert.match(html, /dashboard-fragment-list/)
})

test('dashboard book signals surface the compact book summary metrics', () => {
  assert.deepEqual(buildBookSignals({
    summary: { chapters: 2, words: 40, tokens: 2, punctuation_marks: 2 },
    fragments: [{}, {}],
  }), [
    { label: 'Chapters', value: 2 },
    { label: 'Words', value: 40 },
    { label: 'Tokens', value: 2 },
    { label: 'Punctuation', value: 2 },
    { label: 'Fragments', value: 2 },
  ])
})

test('dashboard punctuation timeline normalizes summary rows', () => {
  assert.deepEqual(buildPunctuationTimeline([
    { symbol: '.', count: '8' },
    ['!', 3],
    { label: '?', value: 2 },
  ]), {
    totalCount: 13,
    maxCount: 8,
    items: [
      { label: '.', count: 8, width: 100, height: 100 },
      { label: '!', count: 3, width: 37.5, height: 37.5 },
      { label: '?', count: 2, width: 25, height: 25 },
    ],
  })
})

test('dashboard token bars normalize counts and cap to the requested limit', () => {
  assert.deepEqual(buildTokenBars([
    ['alpha', '12'],
    ['beta', 4],
    ['gamma', null],
  ], 2), {
    totalCount: 16,
    maxCount: 12,
    items: [
      { token: 'alpha', count: 12, width: 100 },
      { token: 'beta', count: 4, width: 33.33333333333333 },
    ],
  })
})

test('dashboard files summary keeps the compact list bounded', () => {
  assert.deepEqual(buildFilesSummary(['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt']), {
    countText: '5 files available',
    visibleFiles: ['a.txt', 'b.txt', 'c.txt', 'd.txt'],
    remainingCount: 1,
  })
})

test('api exposes the dashboard summary endpoint helper', () => {
  assert.equal(typeof api.bookSummary, 'function')
})

test('static api adapter reads dist payloads with compatible shapes', async () => {
  const [books, summary, index, files, tokens, text, missing] = await Promise.all([
    api.books(),
    api.bookSummary('test_book'),
    api.bookIndex('test_book'),
    api.files('test_book'),
    api.fileParsed('test_book', 'tokens.csv'),
    api.fileParsed('test_book', 'test_book.txt'),
    api.findFile('test_book', 'missing.csv'),
  ])

  assert.ok(books.books.some(book => book.book_id === 'test_book'))
  assert.equal(summary.book, 'test_book')
  assert.equal(summary.ready, true)
  assert.ok(Array.isArray(summary.text_index))
  assert.ok(Array.isArray(index.items))
  assert.ok(index.items.length > 0)
  assert.ok(files.files.includes('tokens.csv'))
  assert.equal(tokens.type, 'csv')
  assert.ok(Array.isArray(tokens.rows))
  assert.equal(text.type, 'text')
  assert.ok(String(text.content || '').length > 0)
  assert.equal(missing, '')
})

test('static api adapter returns safe fallbacks for unsupported endpoints', async () => {
  assert.deepEqual(await api.compareBooks(), { books: [], rows: [] })
  assert.deepEqual(await api.motifSeries(), { series: [], rows: [] })
  assert.deepEqual(await api.cloudGenerate(), { ok: false, error: 'cloudGenerate not supported in static mode' })
})

test('static api adapter reads data/dist payloads and file paths', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if(String(url).endsWith('/data/dist/index.json')) return new Response(JSON.stringify({ books: [{ book_id: 'alpha' }] }), { status: 200 })
    if(String(url).endsWith('/data/dist/books/alpha.json')) return new Response(JSON.stringify({
      book: 'alpha',
      book_id: 'alpha',
      text_path: 'texts/alpha.txt',
      files: ['book.json', 'text.txt'],
      fragments: [{ fragment_id: 'chapter-1', title: 'Chapter 1' }],
      chapter_stats: [],
    }), { status: 200 })
    return new Response('{}', { status: 200 })
  }

  try {
    const books = await api.books()
    const summary = await api.bookSummary('alpha')
    const files = await api.files('alpha')
    const index = await api.bookIndex('alpha')

    assert.deepEqual(books, { books: [{ book_id: 'alpha', book: 'alpha', title: 'alpha' }] })
    assert.equal(summary.book_id, 'alpha')
    assert.equal(summary.text_path, 'texts/alpha.txt')
    assert.deepEqual(files, { files: ['book.json', 'text.txt'] })
    assert.ok(Array.isArray(index.items))
    assert.ok(index.items.length > 0)
    assert.equal(api.fileDownload('alpha', 'chapter-1.txt'), '/data/dist/texts/alpha.txt')
    assert.equal(api.fileDownload('alpha', 'book.json'), '/data/dist/books/alpha.json')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('viewer context links keep the selected book and file aligned', () => {
  assert.deepEqual(buildViewerContext('book / a', 'chapter 1.txt'), {
    bookHref: '#/book/book%20%2F%20a',
    filesHref: '#/book/book%20%2F%20a/files',
    fileHref: '#/book/book%20%2F%20a/file/chapter%201.txt',
  })
})

test('token view helpers normalize rows and compute summary metrics', () => {
  const rows = normalizeTokenRows([
    ['alpha', '12', '1', '3.1'],
    ['beta', 4, 2, 1.2],
    ['', null, null, null],
  ])

  assert.deepEqual(rows, [
    { token: 'alpha', count: 12, rank: 1, per_1k: 3.1 },
    { token: 'beta', count: 4, rank: 2, per_1k: 1.2 },
  ])
  assert.deepEqual(buildTokenMetrics(rows), {
    total: 16,
    unique: 2,
    top: { token: 'alpha', count: 12, rank: 1, per_1k: 3.1 },
    topShare: 12 / 16,
    avgPer1k: (3.1 + 1.2) / 2,
  })
})

test('word cloud helper keeps the list compact and numeric', () => {
  assert.deepEqual(normalizeWordCloudRows([
    ['omega', '9'],
    ['psi', 0],
  ]), [
    { name: 'omega', value: 9 },
    { name: 'psi', value: 1 },
  ])
})

test('network helper merges reciprocal links and sizes nodes by degree', () => {
  const edges = normalizeNetworkRows([
    ['Alice', null, 'Bob', null, '2'],
    ['Bob', null, 'Alice', null, 3],
    ['Alice', null, 'Cara', null, 1],
  ])

  assert.deepEqual(edges, [
    { from: 'Alice', to: 'Bob', weight: 5 },
    { from: 'Alice', to: 'Cara', weight: 1 },
  ])

  const stats = buildNetworkStats(edges)
  assert.equal(stats.totalWeight, 6)
  assert.equal(stats.strongest.weight, 5)
  assert.equal(stats.nodes[0].id, 'Alice')
})

test('overview helpers expose the compact dashboard metrics', () => {
  const summary = {
    ready: true,
    summary: { chapters: 3, words: 120 },
    fragments: [{ title: 'Intro' }],
    text_index: [{ token: 'alpha', count: 9 }, { token: 'beta', count: 4 }],
    punctuation_timeline: [{ symbol: '.', count: 10 }],
  }

  assert.equal(buildOverviewMetrics(summary, ['a', 'b']).length, 6)
  assert.deepEqual(buildTopTokens(summary.text_index), [
    { token: 'alpha', count: 9 },
    { token: 'beta', count: 4 },
  ])
  assert.deepEqual(buildOverviewPunctuationPreview(summary.punctuation_timeline), [
    { label: '.', count: 10 },
  ])
})
