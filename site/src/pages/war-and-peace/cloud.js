import { buildShell, mountShell, createChart, fetchText, parseCSV } from '/src/shared.js'

mountShell(buildShell({ title: 'Война и мир — Word Cloud', subtitle: 'Token frequency cloud' }))
const nav = document.querySelector('.site-nav')
if (nav) nav.remove()

const appMain = document.querySelector('#app-main')
appMain.innerHTML = `<article class="panel full"><div id="chart" class="viz tall"></div></article>`
const chartEl = document.getElementById('chart')
const chart = createChart(chartEl)

const CANDIDATES = [
  './data/war-and-peace/tokens.csv',
  './data/outputs/tolstoj_lew_nikolaewich-text_1/tokens.csv',
]

function showNoData() {
  appMain.innerHTML = '<div class="panel"><div class="muted" style="padding:12px">Нет данных</div></div>'
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
  const data = rows.slice(0, 120).map((r) => ({ name: r.token || r.word || r['token'], value: Number(r.count || r.frequency || r['count'] || 0) })).filter((x) => x.name && x.value > 0)
  chart.setOption({ tooltip: {}, series: [{ type: 'wordCloud', shape: 'circle', gridSize: 8, sizeRange: [12, 72], rotationRange: [-45, 45], textStyle: { color: () => `hsl(${Math.floor(Math.random() * 360)}, 50%, 38%)` }, data }] })
}

window.addEventListener('resize', () => chart.resize())
load()
