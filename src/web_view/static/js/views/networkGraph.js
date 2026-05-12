import { api } from '../api.js'

export async function viewNetwork(book){
  const el = document.getElementById('view')
  el.innerHTML = `<h2>${book}: Character Network</h2><p>Загружаю…</p>`
  const files = await api.files(book).then(r=>r.files||[])
  const name = 'cooccurrence_edges.csv'
  if(!files.includes(name)){
    el.innerHTML = `<h2>${book}: Character Network</h2><p>Нет данных</p>`
    return
  }
  const { type, rows=[] } = await api.fileParsed(book, name)
  if(type !== 'csv' || !rows.length){
    el.innerHTML = `<h2>${book}: Character Network</h2><p>Нет данных</p>`
    return
  }
  const nodesMap = new Map()
  const edges = []
  for(const r of rows){
    const s = r[0], t = r[2], w = +r[4] || 1
    if(!nodesMap.has(s)) nodesMap.set(s, { id: s, label: s })
    if(!nodesMap.has(t)) nodesMap.set(t, { id: t, label: t })
    edges.push({ from: s, to: t, value: w })
  }
  el.innerHTML = `<div id="net" style="width:100%; min-height:480px;"></div>`
  const container = document.getElementById('net')
  if(window.vis && window.vis.Network){
    const data = { nodes: new window.vis.DataSet(Array.from(nodesMap.values())), edges: new window.vis.DataSet(edges) }
    const options = { physics: { stabilization: true }, edges: { smooth: true }, interaction: { hover: true } }
    new window.vis.Network(container, data, options)
  } else {
    try{
      const vis = await import('https://cdn.jsdelivr.net/npm/vis-network@9/standalone/umd/vis-network.min.js')
      const data = { nodes: new vis.DataSet(Array.from(nodesMap.values())), edges: new vis.DataSet(edges) }
      const options = { physics: { stabilization: true }, edges: { smooth: true }, interaction: { hover: true } }
      new vis.Network(container, data, options)
    }catch(e){
      container.innerHTML = '<p>vis-network не найден</p>'
    }
  }
}
