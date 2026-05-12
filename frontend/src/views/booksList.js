import { api } from '../api.js'

export async function viewBooks(){
  const mount = document.getElementById('view')
  if(!mount){
    console.error('view mount not found in viewBooks')
    return
  }
  mount.innerHTML = '<p>Загружаю список книг…</p>'
  const { books } = await api.books()
  const visibleBooks = (books || []).filter(b => !['processed', 'tables', '__pycache__'].includes(b))
  if(!visibleBooks?.length){
    mount.innerHTML = '<p>Книги не найдены. Добавьте raw-файлы и запустите анализ.</p>'
    return
  }
  const items = visibleBooks.map(b => `
    <li style="display:flex; gap:8px; align-items:center; justify-content:space-between;">
      <div>
        <a href="#/book/${encodeURIComponent(b)}" style="font-weight:600;">${b}</a>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <a href="#/book/${encodeURIComponent(b)}/viz/tokens">Tokens</a>
        <a href="#/book/${encodeURIComponent(b)}/viz/wordcloud">Cloud</a>
        <a href="#/book/${encodeURIComponent(b)}/viz/network">Network</a>
        <a href="#/book/${encodeURIComponent(b)}/viz/sentiment">Sentiment</a>
        <a href="#/book/${encodeURIComponent(b)}/files">Files</a>
      </div>
    </li>
  `).join('')
  mount.innerHTML = `
    <hgroup>
      <h2>Книги</h2>
      <p>Найдены результаты анализа</p>
    </hgroup>
    <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px;">${items}</ul>
  `
}
