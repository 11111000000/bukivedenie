import { buildShell, mountShell, createChart, fetchText, parseCSV } from '/src/shared.js'

mountShell(buildShell({ title: 'Война и мир — Хронология событий', subtitle: 'События по датам (CSV)' }))
const nav = document.querySelector('.site-nav')
if (nav) nav.remove()

const appMain = document.querySelector('#app-main')
appMain.innerHTML = `<article class="panel full"><div id="chart" class="viz tall"></div></article>`

const chartEl = document.getElementById('chart')
const chart = createChart(chartEl)

const CSV_PATH = './data/war-and-peace/events_1.csv'

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
  appMain.innerHTML = `<div class="panel"><div class="muted" style="padding:12px">${msg}</div></div>`
}

async function load() {
  let rows = []
  try {
    const text = await fetchText(CSV_PATH)
    rows = parseCSV(text)
  } catch (e) {
    showNoData('Не удалось загрузить events_1.csv')
    return
  }

  const events = rows
    .map((r, idx) => {
      const id = Number(r.event_id)
      const name = String(r.event_name || '').trim()
      const parsed = parseDMY(r.date)
      const descr = String(r.character_description || '').trim()
      const chars = String(r.characters || '')
        .split(';')
        .map((v) => v.trim())
        .filter(Boolean)
      return {
        _row: idx + 2,
        event_id: Number.isFinite(id) ? id : null,
        event_name: name,
        date: parsed,
        date_label: parsed?.label || String(r.date || '').trim(),
        character_description: descr,
        characters: chars,
      }
    })
    .filter((ev) => ev.event_id != null && ev.event_name && ev.date && ev.characters.length && ev.character_description)

  if (!events.length) {
    showNoData('Нет валидных событий в CSV')
    return
  }

  const dates = Array.from(new Set(events.map((e) => e.date.label))).sort((a, b) => {
    const da = parseDMY(a)?.date?.getTime?.() ?? 0
    const db = parseDMY(b)?.date?.getTime?.() ?? 0
    return da - db
  })

  const byDate = Object.fromEntries(dates.map((d) => [d, []]))
  for (const ev of events) byDate[ev.date.label].push(ev)
  const maxStack = Math.max(1, ...dates.map((d) => byDate[d].length))

  // Flatten into draw items: (dateIndex, stackIndex)
  const items = []
  for (let di = 0; di < dates.length; di += 1) {
    const d = dates[di]
    const list = byDate[d]
    for (let si = 0; si < list.length; si += 1) {
      const ev = list[si]
      items.push({
        value: [di, si, ev.event_id],
        ev,
      })
    }
  }

  chart.setOption({
    animation: false,
    grid: { left: 28, right: 22, top: 18, bottom: 72, containLabel: true },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'slider', xAxisIndex: 0, height: 22, bottom: 18, filterMode: 'none' },
    ],
    tooltip: {
      trigger: 'item',
      confine: true,
      borderWidth: 1,
      formatter: (p) => {
        const ev = p?.data?.ev
        if (!ev) return ''
        const chars = ev.characters.join(', ')
        const descr = String(ev.character_description || '').replaceAll('\n', '<br/>')
        return `
          <div style="max-width:420px">
            <div style="font-weight:700;margin-bottom:4px">${ev.event_name}</div>
            <div style="color:#666;margin-bottom:6px">${ev.date_label}</div>
            <div style="margin-bottom:6px"><span style="color:#666">Персонажи:</span> ${chars}</div>
            <div>${descr}</div>
          </div>
        `
      },
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { rotate: 45, interval: 0, color: '#2d3a5e', fontWeight: 700 },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      inverse: true,
      min: -0.5,
      max: Math.max(0.5, maxStack - 0.5),
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'custom',
        name: 'events',
        data: items,
        encode: { x: 0, y: 1 },
        renderItem: (params, api) => {
          const di = api.value(0)
          const si = api.value(1)
          const ev = params.data.ev

          const pt = api.coord([di, si])
          const bandW = api.size([1, 0])[0]
          const bandH = api.size([0, 1])[1]

          const w = Math.max(140, Math.min(360, bandW * 0.88))
          const h = Math.max(72, Math.min(128, bandH * 0.82))
          const x = pt[0] - w / 2
          const y = pt[1] - h / 2

          const chars = ev.characters
          const circleR = 5
          const gap = 4
          const maxCircles = Math.max(0, Math.floor((w - 18) / (circleR * 2 + gap)))
          const showChars = chars.slice(0, Math.min(chars.length, maxCircles))
          const overflow = chars.length - showChars.length
          const rowY = y + h - 16
          const totalW = showChars.length ? showChars.length * (circleR * 2) + (showChars.length - 1) * gap : 0
          let cx = x + (w - totalW) / 2 + circleR

          const shapes = [
            {
              type: 'rect',
              shape: { x, y, width: w, height: h, r: 10 },
              style: { fill: '#fffdea', stroke: '#b6b6b6', lineWidth: 2 },
            },
            {
              type: 'text',
              style: {
                x: x + w / 2,
                y: y + 14,
                text: ev.event_name,
                align: 'center',
                verticalAlign: 'top',
                fill: '#282e13',
                font: '600 13px Segoe UI, Arial, sans-serif',
                overflow: 'truncate',
                width: w - 18,
              },
            },
          ]

          for (const ch of showChars) {
            shapes.push({
              type: 'circle',
              shape: { cx, cy: rowY, r: circleR },
              style: { fill: colorForName(ch), stroke: '#fff', lineWidth: 1 },
            })
            cx += circleR * 2 + gap
          }

          if (overflow > 0) {
            shapes.push({
              type: 'text',
              style: {
                x: x + w - 10,
                y: rowY,
                text: `+${overflow}`,
                align: 'right',
                verticalAlign: 'middle',
                fill: '#666',
                font: '600 11px Segoe UI, Arial, sans-serif',
              },
            })
          }

          return { type: 'group', children: shapes }
        },
      },
    ],
  })
}

window.addEventListener('resize', () => chart.resize())
load()
