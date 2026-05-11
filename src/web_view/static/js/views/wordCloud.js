import { api } from '../api.js'

export async function viewWordCloud(book){
  const el = document.getElementById('view')
  el.innerHTML = `<h2>${book}: Word Cloud</h2><p>Загружаю…</p>`
  const files = await api.files(book).then(r=>r.files||[])
  const name = files.includes('tokens.csv') ? 'tokens.csv' : (files.find(f=>f.endsWith('_tokens.csv')) || 'tokens.csv')
  const { type, rows=[] } = await api.fileParsed(book, name)
  if(type !== 'csv' || !rows.length){
    el.innerHTML = `<h2>${book}: Word Cloud</h2><p>Нет данных</p>`
    return
  }
  const words = rows.slice(0, 200).map(r => [r[0], Math.max(12, Math.min(80, +r[1]))])
  el.innerHTML = `<div id="cloud" style="width:100%; min-height:420px;"></div>`
  const target = document.getElementById('cloud')
  if(window.WordCloud){
    window.WordCloud(target, { list: words, backgroundColor: '#fff' })
  } else {
    // попробовать модульный импорт как fallback
    try{
      const { default: WordCloud } = await import('https://cdn.jsdelivr.net/npm/wordcloud/+esm')
      WordCloud(target, { list: words, backgroundColor: '#fff' })
    }catch(e){
      el.innerHTML = '<p>WordCloud библиотека не найдена</p>'
    }
  }
}
