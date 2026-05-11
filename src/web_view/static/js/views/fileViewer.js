import { api } from '../api.js'

export async function viewFile(book, name){
  const el = document.getElementById('view')
  el.innerHTML = `<h2>${book}: ${name}</h2><p>Загружаю…</p>`
  const resp = await api.fileParsed(book, name)
  if(resp.type === 'csv'){
    const { headers = [], rows = [] } = resp
    const head = `<tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr>`
    const body = rows.map(r=>`<tr>${headers.map((h,i)=>`<td>${escapeHtml(String(r[i]??''))}</td>`).join('')}</tr>`).join('')
    el.innerHTML = `
      <h2>${book}: ${name}</h2>
      <div style="overflow:auto; max-width:100%;">
        <table role="grid">
          <thead>${head}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `
  } else if(resp.type === 'json' || resp.type === 'text'){
    const data = resp.data ?? resp.content
    el.innerHTML = `
      <h2>${book}: ${name}</h2>
      <pre style="white-space:pre-wrap;">${escapeHtml(typeof data==='string'?data:JSON.stringify(data,null,2))}</pre>
    `
  } else if(resp.type === 'jsonl'){
    const data = resp.data || []
    el.innerHTML = `
      <h2>${book}: ${name}</h2>
      <pre style="white-space:pre;">${escapeHtml(data.map(o=>JSON.stringify(o)).join('\n'))}</pre>
    `
  } else {
    el.innerHTML = `<h2>${book}: ${name}</h2><p>Неизвестный тип файла</p>`
  }
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))
}
