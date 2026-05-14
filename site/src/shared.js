import * as echarts from 'echarts'
import 'echarts-wordcloud'

export const APP_BRAND = 'Bukivedenie'

  export const NAV_ITEMS = [
    { href: './index.html', label: 'Лингвистика' },
    { href: './preza.html?v=20260514', label: 'Презентация' },
    { href: './war-and-peace.html', label: 'Война и мир' },
    { href: './war-and-peace-movements.html', label: 'Перемещения' },
  ]

export function createStateMessage(message, kind = 'empty') {
  const cls = kind === 'error' ? 'state is-error' : 'state is-empty'
  return `<div class="${cls}">${message}</div>`
}

export function buildShell({ title, subtitle, controls = '', aside = '' }) {
  return `
    <div class="site-shell">
      <header class="site-header">
        <div class="brand-row">
          <div>
            <div class="eyebrow">${APP_BRAND}</div>
            <h1>${title}</h1>
            <p class="page-note">${subtitle}</p>
          </div>
          <div class="header-aside">${aside}</div>
        </div>
        <nav class="site-nav" aria-label="Основная навигация">
          ${NAV_ITEMS.map((item) => `<a class="nav-link" href="${item.href}">${item.label}</a>`).join('')}
        </nav>
        ${controls ? `<div class="site-controls">${controls}</div>` : ''}
      </header>
      <main class="site-main">
        <div id="app-main"></div>
      </main>
    </div>
  `
}

export function mountShell(content) {
  const app = document.querySelector('#app')
  app.innerHTML = content
  return document.querySelector('#app-main')
}

export function parseCSV(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\n') {
      row.push(cell)
      if (row.some((value) => String(value).trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (char !== '\r') cell += char
  }

  if (cell.length || row.length) {
    row.push(cell)
    if (row.some((value) => String(value).trim() !== '')) rows.push(row)
  }

  if (!rows.length) return []
  const headers = rows.shift().map((value) => String(value).trim())
  return rows.map((values) => Object.fromEntries(headers.map((header, idx) => [header, values[idx] ?? ''])))
}

export async function fetchText(path) {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Не удалось загрузить ${path}: ${response.status}`)
  return response.text()
}

export async function fetchJSON(path) {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Не удалось загрузить ${path}: ${response.status}`)
  const text = await response.text()
  return JSON.parse(text)
}

export function normalizeRows(value) {
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.chapters)) return value.chapters
  if (value && Array.isArray(value.rows)) return value.rows
  if (value && Array.isArray(value.fragments)) return value.fragments
  if (value && Array.isArray(value.punctuation_timeline)) return value.punctuation_timeline
  if (value && Array.isArray(value.token_by_chapter)) return value.token_by_chapter
  if (value && Array.isArray(value.cooccurrence_edges)) return value.cooccurrence_edges
  if (value && Array.isArray(value.sentiment_by_chapter)) return value.sentiment_by_chapter
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

export function createChart(el) {
  return echarts.init(el)
}
