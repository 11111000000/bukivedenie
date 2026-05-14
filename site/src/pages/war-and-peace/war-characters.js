import { buildShell, mountShell, createChart, fetchText, parseCSV } from '/src/shared.js'

mountShell(
  buildShell({
    title: 'Война и мир — Персонажи (связи)',
    subtitle: 'Сеть показывает, кто с кем чаще связан в тексте. Узлы крупнее у более заметных персонажей, а линии помогают увидеть силу пересечений и группировки.',
    controls: `
      <label>Поиск
        <input id="q" type="search" placeholder="Напр. Наташа" />
      </label>
      <label>Пол
        <select id="gender">
          <option value="">Все</option>
          <option value="F">F</option>
          <option value="M">M</option>
        </select>
      </label>
      <label>Связи
        <select id="rel">
          <option value="">Все</option>
          <option value="parent">parent</option>
          <option value="married">married</option>
        </select>
      </label>
    `,
  }),
)

const nav = document.querySelector('.site-nav')
if (nav) nav.remove()

const appMain = document.querySelector('#app-main')
appMain.innerHTML = `
  <section class="grid">
    <article class="panel">
      <h2>Граф</h2>
      <p class="panel-desc">Сеть показывает, кто с кем чаще связан в тексте. Узлы крупнее у более заметных персонажей, а линии помогают увидеть силу пересечений и группировки.</p>
      <div id="chart" class="viz tall"></div>
      <div id="hint" class="panel-desc">Клик по узлу подсвечивает соседей и обновляет список справа.</div>
    </article>
    <article class="panel">
      <h2>Персонажи</h2>
      <p class="panel-desc">Таблица перечисляет персонажей, их пол, группу и заметки, а также помогает быстро найти самых связанных героев.</p>
      <div id="picked" class="muted" style="padding:0 0 10px"></div>
      <div class="scroll-panel">
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Пол</th>
              <th>Группа</th>
              <th class="muted">Примечание</th>
              <th>deg</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </article>
  </section>
`

const chart = createChart(document.getElementById('chart'))
const qEl = document.getElementById('q')
const genderEl = document.getElementById('gender')
const relEl = document.getElementById('rel')
const rowsEl = document.getElementById('rows')
const pickedEl = document.getElementById('picked')

const DATA = {
  nodes: './data/war-and-peace/wp_characters_nodes.csv',
  edges: './data/war-and-peace/wp_character_edges.csv',
  fallbackEdges: './data/outputs/tolstoj_lew_nikolaewich-text_1/cooccurrence_edges.csv',
}

function groupFromId(id) {
  const s = String(id || '').toLowerCase()
  if (s.startsWith('rostov') || s.startsWith('rostova')) return 'Ростовы'
  if (s.startsWith('bolkonsky') || s.startsWith('bolkonskaya')) return 'Болконские'
  if (s.startsWith('bezukhov')) return 'Безуховы'
  if (s.startsWith('kuragin') || s.startsWith('kuragina')) return 'Курагины'
  if (s.startsWith('drubetskoy') || s.startsWith('drubetskaya')) return 'Друбецкие'
  if (s.startsWith('karagina')) return 'Карагины'
  return 'Прочие'
}

function normalizeRelType(value) {
  const s = String(value || '').trim()
  // Some sources may include trailing comments after the value.
  return s.replace(/\s*#.*$/, '').trim().split(/\s+/)[0]
}

function esc(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildIndex(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const deg = new Map()
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) || 0) + 1)
    deg.set(e.target, (deg.get(e.target) || 0) + 1)
  }
  return { byId, deg }
}

function applyFilters({ nodes, edges }, { q, gender, rel }) {
  const qNorm = String(q || '').trim().toLowerCase()
  let filteredNodes = nodes
  if (gender) filteredNodes = filteredNodes.filter((n) => (n.gender || '').trim() === gender)
  if (qNorm) filteredNodes = filteredNodes.filter((n) => (n.name || '').toLowerCase().includes(qNorm) || (n.id || '').toLowerCase().includes(qNorm))

  const keep = new Set(filteredNodes.map((n) => n.id))
  let filteredEdges = edges.filter((e) => keep.has(e.source) && keep.has(e.target))
  if (rel) filteredEdges = filteredEdges.filter((e) => e.type === rel)

  // Keep only nodes that still appear in the filtered edge set.
  const connected = new Set()
  for (const e of filteredEdges) {
    connected.add(e.source)
    connected.add(e.target)
  }
  filteredNodes = filteredNodes.filter((n) => connected.has(n.id) || (filteredNodes.length <= 30 && keep.has(n.id)))

  return { nodes: filteredNodes, edges: filteredEdges }
}

function renderTable(nodes, deg, onPick) {
  const list = nodes
    .slice()
    .sort((a, b) => (deg.get(b.id) || 0) - (deg.get(a.id) || 0) || String(a.name).localeCompare(String(b.name), 'ru'))
  rowsEl.innerHTML = list
    .map(
      (n) => `
        <tr data-id="${esc(n.id)}" style="cursor:pointer">
          <td>${esc(n.name)}</td>
          <td>${esc(n.gender)}</td>
          <td>${esc(n.group)}</td>
          <td class="muted">${esc(n.remark)}</td>
          <td>${deg.get(n.id) || 0}</td>
        </tr>
      `,
    )
    .join('')
  rowsEl.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => onPick(tr.getAttribute('data-id')))
  })
}

function buildGraphOption({ nodes, edges }, { deg, pickedId }) {
  const categories = Array.from(new Set(nodes.map((n) => n.group)))
  const catIdx = new Map(categories.map((c, i) => [c, i]))
  const data = nodes.map((n) => {
    const d = deg.get(n.id) || 0
    const size = Math.max(10, Math.min(44, 10 + d * 4))
    return {
      id: n.id,
      name: n.name,
      value: d,
      category: catIdx.get(n.group) ?? 0,
      symbolSize: size,
      itemStyle: pickedId && n.id === pickedId ? { borderColor: '#7a4fd7', borderWidth: 3 } : undefined,
    }
  })
  const links = edges.map((e) => ({
    source: e.source,
    target: e.target,
    value: 1,
    lineStyle: { color: e.type === 'married' ? '#7a4fd7' : '#3558a6', width: e.type === 'married' ? 2.5 : 1.5, opacity: 0.7 },
  }))

  return {
    tooltip: {
      formatter: (p) => {
        if (p.dataType === 'node') return `<b>${esc(p.data.name)}</b><br/>deg: ${esc(p.data.value)}`
        return ''
      },
    },
    legend: [{ data: categories, top: 6 }],
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        data,
        links,
        categories: categories.map((name) => ({ name })),
        label: { show: true, position: 'right' },
        force: { repulsion: 160, edgeLength: 90 },
        emphasis: { focus: 'adjacency' },
      },
    ],
  }
}

function renderPicked(pickedId, { byId }, edges) {
  if (!pickedId) {
    pickedEl.innerHTML = ''
    return
  }
  const n = byId.get(pickedId)
  if (!n) return
  const rels = edges
    .filter((e) => e.source === pickedId || e.target === pickedId)
    .map((e) => {
      const otherId = e.source === pickedId ? e.target : e.source
      const other = byId.get(otherId)
      const label = other ? other.name : otherId
      return `${e.type}: ${label}`
    })
  pickedEl.innerHTML = `<b>${esc(n.name)}</b> <span class="muted">(${esc(n.group)}, ${esc(n.gender)})</span><br/><span class="muted">${esc(n.remark)}</span>${rels.length ? `<br/>` + esc(rels.join(' | ')) : ''}`
}

function showNoData(msg = 'Нет данных') {
  appMain.innerHTML = `<div class="panel"><div class="panel-desc">${esc(msg)}</div></div>`
}

let raw = null
let idx = null
let pickedId = ''

async function load() {
  let nodesRows = []
  let edgesRows = []
  try {
    const [nodesText, edgesText] = await Promise.all([fetchText(DATA.nodes), fetchText(DATA.edges)])
    nodesRows = parseCSV(nodesText)
    edgesRows = parseCSV(edgesText)
  } catch (_) {
    nodesRows = []
    edgesRows = []
  }

  let nodes = []
  let edges = []

  if (nodesRows.length && edgesRows.length) {
    nodes = nodesRows
      .map((r) => ({
        id: String(r.id || '').trim(),
        name: String(r.name || '').trim(),
        gender: String(r.gender || '').trim(),
        remark: String(r.remark || '').trim(),
      }))
      .filter((n) => n.id && n.name)
      .map((n) => ({ ...n, group: groupFromId(n.id) }))

    edges = edgesRows
      .map((r) => ({
        source: String(r.source || '').trim(),
        target: String(r.target || '').trim(),
        type: normalizeRelType(r.type),
      }))
      .filter((e) => e.source && e.target && e.type)
  } else {
    // Fallback: build a simple cooccurrence graph from outputs.
    try {
      const text = await fetchText(DATA.fallbackEdges)
      const rows = parseCSV(text)
      const edgeList = rows
        .map((r) => ({
          source: String(r.source || r.source_lower || '').trim(),
          target: String(r.target || r.target_lower || '').trim(),
          weight: Number(r.weight || 0),
        }))
        .filter((e) => e.source && e.target && e.weight > 0)
        .slice(0, 220)

      const deg = new Map()
      for (const e of edgeList) {
        deg.set(e.source, (deg.get(e.source) || 0) + e.weight)
        deg.set(e.target, (deg.get(e.target) || 0) + e.weight)
      }

      const top = Array.from(deg.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 70)
        .map(([id]) => id)

      const keep = new Set(top)
      nodes = top.map((id) => ({ id, name: id, gender: '', remark: '', group: groupFromId(id) }))
      edges = edgeList
        .filter((e) => keep.has(e.source) && keep.has(e.target))
        .map((e) => ({ source: e.source, target: e.target, type: 'cooccur' }))
    } catch (e) {
      showNoData(e?.message || 'Нет данных')
      return
    }
  }

  if (!nodes.length || !edges.length) {
    showNoData()
    return
  }

  raw = { nodes, edges }
  idx = buildIndex(nodes, edges)

  applyAndRender()
}

function applyAndRender() {
  if (!raw || !idx) return
  const filtered = applyFilters(raw, { q: qEl.value, gender: genderEl.value, rel: relEl.value })
  const { deg, byId } = idx

  const visibleIds = new Set(filtered.nodes.map((n) => n.id))
  if (pickedId && !visibleIds.has(pickedId)) pickedId = ''

  chart.setOption(buildGraphOption(filtered, { deg, pickedId }), true)
  renderTable(filtered.nodes, deg, (id) => {
    pickedId = id
    applyAndRender()
  })
  renderPicked(pickedId, { byId }, filtered.edges)
}

chart.on('click', (p) => {
  if (!idx || !raw) return
  if (p.dataType !== 'node') return
  const id = p.data?.id
  if (!id) return
  pickedId = id
  applyAndRender()
})

;[qEl, genderEl, relEl].forEach((el) => el.addEventListener('input', applyAndRender))
window.addEventListener('resize', () => chart.resize())

load().catch((e) => showNoData(e?.message || 'Ошибка загрузки'))
