import { buildShell, mountShell, createChart, fetchText, parseCSV } from '/src/shared.js'

mountShell(buildShell({ title: 'Война и мир — Персонажи', subtitle: 'Столбцы ранжируют самых частых персонажей, чтобы быстро увидеть главных действующих лиц и их вклад в текст.' }))
const nav = document.querySelector('.site-nav')
if (nav) nav.remove()

const appMain = document.querySelector('#app-main')
appMain.innerHTML = `<article class="panel"><h2>Персонажи</h2><p class="panel-desc">Столбцы ранжируют самых частых персонажей, чтобы быстро увидеть главных действующих лиц и их вклад в текст.</p><div id="chart" class="viz"></div></article>`
const chartEl = document.getElementById('chart')
const chart = createChart(chartEl)

const CANDIDATES = [
  './data/war-and-peace/characters.csv',
  './data/outputs/tolstoj_lew_nikolaewich-text_1/characters.csv',
]

function showNoData() {
  appMain.innerHTML = '<div class="panel"><div class="panel-desc">Список персонажей пока не найден в данных этой книги. Попробуйте другой источник или обновите экспорт.</div></div>'
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
  const list = rows.slice().sort((a, b) => Number(b.occurrences || b.count || 0) - Number(a.occurrences || a.count || 0)).slice(0, 20)
  const names = list.map((r) => r.name || r['name'])
  const values = list.map((r) => Number(r.occurrences || r.count || r['occurrences'] || 0))
  chart.setOption({ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 120, right: 16, top: 10, bottom: 24 }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: names, inverse: true }, series: [{ type: 'bar', data: values, itemStyle: { color: '#7a4fd7' } }] })
}

window.addEventListener('resize', () => chart.resize())
load()
