import { api } from '../api.js'
import * as echarts from 'echarts'

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]))
}

function toNumber(value){
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function hashString(value){
  let hash = 0
  for(const ch of String(value || '')){
    hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  }
  return Math.abs(hash)
}

function seededRandom(seedText){
  let state = hashString(seedText) || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function normalizeWordCloudRows(rows=[], limit=220){
  return rows
    .slice(0, limit)
    .map((row, index) => ({
      name: String(row?.[0] ?? '').trim() || `word-${index + 1}`,
      value: Math.max(1, toNumber(row?.[1])),
    }))
    .filter(row => row.name && row.value > 0)
}

function buildWordMetrics(words=[]){
  const total = words.reduce((sum, row) => sum + row.value, 0)
  const top = words[0] || null
  return { total, unique: words.length, top }
}

export async function viewWordCloud(book){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewWordCloud')
    return
  }
  return renderInto(el, book)
}

export async function renderInto(el, book){
  if(!el){
    console.error('view mount not found in renderInto')
    return
  }
  el.innerHTML = `<h2>${escapeHtml(book)}: Word Cloud</h2><p>Загружаю…</p>`
  const files = await api.files(book).then(r=>r.files||[]).catch(() => [])
  const name = files.includes('tokens.csv') ? 'tokens.csv' : (files.find(f=>f.endsWith('_tokens.csv')) || 'tokens.csv')
  const { type, rows=[] } = await api.fileParsed(book, name).catch(() => ({ type: 'csv', rows: [] }))
  if(type !== 'csv' || !rows.length){
    el.innerHTML = `<h2>${escapeHtml(book)}: Word Cloud</h2><p>Нет данных</p>`
    return
  }
  const words = normalizeWordCloudRows(rows)
  const metrics = buildWordMetrics(words)
  const topWords = words.slice(0, 8)
  el.innerHTML = `
    <section style="display:grid; gap:16px;">
      <header style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:16px;">
        <div style="max-width:64ch;">
          <p style="margin:0; text-transform:uppercase; letter-spacing:.12em; font-size:.78rem; opacity:.7;">Word cloud</p>
          <h2 style="margin:.15rem 0 .4rem;">${escapeHtml(book)}</h2>
          <p style="margin:0; opacity:.82;">High-frequency tokens sized by occurrence count, optimized for quick reading.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <span class="secondary" style="display:inline-flex; align-items:center; gap:8px; padding:.45rem .7rem;">Words <strong>${metrics.unique.toLocaleString()}</strong></span>
          <span class="secondary" style="display:inline-flex; align-items:center; gap:8px; padding:.45rem .7rem;">Total <strong>${metrics.total.toLocaleString()}</strong></span>
          <span class="secondary" style="display:inline-flex; align-items:center; gap:8px; padding:.45rem .7rem;">Top <strong>${escapeHtml(metrics.top?.name ?? '—')}</strong></span>
        </div>
      </header>
      <section style="display:grid; grid-template-columns:minmax(0, 1.6fr) minmax(280px, .85fr); gap:16px; align-items:start;">
        <div style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:10px; background:var(--pico-card-background-color); min-height:640px;">
          <div id="cloud" style="width:100%; min-height:620px;"></div>
        </div>
        <aside style="display:grid; gap:12px;">
          <section style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:14px; background:var(--pico-card-background-color);">
            <h3 style="margin-top:0; margin-bottom:8px; font-size:1rem;">Most frequent</h3>
            <div style="display:grid; gap:10px;">
              ${topWords.map(row => `
                <div>
                  <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:4px;">
                    <strong>${escapeHtml(row.name)}</strong>
                    <span>${row.value.toLocaleString()}</span>
                  </div>
                  <div style="height:8px; border-radius:999px; background:color-mix(in srgb, var(--pico-muted-border-color) 80%, transparent); overflow:hidden;">
                    <div style="width:${metrics.total ? Math.max(6, (row.value / metrics.total) * 100) : 0}%; height:100%; border-radius:inherit; background:linear-gradient(90deg, #8b5cf6, #14b8a6);"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
          <section style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:14px; background:var(--pico-card-background-color);">
            <h3 style="margin-top:0; margin-bottom:8px; font-size:1rem;">Reading guide</h3>
            <p style="margin:0; opacity:.82;">Larger words dominate the text index. Compact labels on the right help you identify the same signal numerically.</p>
          </section>
        </aside>
      </section>
    </section>
  `
  try{
    if(window.__SMOKE__){
      const container = document.getElementById('cloud')
      if(container){
        const palette = ['#2563eb', '#7c3aed', '#0f766e', '#d97706', '#db2777']
        container.style.display = 'flex'
        container.style.flexWrap = 'wrap'
        container.style.alignItems = 'center'
        container.style.gap = '12px'
        container.style.padding = '18px'
        container.innerHTML = words.slice(0, 60).map((word, idx) => {
          const size = 14 + Math.min(48, Math.round(Math.sqrt(word.value) * 10))
          const color = palette[idx % palette.length]
          return `<span style="font-size:${size}px; font-weight:700; color:${color}; line-height:1;">${escapeHtml(word.name)}</span>`
        }).join('')
      }
      return
    }
    await import('echarts-wordcloud')
    const container = document.getElementById('cloud')
    if(!container){
      console.error('cloud container missing')
      el.innerHTML = '<p>WordCloud container missing</p>'
      return
    }
    const existing = echarts.getInstanceByDom(container)
    if(existing){
      existing.dispose()
    }
    const chart = echarts.init(container, null, { renderer: 'canvas' })
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: params => `${escapeHtml(params.name)}: ${Number(params.value).toLocaleString()}`,
      },
      series: [{
        type: 'wordCloud',
        shape: 'circle',
        left: 'center',
        top: 'center',
        width: '92%',
        height: '92%',
        gridSize: 8,
        drawOutOfBound: false,
        rotationRange: [-25, 25],
        rotationStep: 25,
        sizeRange: [14, 72],
        textStyle: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 700,
          color: params => {
            const palette = ['#2563eb', '#7c3aed', '#0f766e', '#d97706', '#db2777']
            const idx = hashString(params?.name || '') % palette.length
            return palette[idx]
          },
        },
        emphasis: {
          focus: 'self',
          textStyle: {
            shadowBlur: 12,
            shadowColor: 'rgba(15, 23, 42, 0.25)',
          },
        },
        data: words.map(word => ({
          name: word.name,
          value: word.value,
        })),
      }],
    }, true)
    if('ResizeObserver' in window){
      const observer = new ResizeObserver(() => chart.resize())
      observer.observe(container)
    }
  }catch(e){
    console.error('WordCloud render failed', e)
    const cloudEl = document.getElementById('cloud')
    const msg = `<p>WordCloud render failed: ${e?.message || e}</p>`
    if(cloudEl) cloudEl.innerHTML = msg
    else el.innerHTML = msg
  }
}
