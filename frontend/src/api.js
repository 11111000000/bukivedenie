// Lightweight fetch wrapper with timeout and visible logging
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

export async function fetchJson(path, opts={}){
  const controller = new AbortController()
  const timeout = opts.timeout ?? 15000 // 15s default
  const timer = setTimeout(()=> controller.abort(), timeout)
  const method = (opts.method||'GET').toUpperCase()
  console.info(`${method} ${path} (timeout ${timeout}ms)`)
  appendLog(`${new Date().toISOString()} - ${method} ${path}`)
  try{
    const res = await fetch(path, { headers: { 'Accept': 'application/json' }, signal: controller.signal, ...opts })
    clearTimeout(timer)
    if(!res.ok){
      const text = await res.text().catch(()=> '')
      const msg = `HTTP ${res.status} ${res.statusText}: ${text}`
      console.error(msg)
      appendLog(`ERROR: ${msg}`)
      throw new Error(msg)
    }
    const data = await res.json().catch(e=>{ throw new Error('Invalid JSON response') })
    console.info(`OK ${method} ${path}`)
    return data
  }catch(e){
    clearTimeout(timer)
    const errMsg = e.name === 'AbortError' ? 'Request timed out' : (e.message || String(e))
    console.error(`${method} ${path} -> ${errMsg}`)
    appendLog(`ERROR: ${method} ${path} -> ${errMsg}`)
    throw e
  }
}

export const api = {
  books: () => fetchJson('/api/books'),
  files: (book) => fetchJson(`/api/files?book=${encodeURIComponent(book)}`),
  fileParsed: (book, name) => fetchJson(`/api/file_parsed?book=${encodeURIComponent(book)}&name=${encodeURIComponent(name)}`),
  tokenByChapter: (book, token) => fetchJson(`/api/token_by_chapter?book=${encodeURIComponent(book)}&token=${encodeURIComponent(token)}`),
  runAnalysis: (raw) => fetchJson(`/api/run_analysis?raw=${encodeURIComponent(raw)}`),
  cloudGenerate: (book) => fetchJson(`/api/cloud_generate?book=${encodeURIComponent(book)}`),
}
