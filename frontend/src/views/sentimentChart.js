import { api } from '../api.js'
import { renderSpec } from '../viz/vegaHelper.js'

export async function viewSentiment(book){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewSentiment')
    return
  }
  el.innerHTML = `<h2>${book}: Sentiment</h2><p>Загружаю…</p>`
  const files = await api.files(book).then(r=>r.files||[])
  const name = 'sentiment_by_chapter.csv'
  if(!files.includes(name)){
    el.innerHTML = `<h2>${book}: Sentiment</h2><p>Нет данных</p>`
    return
  }
  const { type, headers=[], rows=[] } = await api.fileParsed(book, name)
  if(type !== 'csv' || !rows.length){
    el.innerHTML = `<h2>${book}: Sentiment</h2><p>Нет данных</p>`
    return
  }
  // guess columns
  const idxTitle = headers.findIndex(h=>h.toLowerCase().includes('title'))
  const idxAvg = headers.findIndex(h=>h.toLowerCase().includes('avg'))
  const data = rows.map(r => ({ chapter: (idxTitle>=0? r[idxTitle] : ''+r[0]), score: +r[idxAvg>=0?idxAvg:2] }))
  el.innerHTML = `<div id="sent" style="min-height:320px;"></div>`
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Sentiment by chapter',
    data: { values: data },
    mark: 'line',
    encoding: {
      x: { field: 'chapter', type: 'ordinal' },
      y: { field: 'score', type: 'quantitative' },
      tooltip: [ {field:'chapter', type:'ordinal'}, {field:'score', type:'quantitative'} ],
    },
    width: 'container',
    height: 300
  }
  await renderSpec(document.getElementById('sent'), spec)
}
