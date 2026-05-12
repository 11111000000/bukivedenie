import { DataSet } from 'vis-data'
import { Network } from 'vis-network'
import { api } from '../api.js'

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

export function normalizeNetworkRows(rows=[]){
  const edges = new Map()
  for(const row of rows){
    const source = String(row?.[0] ?? '').trim()
    const target = String(row?.[2] ?? '').trim()
    if(!source || !target){
      continue
    }
    const weight = Math.max(1, toNumber(row?.[4]))
    const [left, right] = [source, target].sort((a, b) => a.localeCompare(b))
    const key = `${left}\u0000${right}`
    const current = edges.get(key) || { from: left, to: right, weight: 0 }
    current.weight += weight
    edges.set(key, current)
  }
  return Array.from(edges.values())
}

export function buildNetworkStats(edges=[]){
  const nodes = new Map()
  let strongest = null
  let totalWeight = 0
  for(const edge of edges){
    totalWeight += edge.weight
    if(!strongest || edge.weight > strongest.weight){
      strongest = edge
    }
    for(const name of [edge.from, edge.to]){
      const current = nodes.get(name) || { id: name, label: name, value: 0, title: name }
      current.value += edge.weight
      current.size = 16 + Math.min(36, Math.sqrt(current.value) * 3.25)
      nodes.set(name, current)
    }
  }
  return {
    nodes: Array.from(nodes.values()).sort((a, b) => b.value - a.value),
    strongest,
    totalWeight,
  }
}

export async function viewNetwork(book){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewNetwork')
    return
  }
  el.innerHTML = `<h2>${escapeHtml(book)}: Character Network</h2><p>Загружаю…</p>`
  const files = await api.files(book).then(r=>r.files||[]).catch(() => [])
  const name = 'cooccurrence_edges.csv'
  if(!files.includes(name)){
    el.innerHTML = `<h2>${escapeHtml(book)}: Character Network</h2><p>Нет данных</p>`
    return
  }
  const { type, headers=[], rows=[] } = await api.fileParsed(book, name).catch(() => ({ type: 'csv', rows: [] }))
  if(type !== 'csv' || !rows.length){
    el.innerHTML = `<h2>${escapeHtml(book)}: Character Network</h2><p>Нет данных</p>`
    return
  }
  // headers: ['source','source_lower','target','target_lower','weight', ...]
  const edges = normalizeNetworkRows(rows)
  const stats = buildNetworkStats(edges)
  const visibleNodes = stats.nodes.slice(0, 12)
  const topEdge = stats.strongest
  el.innerHTML = `
    <section style="display:grid; gap:16px;">
      <header style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:16px;">
        <div style="max-width:64ch;">
          <p style="margin:0; text-transform:uppercase; letter-spacing:.12em; font-size:.78rem; opacity:.7;">Character network</p>
          <h2 style="margin:.15rem 0 .4rem;">${escapeHtml(book)}</h2>
          <p style="margin:0; opacity:.82;">Weighted co-occurrence graph built from the edge table. Larger nodes appear in more pairings.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <span class="secondary" style="display:inline-flex; align-items:center; gap:8px; padding:.45rem .7rem;">Nodes <strong>${stats.nodes.length}</strong></span>
          <span class="secondary" style="display:inline-flex; align-items:center; gap:8px; padding:.45rem .7rem;">Links <strong>${edges.length}</strong></span>
          <span class="secondary" style="display:inline-flex; align-items:center; gap:8px; padding:.45rem .7rem;">Weight <strong>${stats.totalWeight.toLocaleString()}</strong></span>
        </div>
      </header>
      <section style="display:grid; grid-template-columns:minmax(0, 1.55fr) minmax(280px, .9fr); gap:16px; align-items:start;">
        <div style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:10px; background:var(--pico-card-background-color);">
          <div id="net" style="width:100%; min-height:72vh;"></div>
        </div>
        <aside style="display:grid; gap:12px;">
          <section style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:14px; background:var(--pico-card-background-color);">
            <h3 style="margin-top:0; margin-bottom:8px; font-size:1rem;">Most connected</h3>
            <div style="display:grid; gap:10px;">
              ${visibleNodes.map(node => `
                <div>
                  <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:4px;">
                    <strong>${escapeHtml(node.label)}</strong>
                    <span>${node.value.toLocaleString()}</span>
                  </div>
                  <div style="height:8px; border-radius:999px; background:color-mix(in srgb, var(--pico-muted-border-color) 80%, transparent); overflow:hidden;">
                    <div style="width:${stats.nodes.length ? Math.max(6, (node.value / stats.nodes[0].value) * 100) : 0}%; height:100%; border-radius:inherit; background:linear-gradient(90deg, #0f766e, #2563eb);"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
          <section style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:14px; background:var(--pico-card-background-color);">
            <h3 style="margin-top:0; margin-bottom:8px; font-size:1rem;">Strongest link</h3>
            <p style="margin:0; font-weight:700;">${topEdge ? `${escapeHtml(topEdge.from)} ↔ ${escapeHtml(topEdge.to)}` : '—'}</p>
            <p style="margin:.35rem 0 0; opacity:.82;">Aggregated edge weight: ${topEdge ? topEdge.weight.toLocaleString() : '0'}</p>
          </section>
        </aside>
      </section>
    </section>
  `
  const container = document.getElementById('net')
  try{
    const data = {
      nodes: new DataSet(stats.nodes),
      edges: new DataSet(edges.map(edge => ({
        from: edge.from,
        to: edge.to,
        value: edge.weight,
        width: 1 + Math.min(8, edge.weight / 2),
        title: `${edge.from} ↔ ${edge.to}: ${edge.weight}`,
      }))),
    }
    const options = {
      autoResize: true,
      layout: {
        improvedLayout: true,
        hierarchical: false,
      },
      nodes: {
        shape: 'dot',
        font: {
          size: 15,
          face: 'Inter, system-ui, sans-serif',
          color: '#0f172a',
        },
        color: {
          background: '#dbeafe',
          border: '#2563eb',
          highlight: {
            background: '#bfdbfe',
            border: '#1d4ed8',
          },
        },
        scaling: {
          min: 12,
          max: 46,
          label: {
            enabled: true,
          },
        },
      },
      edges: {
        smooth: { type: 'dynamic' },
        color: {
          color: 'rgba(37, 99, 235, 0.25)',
          highlight: '#2563eb',
          hover: '#0f766e',
        },
        font: {
          color: '#475569',
          size: 12,
        },
        selectionWidth: 2,
      },
      physics: {
        stabilization: {
          enabled: true,
          iterations: 160,
        },
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -48,
          centralGravity: 0.01,
          springLength: 135,
          springConstant: 0.06,
          damping: 0.45,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 80,
        navigationButtons: true,
        keyboard: true,
      },
    }
    new Network(container, data, options)
  }catch(e){
    console.error('Error initializing vis-network', e)
    container.innerHTML = '<p>vis-network initialization error</p>'
  }
}
