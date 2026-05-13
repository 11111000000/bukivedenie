import './style.css'
import { buildShell, createChart, fetchJSON, fetchText, mountShell, normalizeRows, parseCSV } from './shared.js'

const DATA_ROOT = './data/war-and-peace'
const BOOKS = [
  { id: 'tolstoj_lew_nikolaewich-text_1', title: 'Война и мир, том 1' },
  { id: 'tolstoj_lew_nikolaewich-text_2', title: 'Война и мир, том 2' },
  { id: 'tolstoj_lew_nikolaewich-text_3', title: 'Война и мир, том 3' },
  { id: 'tolstoj_lew_nikolaewich-text_4', title: 'Война и мир, том 4' },
  { id: 'tolstoj_lew_nikolaewich-text_0060', title: 'Война и мир, том 3 (fb2)' },
]

mountShell(buildShell({
  title: 'Война и мир',
  subtitle: 'Отдельные страницы по роману Толстого: сводка, частоты, главы, персонажи и структура текста.',
  controls: `
    <label>
      Том
      <select id="wp-book"></select>
    </label>
    <label>
      Top-N токенов
      <input id="wp-top-n" type="range" min="10" max="60" step="5" value="20" />
    </label>
    <div class="status" id="wp-status"></div>
  `,
  aside: '<div class="status">Без iframe, без CDN, единый стиль</div>',
}))

document.querySelector('#app-main').innerHTML = `
  <div class="cards" id="wp-cards"></div>
  <section class="grid">
    <article class="panel full"><h2>Частотное ядро</h2><div id="wp-wordcloud" class="viz tall"></div></article>
    <article class="panel"><h2>Top tokens</h2><div id="wp-tokens" class="viz"></div></article>
    <article class="panel"><h2>Ритм глав</h2><div id="wp-chapters" class="viz"></div></article>
    <article class="panel"><h2>Пунктуация</h2><div id="wp-punctuation" class="viz"></div></article>
    <article class="panel full"><h2>Токены × главы</h2><div id="wp-token-heatmap" class="viz tall"></div></article>
    <article class="panel full"><h2>Главы: words × sentences</h2><div id="wp-scatter" class="viz"></div></article>
    <article class="panel full"><h2>Zipf</h2><div id="wp-zipf" class="viz"></div></article>
    <article class="panel"><h2>Метаданные</h2><div class="scroll-panel" id="wp-meta"></div></article>
    <article class="panel"><h2>Фрагменты</h2><div class="scroll-panel" id="wp-fragments"></div></article>
  </section>
`

const bookSelect = document.querySelector('#wp-book')
const topNInput = document.querySelector('#wp-top-n')
const statusEl = document.querySelector('#wp-status')
const cardsEl = document.querySelector('#wp-cards')

const charts = Object.fromEntries(['wp-wordcloud', 'wp-tokens', 'wp-chapters', 'wp-punctuation', 'wp-token-heatmap', 'wp-scatter', 'wp-zipf'].map((id) => [id, createChart(document.getElementById(id))]))

function cardRows(stats) {
  return [
    ['chapters', stats.chapters],
    ['words', stats.words],
    ['tokens', stats.tokens],
    ['punctuation_marks', stats.punctuation_marks],
  ]
}

function renderCards(summary = {}) {
  cardsEl.innerHTML = cardRows(summary).map(([label, value]) => `<div class="card"><div class="label">${label}</div><div class="value">${value ?? '—'}</div></div>`).join('')
}

function renderTable(container, rows, headers) {
  const list = normalizeRows(rows)
  if (!list.length) {
    container.innerHTML = '<div class="muted" style="padding:12px">Нет данных</div>'
    return
  }
  container.innerHTML = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${list.map((row) => `<tr>${headers.map((header) => `<td>${String(row[header] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

async function loadBook(bookId) {
  const dir = `${DATA_ROOT}/${encodeURIComponent(bookId)}`
  const loaders = [
    ['book', `${dir}.json`, 'json'],
    ['tokens', `${dir}/tokens.csv`, 'csv'],
    ['chapters', `${dir}/chapter_stats.json`, 'json'],
    ['punctuation', `${dir}/punctuation_counts.csv`, 'csv'],
    ['tokenByChapter', `${dir}/token_by_chapter.csv`, 'csv'],
    ['sentiment', `${dir}/sentiment_by_chapter.csv`, 'csv'],
    ['cooccurrence', `${dir}/cooccurrence_edges.csv`, 'csv'],
    ['metadata', `${dir}/run_metadata.json`, 'json'],
    ['fragments', `${dir}/fragments.json`, 'json'],
  ]
  const payload = {}
  for (const [key, path, type] of loaders) {
    try {
      payload[key] = type === 'json' ? await fetchJSON(path) : parseCSV(await fetchText(path))
    } catch {
      payload[key] = null
    }
  }
  const book = payload.book && typeof payload.book === 'object' ? payload.book : {}
  const summary = book.summary || {}
  return {
    summary,
    textIndex: Array.isArray(book.text_index) ? book.text_index : [],
    fragments: normalizeRows(book.fragments || payload.fragments),
    punctuation: normalizeRows(book.punctuation_timeline || payload.punctuation),
    chapterStats: normalizeRows(book.chapter_stats || payload.chapters),
    tokenByChapter: normalizeRows(book.token_by_chapter || payload.tokenByChapter),
    sentiment: normalizeRows(book.sentiment_by_chapter || payload.sentiment),
    cooccurrence: normalizeRows(book.cooccurrence_edges || payload.cooccurrence),
    metadata: payload.metadata || book,
  }
}

function renderWordCloud(rows) {
  const data = rows.slice(0, 100).map((row) => ({ name: row.token, value: Number(row.count || 0) }))
  charts['wp-wordcloud'].setOption({ tooltip: {}, series: [{ type: 'wordCloud', shape: 'circle', gridSize: 10, sizeRange: [14, 60], rotationRange: [-45, 45], textStyle: { color: () => `hsl(${Math.floor(Math.random() * 360)}, 50%, 38%)` }, data }] })
}

function renderTokenBar(rows, topN) {
  const data = rows.slice(0, topN)
  charts['wp-tokens'].setOption({ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 120, right: 16, top: 10, bottom: 24 }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: data.map((row) => row.token), inverse: true }, series: [{ type: 'bar', data: data.map((row) => Number(row.count || 0)), itemStyle: { color: '#3558a6' } }] })
}

function renderChapterStats(rows) {
  const list = normalizeRows(rows)
  charts['wp-chapters'].setOption({ tooltip: { trigger: 'axis' }, grid: { left: 48, right: 20, top: 18, bottom: 24 }, legend: { data: ['words', 'sentences', 'dialog ratio'] }, xAxis: { type: 'category', data: list.map((row) => `Г${row.chapter_idx + 1}`) }, yAxis: [{ type: 'value' }, { type: 'value', max: 1 }], series: [{ name: 'words', type: 'bar', data: list.map((row) => Number(row.words || row.total_words || 0)), itemStyle: { color: '#3558a6' } }, { name: 'sentences', type: 'line', data: list.map((row) => Number(row.sentences || row.total_sentences || 0)), yAxisIndex: 0, smooth: true, color: '#7a4fd7' }, { name: 'dialog ratio', type: 'line', data: list.map((row) => Number(row.dialog_ratio || 0)), yAxisIndex: 1, smooth: true, color: '#0c8f6a' }] })
}

function renderPunctuation(rows) {
  const data = rows.slice(0, 20)
  charts['wp-punctuation'].setOption({ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 48, right: 18, top: 10, bottom: 24 }, xAxis: { type: 'category', data: data.map((row) => row.punct) }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: data.map((row) => Number(row.count || 0)), itemStyle: { color: '#0c8f6a' } }] })
}

function renderTokenHeatmap(rows) {
  const list = normalizeRows(rows)
  const topTokens = list.slice().sort((a, b) => Number(b.count || 0) - Number(a.count || 0)).slice(0, 12)
  const names = topTokens.map((row) => row.token)
  const chapters = Array.from(new Set(list.map((row) => row.chapter_idx))).sort((a, b) => Number(a) - Number(b)).map((idx) => `Г${Number(idx) + 1}`)
  const nameIndex = new Map(names.map((name, index) => [String(name).toLowerCase(), index]))
  const data = []
  for (const row of list) {
    const tokenIdx = nameIndex.get(String(row.token || '').toLowerCase())
    if (tokenIdx === undefined) continue
    const chapterIdx = Number(row.chapter_idx || 0)
    if (!chapters[chapterIdx]) continue
    data.push([chapterIdx, tokenIdx, Number(row.count || 0)])
  }
  charts['wp-token-heatmap'].setOption({ tooltip: { position: 'top' }, grid: { left: 96, right: 18, top: 16, bottom: 34 }, xAxis: { type: 'category', data: chapters, splitArea: { show: true } }, yAxis: { type: 'category', data: names, splitArea: { show: true } }, visualMap: { min: 0, max: Math.max(1, ...data.map((item) => item[2])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 }, series: [{ type: 'heatmap', data, label: { show: false } }] })
}

function renderScatter(rows) {
  const list = normalizeRows(rows)
  charts['wp-scatter'].setOption({ tooltip: { trigger: 'item' }, grid: { left: 48, right: 24, top: 18, bottom: 32 }, xAxis: { type: 'value', name: 'words' }, yAxis: { type: 'value', name: 'sentences' }, series: [{ type: 'scatter', symbolSize: (value) => Math.max(6, Math.min(20, value[2] * 4)), data: list.map((row) => [Number(row.words || 0), Number(row.sentences || 0), Number(row.dialog_ratio || 0)]), itemStyle: { color: '#7a4fd7' } }] })
}

function renderZipf(rows) {
  const list = rows.slice().sort((a, b) => Number(b.count || 0) - Number(a.count || 0)).map((row, index) => ({ ...row, rank: row.rank || index + 1 }))
  charts['wp-zipf'].setOption({ tooltip: { trigger: 'axis' }, grid: { left: 60, right: 18, top: 18, bottom: 40 }, xAxis: { type: 'log', name: 'rank' }, yAxis: { type: 'log', name: 'frequency' }, series: [{ type: 'scatter', symbolSize: 6, data: list.map((row) => [Math.max(1, row.rank), Math.max(1, row.count), row.token]), itemStyle: { color: '#3558a6' }, encode: { x: 0, y: 1, tooltip: [2, 0, 1] } }] })
}

async function init() {
  const manifest = await fetchJSON(`${DATA_ROOT}/index.json`).catch(() => ({ books: BOOKS }))
  const books = Array.isArray(manifest.books) && manifest.books.length ? manifest.books : BOOKS
  bookSelect.innerHTML = books.map((book) => `<option value="${book.id}">${book.title}</option>`).join('')
  const render = async () => {
    statusEl.textContent = 'Загрузка...'
    const data = await loadBook(bookSelect.value)
    renderCards(data.summary)
    renderWordCloud(data.textIndex)
    renderTokenBar(data.textIndex, Number(topNInput.value || 20))
    renderChapterStats(data.chapterStats)
    renderPunctuation(data.punctuation)
    renderTokenHeatmap(data.tokenByChapter)
    renderScatter(data.chapterStats)
    renderZipf(data.textIndex)
    renderTable(document.querySelector('#wp-meta'), Object.entries(data.metadata || {}).map(([key, value]) => ({ key, value: typeof value === 'object' ? JSON.stringify(value) : value })), ['key', 'value'])
    renderTable(document.querySelector('#wp-fragments'), data.fragments, ['chapter_idx', 'title', 'words', 'sentences', 'dialog_ratio'])
    statusEl.textContent = 'Готово'
  }
  bookSelect.addEventListener('change', render)
  topNInput.addEventListener('input', render)
  await render()
}

init()
