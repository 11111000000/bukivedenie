import { api } from '../api.js'

export async function viewWordCloud(book){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewWordCloud')
    return
  }
  el.innerHTML = `<h2>${book}: Word Cloud</h2><p>Загружаю…</p>`
  const files = await api.files(book).then(r=>r.files||[])
  const name = files.includes('tokens.csv') ? 'tokens.csv' : (files.find(f=>f.endsWith('_tokens.csv')) || 'tokens.csv')
  const { type, rows=[] } = await api.fileParsed(book, name)
  if(type !== 'csv' || !rows.length){
    el.innerHTML = `<h2>${book}: Word Cloud</h2><p>Нет данных</p>`
    return
  }
  const words = rows.slice(0,200).map(r => [r[0], Math.max(12, Math.min(80, +r[1]))])
  el.innerHTML = `<div id="cloud" style="width:100%; min-height:420px;"></div>`
  // lazy import wordcloud2 via dynamic import if bundled, else expect global WordCloud via CDN
  try{
    const { default: WordCloud } = await import('wordcloud')
    WordCloud(document.getElementById('cloud'), { list: words, backgroundColor: '#fff' })
  }catch(e){
    if(window.WordCloud){
      window.WordCloud(document.getElementById('cloud'), { list: words, backgroundColor: '#fff' })
    }else{
      el.innerHTML = `<p>WordCloud библиотека не найдена</p>`
    }
  }
}
