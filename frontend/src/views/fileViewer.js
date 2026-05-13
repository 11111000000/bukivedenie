import { api } from '../api.js'

export function buildViewerContext(book, name){
  const encodedBook = encodeURIComponent(book)
  const encodedName = encodeURIComponent(name)
  return {
    bookHref: `#/book/${encodedBook}`,
    filesHref: `#/book/${encodedBook}/files`,
    fileHref: `#/book/${encodedBook}/file/${encodedName}`,
  }
}

function linksMarkup(ctx, book){
  return `
    <nav style="display:grid; gap:6px; margin-top:-0.25rem; max-width:fit-content;">
      <a href="${ctx.bookHref}">Selected book: ${escapeHtml(book)}</a>
      <a href="${ctx.filesHref}">Files</a>
      <a href="${ctx.fileHref}">This file</a>
    </nav>
  `
}

function isBookJson(name){
  return name === 'book.json' || name.endsWith('.json')
}

export async function viewFile(book, name){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewFile')
    return
  }
  // show local loader instead of clearing whole view
  const _loader = document.createElement('div')
  _loader.id = 'view-loading'
  _loader.textContent = 'Загружаю…'
  el.appendChild(_loader)
  const ctx = buildViewerContext(book, name)
  const resp = await api.fileParsed(book, name)
  if(resp.type === 'csv'){
    const { headers = [], rows = [] } = resp
    const head = `<tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr>`
    const body = rows.map(r=>`<tr>${headers.map((h,i)=>`<td>${escapeHtml(String(r[i]??''))}</td>`).join('')}</tr>`).join('')
    el.innerHTML = `
      <h2>${book}: ${name}</h2>
      ${linksMarkup(ctx, book)}
      <div style="overflow:auto; max-width:100%;">
        <table role="grid">
          <thead>${head}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `
  } else if(resp.type === 'json' || resp.type === 'text'){
    const data = resp.data ?? resp.content
    const downloadHref = isBookJson(name) ? `/data/dist/books/${book}.json` : `/data/dist/texts/${book}.txt`
    el.innerHTML = `
      <h2>${book}: ${name}</h2>
      ${linksMarkup(ctx, book)}
      <p><a href="${downloadHref}" target="_blank">Скачать статический файл</a></p>
      <pre style="white-space:pre-wrap;">${escapeHtml(typeof data==='string'?data:JSON.stringify(data,null,2))}</pre>
    `
  } else if(resp.type === 'jsonl'){
    const data = resp.data || []
    el.innerHTML = `
      <h2>${book}: ${name}</h2>
      ${linksMarkup(ctx, book)}
      <pre style="white-space:pre;">${escapeHtml(data.map(o=>JSON.stringify(o)).join('\n'))}</pre>
    `
  } else {
    el.innerHTML = `<h2>${book}: ${name}</h2>${linksMarkup(ctx, book)}<p>Неизвестный тип файла</p>`
  }
  // remove loader if present
  const loaderEl = document.getElementById('view-loading')
  if(loaderEl && loaderEl.parentNode) loaderEl.remove()
}
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))
}
