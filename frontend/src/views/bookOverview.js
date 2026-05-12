import { api } from '../api.js'

export async function viewBookOverview(book){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewBookOverview')
    return
  }
  el.innerHTML = `<h2>${book}</h2><p>Загружаю обзор…</p>`
  // Пытаемся взять базовые файлы
  const files = await api.files(book).then(r=>r.files||[]).catch(()=>[])
  const summary = await api.bookSummary(book).catch(()=>null)

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
    ${summary?.ready !== undefined ? `
      <section style="margin-top:12px;">
        <h3>Summary</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
          <div><strong>Ready</strong><div>${summary.ready ? 'yes' : 'no'}</div></div>
          <div><strong>Chapters</strong><div>${summary.summary?.chapters_total ?? summary.summary?.chapters ?? '—'}</div></div>
          <div><strong>Fragments</strong><div>${summary.fragments?.length ?? '—'}</div></div>
          <div><strong>Tokens</strong><div>${summary.text_index?.length ?? '—'}</div></div>
        </div>
      </section>
    ` : ''}
    <details style="margin-top:12px;">
      <summary>Файлы</summary>
      <pre style="white-space:pre-wrap;">${files.map(f=>`- ${f}`).join('\n')}</pre>
    </details>
  `
}
