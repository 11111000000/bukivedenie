// Lightweight static API adapter with timeout and visible logging
const API_BASE = (() => {
  try{
    const fromWindow = window.__API_BASE__
    if(typeof fromWindow === 'string' && fromWindow.length) return fromWindow
    const params = new URLSearchParams(location.search)
    const fromQuery = params.get('api')
    if(fromQuery) return fromQuery
    const isDevPort = location.port === '5173'
    const isLocal = ['127.0.0.1', 'localhost'].includes(location.hostname)
    return (isDevPort || isLocal) ? 'http://127.0.0.1:8000' : ''
  }catch(e){
    return ''
  }
})()

function apiPath(path){
  return `${API_BASE}${path}`
}

function appendLog(msg){
  try{
    const el = document.getElementById('logs')
    if(!el) return
    const p = document.createElement('div')
    p.textContent = msg
    p.style.padding = '6px 8px'
    p.style.borderBottom = '1px solid rgba(0,0,0,0.06)'
    p.style.fontSize = '13px'
    p.style.color = '#222'
    el.prepend(p)
  }catch(e){ /* ignore */ }
}

function logBase(){
  try{
    console.info(`API base resolved to ${API_BASE || '(same-origin)'}`)
    appendLog(`API base: ${API_BASE || '(same-origin)'}`)
  }catch(e){ /* ignore */ }
}

logBase()

export async function fetchJson(path, opts={}){
  const controller = new AbortController()
  const timeout = opts.timeout ?? 30000 // 30s default
  const timer = setTimeout(()=> controller.abort(), timeout)
  const method = (opts.method||'GET').toUpperCase()
  console.info(`${method} ${apiPath(path)} (timeout ${timeout}ms)`)
  appendLog(`${new Date().toISOString()} - ${method} ${apiPath(path)}`)
  try{
    const url = apiPath(path)
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: controller.signal, ...opts })
    clearTimeout(timer)
    if(!res.ok){
      const text = await res.text().catch(()=> '')
      const msg = `HTTP ${res.status} ${res.statusText}: ${text}`
      console.error(msg)
      appendLog(`ERROR: ${msg}`)
      throw new Error(msg)
    }
    // try to parse JSON, but on failure include raw text in logs for easier debugging
    const raw = await res.text().catch(()=> '')
    try{
      const data = raw ? JSON.parse(raw) : null
      console.info(`OK ${method} ${apiPath(path)}`)
      return data
    }catch(e){
      const preview = raw ? raw.slice(0, 1000) : ''
      const msg = `Invalid JSON response${preview?`: ${preview}`:''}`
      console.error(msg)
      appendLog(`ERROR: ${msg}`)
      // also expose raw text on error object for debug inspectors
      const err = new Error('Invalid JSON response')
      err.raw = raw
      throw err
    }
  }catch(e){
    clearTimeout(timer)
    const errMsg = e.name === 'AbortError' ? 'Request timed out' : (e.message || String(e))
    console.error(`${method} ${apiPath(path)} -> ${errMsg}`)
    appendLog(`ERROR: ${method} ${apiPath(path)} -> ${errMsg}`)
    throw e
  }
}

function csvRowsToString(headers, rows){
  const lines = [headers.join(',')]
  for(const row of rows){
    const line = headers.map(h => {
      const v = row[h]
      if(v === null || v === undefined) return ''
      if(typeof v === 'string' && v.includes(',')) return `"${v.replace(/"/g, '""')}"`
      return String(v)
    }).join(',')
    lines.push(line)
  }
  return lines.join('\n')
}

function parseCsvFromBook(bookData, csvName){
  let headers = []
  let rows = []
  switch(csvName){
    case 'tokens.csv':
      headers = ['token', 'count', 'rank', 'per_1k'];
      rows = safeArray(bookData.text_index).map((row, i) => [
        row?.token ?? '',
        row?.count ?? 0,
        i + 1,
        row?.per_1k ?? 0,
      ]);
      break
    case 'token_freq_by_chapter.csv':
      headers = ['token', 'title', 'chapter_idx', 'count'];
      rows = safeArray(bookData.token_by_chapter).map(row => [
        row?.token ?? '',
        row?.title ?? '',
        row?.chapter_idx ?? '',
        row?.count ?? 0,
      ]);
      break
    case 'cooccurrence_edges.csv':
      headers = ['source', 'source_lower', 'target', 'target_lower', 'weight'];
      rows = safeArray(bookData.cooccurrence_edges).map(row => [
        row?.source ?? row?.from ?? '',
        row?.source_lower ?? row?.from_lower ?? String(row?.source ?? row?.from ?? '').toLowerCase(),
        row?.target ?? row?.to ?? '',
        row?.target_lower ?? row?.to_lower ?? String(row?.target ?? row?.to ?? '').toLowerCase(),
        row?.weight ?? 0,
      ]);
      break
    case 'sentiment_by_chapter.csv':
      headers = ['chapter', 'avg'];
      rows = safeArray(bookData.sentiment_by_chapter).map(row => [
        row?.chapter || row?.title || '',
        row?.score ?? row?.avg ?? '',
      ]);
      break
    default:
      headers = []
      rows = []
  }
  return { type: 'csv', headers, rows }
}

const DATA_DIR = '/data/dist'
const STATIC_DATA_DIR = './data/dist'
const IS_NODE = typeof window === 'undefined'

function safeArray(value){
  return Array.isArray(value) ? value : []
}

function normalizeBookEntry(entry){
  if(typeof entry === 'string'){
    return { book_id: entry, book: entry, title: entry }
  }
  if(entry && typeof entry === 'object'){
    const bookId = entry.book_id || entry.book || entry.title || ''
    return {
      ...entry,
      book_id: bookId,
      book: entry.book || bookId,
      title: entry.title || bookId,
    }
  }
  return null
}

function normalizeBookData(data, book){
  const source = data && typeof data === 'object' ? data : {}
  const bookId = source.book_id || source.book || book
  const summary = source.summary && typeof source.summary === 'object' ? source.summary : {}
  return {
    book: source.book || bookId,
    book_id: bookId,
    title: source.title || bookId,
    ready: Boolean(source.ready ?? true),
    status: source.status || (source.ready === false ? 'pending' : 'ready'),
    summary,
    text_path: source.text_path || `texts/${bookId}.txt`,
    generated_at: source.generated_at || '',
    text_index: safeArray(source.text_index),
    fragments: safeArray(source.fragments),
    punctuation_timeline: safeArray(source.punctuation_timeline),
    chapter_stats: source.chapter_stats && typeof source.chapter_stats === 'object' ? source.chapter_stats : {},
    token_by_chapter: safeArray(source.token_by_chapter),
    cooccurrence_edges: safeArray(source.cooccurrence_edges),
    sentiment_by_chapter: safeArray(source.sentiment_by_chapter),
    files: safeArray(source.files),
  }
}

async function readStaticAsset(path, kind='json'){
  if(IS_NODE){
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import('node:fs/promises'),
      import('node:url'),
    ])
    try{
      const res = await fetch(`http://127.0.0.1${path}`)
      if(res.ok){
        return kind === 'json' ? res.json() : res.text()
      }
    }catch(e){ /* fall through to file access */ }
    const absolute = fileURLToPath(new URL(`../../${String(path).replace(/^\//, '')}`, import.meta.url))
    const raw = await readFile(absolute, 'utf8')
    return kind === 'json' ? JSON.parse(raw) : raw
  }
  const res = await fetch(path)
  if(!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return kind === 'json' ? res.json() : res.text()
}

async function staticFetchJson(path){
  return readStaticAsset(path, 'json')
}

async function staticFetchText(path){
  return readStaticAsset(path, 'text')
}

function toCsvRows(payload){
  if(Array.isArray(payload)) return payload
  if(payload && Array.isArray(payload.rows)) return payload.rows
  return []
}

export const api = {
  _cache: new Map(),
  _getBookData: async function(book){
    if(this._cache.has(book)) return this._cache.get(book)
    try{
      const data = await staticFetchJson(`${DATA_DIR}/books/${book}.json`).catch(() => staticFetchJson(`${STATIC_DATA_DIR}/books/${book}.json`))
      const normalized = normalizeBookData(data, book)
      this._cache.set(book, normalized)
      return normalized
    }catch(e){
      console.error(e)
      return normalizeBookData({}, book)
    }
  },
  books: async function(){
    try{
      const data = await staticFetchJson(`${DATA_DIR}/index.json`).catch(() => staticFetchJson(`${STATIC_DATA_DIR}/index.json`))
      return { books: safeArray(data.books).map(normalizeBookEntry).filter(Boolean) }
    }catch(e){
      return { books: [] }
    }
  },
  files: async function(book){
    const data = await this._getBookData(book)
    return { files: safeArray(data.files) }
  },
  fileParsed: async function(book, name){
    if(name.endsWith('.csv')){
      const data = await this._getBookData(book)
      return parseCsvFromBook(data, name)
    }
    if(name.endsWith('.jsonl')){
      const raw = await staticFetchText(`${DATA_DIR}/books/${book}/${name}`).catch(() => staticFetchText(`${STATIC_DATA_DIR}/books/${book}/${name}`))
      return {
        type: 'jsonl',
        data: raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => JSON.parse(line)),
      }
    }
    if(name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown')){
      const content = await staticFetchText(`${DATA_DIR}/texts/${book}.txt`).catch(() => staticFetchText(`${STATIC_DATA_DIR}/texts/${book}.txt`))
      return { type: 'text', content }
    }
    if(name.endsWith('.json')){
      const data = await this._getBookData(book)
      return { type: 'json', data }
    }
    return staticFetchJson(`${DATA_DIR}/books/${book}/${name}`).catch(() => staticFetchJson(`${STATIC_DATA_DIR}/books/${book}/${name}`))
  },
  bookSummary: async function(book){
    return this._getBookData(book)
  },
  bookIndex: async function(book){
    const data = await this._getBookData(book)
    return { items: safeArray(data.fragments), rows: safeArray(data.fragments), fragments: safeArray(data.fragments) }
  },
  chapterStats: async function(book){
    const data = await this._getBookData(book)
    return { chapters: data.chapter_stats, rows: safeArray(data.chapter_stats?.rows || data.chapter_stats) }
  },
  compareBooks: async () => ({ books: [], rows: [] }),
  motifSeries: async () => ({ series: [], rows: [] }),
  tokenByChapter: async function(book, token){
    const data = await this._getBookData(book)
    const rows = data.token_by_chapter || []
    return {
      counts: rows.filter(r => r.token === token),
      rows: rows.filter(r => r.token === token),
    }
  },
  runAnalysis: async () => ({ ok: false, error: 'runAnalysis not supported in static mode' }),
  cloudGenerate: async () => ({ ok: false, error: 'cloudGenerate not supported in static mode' }),
  findFile: async function(book, name){
    const files = await this.files(book).then(r => r.files || [])
    return files.includes(name) ? name : ''
  },
  file: async function(book, name){
    return this.fileParsed(book, name)
  },
  fileDownload: function(book, name){
    if(name.endsWith('.txt')) return `/data/dist/texts/${book}.txt`
    if(name.endsWith('.json')) return `/data/dist/books/${book}.json`
    return ''
  }
}

export default api



// Previous fetchJson and api are deprecated, deprecated code remains if needed.

// End of static api adapter.
