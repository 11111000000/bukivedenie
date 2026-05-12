import { api } from '../api.js'

export async function viewBookOverview(book){
  const el = document.getElementById('view')
  el.innerHTML = `<h2>${book}</h2><p>Загружаю обзор…</p>`
  const files = await api.files(book).then(r=>r.files||[]).catch(()=>[])

  el.innerHTML = `
    <hgroup>
      <h2>${book}</h2>
      <p>Быстрые действия</p>
    </hgroup>
    <div style="display:flex; flex-wrap:wrap; gap:8px;">
      <a class="contrast" href="#/book/${encodeURIComponent(book)}/viz/tokens">Tokens</a>
      <a class="contrast" href="#/book/${encodeURIComponent(book)}/viz/wordcloud">Word Cloud</a>
      <a class="contrast" href="#/book/${encodeURIComponent(book)}/viz/network">Network</a>
      <a class="contrast" href="#/book/${encodeURIComponent(book)}/viz/sentiment">Sentiment</a>
      <a class="contrast" href="#/book/${encodeURIComponent(book)}/viz/heatmap">Heatmap</a>
      <a class="secondary" href="#/book/${encodeURIComponent(book)}/files">Files</a>
    </div>
    <details style="margin-top:12px;">
      <summary>Файлы</summary>
      <pre style="white-space:pre-wrap;">${files.map(f=>`- ${f}`).join('\n')}</pre>
    </details>
  `
}
