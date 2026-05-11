import { api } from '../api.js'
import { renderSpec } from '../viz/vegaHelper.js'

export async function viewTokens(book){
  const el = document.getElementById('view')
  el.innerHTML = `<h2>${book}: Tokens</h2><p>Загружаю…</p>`
  const files = await api.files(book).then(r=>r.files||[])
  const name = files.includes('tokens.csv') ? 'tokens.csv' : (files.find(f=>f.endsWith('_tokens.csv')) || 'tokens.csv')
  const { type, headers=[], rows=[] } = await api.fileParsed(book, name)
  if(type !== 'csv' || !rows.length){
    el.innerHTML = `<h2>${book}: Tokens</h2><p>Нет данных</p>`
    return
  }
  // rows: [token, count, rank, per_1k]
  const data = rows.slice(0, 50).map(r => ({ token: r[0], count: +r[1] }))
  el.innerHTML = `<h2>${book}: Top tokens</h2><div id="chart" style="min-height:360px;"></div>`
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Top tokens',
    data: { values: data },
    mark: 'bar',
    encoding: {
      x: { field: 'count', type: 'quantitative' },
      y: { field: 'token', type: 'nominal', sort: '-x' },
      tooltip: [ {field:'token', type:'nominal'}, {field:'count', type:'quantitative'} ],
    },
    width: 'container',
    height: { step: 18 }
  }
  await renderSpec(document.getElementById('chart'), spec)
}
