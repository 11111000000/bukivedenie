import { api } from '../api.js'

export async function viewFiles(book){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewFiles')
    return
  }
  el.innerHTML = `<h2>${book}: файлы</h2><p>Загружаю…</p>`
  const { files } = await api.files(book)
  if(!files?.length){
    el.innerHTML = `<h2>${book}</h2><p>Нет файлов.</p>`
    return
  }
  const list = files.map(name => {
    let downloadUrl = `/data/dist/texts/${book}.txt`
    if(name.endsWith('.txt')){
      downloadUrl = `/data/dist/texts/${book}.txt`
    }else if(name === 'tokens.csv' || name === 'token_freq_by_chapter.csv' || name === 'cooccurrence_edges.csv' || name === 'sentiment_by_chapter.csv'){
      downloadUrl = null
    }else if(name.endsWith('.json')){
      downloadUrl = `/data/dist/books/${book}.json`
    }
    return `
    <li style="display:grid; gap:6px; padding:10px 12px; border:1px solid var(--pico-muted-border-color); border-radius:14px; background:var(--pico-card-background-color);">
      <strong style="overflow-wrap:anywhere;">${name}</strong>
      <span style="display:flex; flex-wrap:wrap; gap:8px;">
        <a href="#/book/${encodeURIComponent(book)}/file/${encodeURIComponent(name)}">Открыть</a>
        ${downloadUrl ? `<a href="${downloadUrl}" target="_blank">Скачать</a>` : ''}
      </span>
    </li>`
  }).join('')
  el.innerHTML = `
    <h2>${book}: файлы</h2>
    <ul style="list-style:none; padding:0; margin:0; display:grid; gap:8px;">${list}</ul>
  `
}
