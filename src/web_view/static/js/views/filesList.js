import { api } from '../api.js'

export async function viewFiles(book){
  const el = document.getElementById('view')
  el.innerHTML = `<h2>${book}: файлы</h2><p>Загружаю…</p>`
  const { files } = await api.files(book)
  if(!files?.length){
    el.innerHTML = `<h2>${book}</h2><p>Нет файлов.</p>`
    return
  }
  const list = files.map(name => `
    <li style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
      <span>${name}</span>
      <span style="display:flex; gap:6px;">
        <a href="#/book/${encodeURIComponent(book)}/file/${encodeURIComponent(name)}">Открыть</a>
        <a href="/api/file_download?book=${encodeURIComponent(book)}&name=${encodeURIComponent(name)}" target="_blank">Скачать</a>
      </span>
    </li>`).join('')
  el.innerHTML = `
    <h2>${book}: файлы</h2>
    <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px;">${list}</ul>
  `
}
