import { api } from '../api.js'
import { renderSpec } from '../viz/vegaHelper.js'

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

export function normalizeTokenRows(rows=[], limit=30){
  return rows
    .slice(0, limit)
    .map((row, index) => ({
      token: String(row?.[0] ?? '').trim() || `token-${index + 1}`,
      count: toNumber(row?.[1]),
      rank: toNumber(row?.[2]) || index + 1,
      per_1k: toNumber(row?.[3]),
    }))
    .filter(row => row.count > 0)
}

export function buildTokenMetrics(rows=[]){
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const top = rows[0] || null
  return {
    total,
    unique: rows.length,
    top,
    topShare: total && top ? top.count / total : 0,
    avgPer1k: rows.length ? rows.reduce((sum, row) => sum + row.per_1k, 0) / rows.length : 0,
  }
}

export async function viewTokens(book){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewTokens')
    return
  }
  return renderInto(el, book)
}

export async function renderInto(el, book){
  if(!el){
    console.error('view mount not found in renderInto')
    return
  }
  el.innerHTML = `<h2>${escapeHtml(book)}: Tokens</h2><p>Загружаю…</p>`
  const [files, summary] = await Promise.all([
    api.files(book).then(r => r.files || []).catch(() => []),
    api.bookSummary(book).catch(() => null),
  ])
  const name = files.includes('tokens.csv') ? 'tokens.csv' : (files.find(f => f.endsWith('_tokens.csv')) || 'tokens.csv')
  const { type, rows=[] } = await api.fileParsed(book, name).catch(() => ({ type: 'csv', rows: [] }))
  if(type !== 'csv' || !rows.length){
    el.innerHTML = `<h2>${escapeHtml(book)}: Tokens</h2><p>Нет данных</p>`
    return
  }
  const data = normalizeTokenRows(rows, 28)
  const metrics = buildTokenMetrics(data)
  const chapters = summary?.summary?.chapters_total ?? summary?.summary?.chapters ?? '—'
  const words = summary?.summary?.words ?? '—'
  const sampledRows = data.slice(0, 8)
  el.innerHTML = `
    <section style="display:grid; gap:16px;">
      <header style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:16px;">
        <div style="max-width:64ch;">
          <p style="margin:0; text-transform:uppercase; letter-spacing:.12em; font-size:.78rem; opacity:.7;">Token landscape</p>
          <h2 style="margin:.15rem 0 .4rem;">${escapeHtml(book)}</h2>
          <p style="margin:0; opacity:.82;">Ranked token frequency chart from <code>${escapeHtml(name)}</code> with compact book-level context.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <span class="secondary" style="display:inline-flex; align-items:center; gap:8px; padding:.45rem .7rem;">Rows <strong>${data.length}</strong></span>
          <span class="secondary" style="display:inline-flex; align-items:center; gap:8px; padding:.45rem .7rem;">Total <strong>${metrics.total.toLocaleString()}</strong></span>
          <span class="secondary" style="display:inline-flex; align-items:center; gap:8px; padding:.45rem .7rem;">Top share <strong>${(metrics.topShare * 100).toFixed(1)}%</strong></span>
        </div>
      </header>
      <section style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px;">
        <article style="border:1px solid var(--pico-muted-border-color); border-radius:14px; padding:12px 14px; background:var(--pico-card-background-color);">
          <div style="font-size:.8rem; opacity:.72;">Top token</div>
          <div style="font-size:1.15rem; font-weight:700; margin-top:4px;">${escapeHtml(metrics.top?.token ?? '—')}</div>
          <div style="opacity:.72;">${metrics.top ? `${metrics.top.count.toLocaleString()} mentions` : 'No data'}</div>
        </article>
        <article style="border:1px solid var(--pico-muted-border-color); border-radius:14px; padding:12px 14px; background:var(--pico-card-background-color);">
          <div style="font-size:.8rem; opacity:.72;">Unique rows</div>
          <div style="font-size:1.15rem; font-weight:700; margin-top:4px;">${metrics.unique.toLocaleString()}</div>
          <div style="opacity:.72;">Top ${data.length} tokens sampled</div>
        </article>
        <article style="border:1px solid var(--pico-muted-border-color); border-radius:14px; padding:12px 14px; background:var(--pico-card-background-color);">
          <div style="font-size:.8rem; opacity:.72;">Book summary</div>
          <div style="font-size:1.15rem; font-weight:700; margin-top:4px;">${chapters}</div>
          <div style="opacity:.72;">${words.toLocaleString?.() ?? words} words across the book</div>
        </article>
        <article style="border:1px solid var(--pico-muted-border-color); border-radius:14px; padding:12px 14px; background:var(--pico-card-background-color);">
          <div style="font-size:.8rem; opacity:.72;">Mean density</div>
          <div style="font-size:1.15rem; font-weight:700; margin-top:4px;">${metrics.avgPer1k.toFixed(2)}</div>
          <div style="opacity:.72;">Average per 1k tokens</div>
        </article>
      </section>
      <section style="display:grid; grid-template-columns:minmax(0, 1.6fr) minmax(280px, .85fr); gap:16px; align-items:start;">
        <div style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:10px; background:var(--pico-card-background-color);">
          <div id="chart" style="min-height:560px;"></div>
        </div>
        <aside style="display:grid; gap:12px;">
          <section style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:14px; background:var(--pico-card-background-color);">
            <h3 style="margin-top:0; margin-bottom:8px; font-size:1rem;">Top rows</h3>
            <div style="display:grid; gap:10px;">
              ${sampledRows.map(row => `
                <div>
                  <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:4px;">
                    <strong>${escapeHtml(row.token)}</strong>
                    <span>${row.count.toLocaleString()}</span>
                  </div>
                  <div style="height:8px; border-radius:999px; background:color-mix(in srgb, var(--pico-muted-border-color) 80%, transparent); overflow:hidden;">
                    <div style="width:${metrics.total ? Math.max(6, (row.count / metrics.total) * 100) : 0}%; height:100%; border-radius:inherit; background:linear-gradient(90deg, #7c3aed, #06b6d4);"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
          <section style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:14px; background:var(--pico-card-background-color);">
            <h3 style="margin-top:0; margin-bottom:8px; font-size:1rem;">What this shows</h3>
            <p style="margin:0; opacity:.82;">The chart ranks the most frequent tokens so repeated motifs and dominant vocabulary become visible immediately.</p>
          </section>
        </aside>
      </section>
    </section>
  `
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Top tokens',
    data: { values: data },
    mark: { type: 'bar', cornerRadiusEnd: 4 },
    encoding: {
      y: {
        field: 'token',
        type: 'nominal',
        sort: '-x',
        axis: { title: null, labelLimit: 180, labelFontSize: 12 },
      },
      x: {
        field: 'count',
        type: 'quantitative',
        axis: { title: 'Occurrences', grid: true, labelFontSize: 12 },
      },
      color: {
        field: 'count',
        type: 'quantitative',
        legend: null,
        scale: { scheme: 'tealblues' },
      },
      tooltip: [
        { field: 'token', type: 'nominal' },
        { field: 'count', type: 'quantitative' },
        { field: 'rank', type: 'quantitative' },
        { field: 'per_1k', type: 'quantitative', title: 'Per 1k' },
      ],
    },
    width: 'container',
    height: { step: 24 },
    config: {
      background: 'transparent',
      view: { stroke: 'transparent' },
      axis: {
        labelColor: '#475569',
        titleColor: '#64748b',
        domainColor: '#cbd5e1',
        gridColor: '#e2e8f0',
      },
    },
  }
  await renderSpec(document.getElementById('chart'), spec)
}
