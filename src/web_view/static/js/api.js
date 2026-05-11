export async function fetchJson(path, opts={}){
  const res = await fetch(path, { headers: { 'Accept': 'application/json' }, ...opts })
  if(!res.ok){
    const text = await res.text().catch(()=> '')
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  return res.json()
}

export const api = {
  books: () => fetchJson('/api/books'),
  files: (book) => fetchJson(`/api/files?book=${encodeURIComponent(book)}`),
  fileParsed: (book, name) => fetchJson(`/api/file_parsed?book=${encodeURIComponent(book)}&name=${encodeURIComponent(name)}`),
  tokenByChapter: (book, token) => fetchJson(`/api/token_by_chapter?book=${encodeURIComponent(book)}&token=${encodeURIComponent(token)}`),
  runAnalysis: (raw) => fetchJson(`/api/run_analysis?raw=${encodeURIComponent(raw)}`),
  cloudGenerate: (book) => fetchJson(`/api/cloud_generate?book=${encodeURIComponent(book)}`),
}
