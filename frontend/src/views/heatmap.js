import { api } from '../api.js'
import { renderSpec } from '../viz/vegaHelper.js'

export async function viewHeatmap(book){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewHeatmap')
    return
  }
  el.innerHTML = `<h2>${book}: Heatmap (top tokens × главы)</h2><p>Загружаю…</p>`
  const { files } = await api.files(book)
  const summary = await api.bookSummary(book).catch(() => null)
  const chapters = Array.isArray(summary?.fragments) ? summary.fragments : []
  const chapterTitleByIdx = new Map(chapters.map(ch => [Number(ch.chapter_idx), ch.title || String(ch.chapter_idx)]))

  const matrix = []
  const precomputed = files.includes('token_freq_by_chapter.csv') ? 'token_freq_by_chapter.csv' : null
  if(precomputed){
    const { type, rows=[] } = await api.fileParsed(book, precomputed)
    if(type === 'csv' && rows.length){
      const totalByToken = new Map()
      for(const row of rows){
        const token = String(row?.[0] ?? '').trim()
        const chapterIdx = Number(row?.[2])
        const count = Number(row?.[3]) || 0
        if(!token || !Number.isFinite(chapterIdx) || count <= 0) continue
        const chapter = chapterTitleByIdx.get(chapterIdx) || `chapter_${chapterIdx}`
        matrix.push({ token, chapter, count })
        totalByToken.set(token, (totalByToken.get(token) || 0) + count)
      }
      matrix.sort((a, b) => (totalByToken.get(b.token) || 0) - (totalByToken.get(a.token) || 0))
    }
  }else{
    const name = files.includes('tokens.csv') ? 'tokens.csv' : (files.find(f=>f.endsWith('_tokens.csv')) || 'tokens.csv')
    const { type, rows=[] } = await api.fileParsed(book, name)
    if(type !== 'csv' || !rows.length){
      el.innerHTML = `<h2>${book}: Heatmap</h2><p>Нет данных tokens.csv</p>`
      return
    }
    const topN = 15
    const tokens = rows.slice(0, topN).map(r=>r[0])
    el.innerHTML = `<h2>${book}: Heatmap</h2><p>Собираю распределения по главам для ${tokens.length} токенов…</p><div id="hm"></div>`
    const fallbackTokens = summary?.text_index || []
    if(!tokens.length && fallbackTokens.length){
      tokens.push(...fallbackTokens.slice(0, topN).map(r => r?.token || r?.[0]).filter(Boolean))
    }
    for(const t of tokens){
      try{
        const r = await api.tokenByChapter(book, t)
        const counts = r.counts || []
        for(const c of counts){
          matrix.push({ token: t, chapter: c.title || String(c.chapter_idx), count: +c.count })
        }
      }catch(e){
        if(!String(e?.message || e).includes('404')){
          console.warn('tokenByChapter fail', t, e)
        }
      }
    }
  }
  if(!matrix.length){
    document.getElementById('hm').innerHTML = '<p>Нет данных для теплокарты</p>'
    return
  }
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Token × Chapter heatmap',
    data: { values: matrix },
    mark: 'rect',
    encoding: {
      x: { field: 'chapter', type: 'ordinal', sort: 'ascending' },
      y: { field: 'token', type: 'nominal', sort: 'descending' },
      color: { field: 'count', type: 'quantitative' },
      tooltip: [ {field:'token'},{field:'chapter'},{field:'count','type':'quantitative'} ]
    },
    width: 'container',
    height: { step: 18 }
  }
  await renderSpec(document.getElementById('hm'), spec)
}
