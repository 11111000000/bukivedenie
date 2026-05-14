import { buildShell, mountShell, createChart, fetchText, fetchJSON, parseCSV } from '/src/shared.js'

mountShell(buildShell({ title: 'Война и мир — Хронология событий', subtitle: 'Линия показывает, как меняется тональность и объём текста по главам, чтобы видеть ритм повествования и повороты сюжета.' }))
const nav = document.querySelector('.site-nav')
if (nav) nav.remove()

const appMain = document.querySelector('#app-main')
appMain.innerHTML = `<article class="panel full"><h2>Хронология</h2><p class="panel-desc">Линия показывает, как меняется тональность и объём текста по главам, чтобы видеть ритм повествования и повороты сюжета.</p><div id="chart" class="viz tall"></div></article>`

const chartEl = document.getElementById('chart')
const chart = createChart(chartEl)

const SENT_CAND = [
  './data/war-and-peace/sentiment_by_chapter.csv',
  './data/outputs/tolstoj_lew_nikolaewich-text_1/sentiment_by_chapter.csv',
]
const CHAP_CAND = [
  './data/war-and-peace/chapters_summary.json',
  './data/outputs/tolstoj_lew_nikolaewich-text_1/chapters_summary.json',
]

function parseDMY(value) {
  const s = String(value || '').trim()
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  const d = new Date(yyyy, mm - 1, dd)
  if (!Number.isFinite(d.getTime())) return null
  return { dd, mm, yyyy, date: d, label: s }
}

function colorForName(name) {
  // deterministic HSL from a string (stable across reloads)
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue}, 55%, 42%)`
}

function showNoData(msg = 'Нет данных') {
  appMain.innerHTML = `<div class="panel"><div class="panel-desc">${msg}</div></div>`
}

async function load() {
  for (const p of SENT_CAND) {
    try {
      const text = await fetchText(p)
      const rows = parseCSV(text)
      if (rows && rows.length) {
        const labels = rows.map((r) => `Г${r.chapter_idx ?? r.chapter ?? ''}`)
        const values = rows.map((r) => Number(r.avg_score || r.total_score || 0))
        chart.setOption({ tooltip: { trigger: 'axis' }, grid: { left: 50, right: 16, top: 18, bottom: 24 }, xAxis: { type: 'category', data: labels }, yAxis: { type: 'value' }, series: [{ type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.12 }, lineStyle: { width: 3, color: '#7a4fd7' }, itemStyle: { color: '#7a4fd7' } }] })
        return
      }
    } catch (_) {}
  }

  for (const p of CHAP_CAND) {
    try {
      const json = await fetchJSON(p)
      const chapters = Array.isArray(json.chapters) ? json.chapters : (Array.isArray(json) ? json : [])
      if (chapters && chapters.length) {
        const labels = chapters.map((c) => `Г${c.chapter_idx ?? ''}`)
        const values = chapters.map((c) => Number(c.total_words || c.words || 0))
        chart.setOption({ tooltip: { trigger: 'axis' }, grid: { left: 50, right: 16, top: 18, bottom: 24 }, xAxis: { type: 'category', data: labels }, yAxis: { type: 'value' }, series: [{ type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.08 }, lineStyle: { width: 2, color: '#0c8f6a' }, itemStyle: { color: '#0c8f6a' } }] })
        return
      }
    } catch (_) {}
  }

  showNoData()
}

window.addEventListener('resize', () => chart.resize())
load()
