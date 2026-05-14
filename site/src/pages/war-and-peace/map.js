import { buildShell, mountShell, createChart, fetchText, parseCSV } from '/src/shared.js'

mountShell(buildShell({ title: 'Война и мир — Сеть персонажей', subtitle: 'Сеть показывает, кто с кем чаще связан в тексте. Узлы крупнее у более заметных персонажей, а линии помогают увидеть силу пересечений и группировки.' }))
const nav = document.querySelector('.site-nav')
if (nav) nav.remove()

const appMain = document.querySelector('#app-main')
appMain.innerHTML = `<article class="panel full"><h2>Сеть персонажей</h2><p class="panel-desc">Сеть показывает, кто с кем чаще связан в тексте. Узлы крупнее у более заметных персонажей, а линии помогают увидеть силу пересечений и группировки.</p><div id="chart" class="viz tall"></div></article>`
const chartEl = document.getElementById('chart')
const chart = createChart(chartEl)

const CANDIDATES = [
  './data/war-and-peace/cooccurrence_edges.csv',
  './data/outputs/tolstoj_lew_nikolaewich-text_1/cooccurrence_edges.csv',
]

function showNoData() {
  appMain.innerHTML = '<div class="panel"><div class="panel-desc">Данные для сети персонажей не найдены в выбранном наборе. Попробуйте другой экспорт.</div></div>'
}

async function load() {
  let rows = []
  for (const p of CANDIDATES) {
    try {
      const text = await fetchText(p)
      rows = parseCSV(text)
      if (rows && rows.length) break
    } catch (_) {}
  }
  if (!rows || !rows.length) {
    showNoData()
    return
  }
  // rows expected: source,target,weight
  const edges = rows.slice(0, 200).map((r) => ({ source: r.source || r.source_lower || r['source'], target: r.target || r.target_lower || r['target'], value: Number(r.weight || r.value || r['weight'] || 1) }))
  const nodeMap = new Map()
  for (const e of edges) {
    if (!e.source || !e.target) continue
    nodeMap.set(e.source, (nodeMap.get(e.source) || 0) + e.value)
    nodeMap.set(e.target, (nodeMap.get(e.target) || 0) + e.value)
  }
  const nodes = Array.from(nodeMap.entries()).slice(0, 60).map(([name, val]) => ({ name, value: Math.max(1, Math.round(val)), symbolSize: Math.max(8, Math.min(36, Math.log10(val + 1) * 12)), itemStyle: { color: '#3558a6' } }))
  const nodeNames = new Set(nodes.map((n) => n.name))
  const links = edges.filter((e) => nodeNames.has(e.source) && nodeNames.has(e.target)).map((e) => ({ source: e.source, target: e.target, value: e.value, lineStyle: { width: Math.max(1, Math.min(6, e.value / 2)) } }))

  chart.setOption({
    tooltip: {},
    series: [{ type: 'graph', layout: 'force', roam: true, data: nodes, links, force: { repulsion: 120, edgeLength: 80 }, label: { show: true, position: 'right' }, emphasis: { focus: 'adjacency' } }],
  })
}

window.addEventListener('resize', () => chart.resize())
load()
