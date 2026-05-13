import './style.css'
import { buildShell, createChart, fetchJSON, fetchText, mountShell, normalizeRows, parseCSV } from './shared.js'

// When loaded from site/lingvistics.html inside the shell iframe,
// the prebuilt assets and data are under site/public — make paths iframe-friendly.
const DATA_ROOT = './public/data'
const FALLBACK_BOOKS = [
        'tolstoj_lew_nikolaewich-text_1',
        'tolstoj_lew_nikolaewich-text_2',
        'tolstoj_lew_nikolaewich-text_3',
        'tolstoj_lew_nikolaewich-text_4',
        'чехов-письмо',
]

mountShell(buildShell({
        title: 'Лингвистический атлас книг',
        subtitle: 'Статическая витрина outputs без backend, с локальными данными и graceful degradation.',
        controls: `
    <label>
      Книга
      <select id="book-select"></select>
    </label>
    <label>
      Top-N токенов
      <input id="top-n" type="range" min="10" max="40" step="5" value="20" />
    </label>
    <div class="status" id="book-meta"></div>
  `,
}))

const app = document.querySelector('#app-main')
app.innerHTML = `
  <div class="cards" id="summary-cards"></div>
  <section class="grid">
    <article class="panel full"><h2>Частотное ядро</h2><div id="wordcloud" class="viz tall"></div></article>
    <article class="panel"><h2>Top tokens</h2><div id="tokens" class="viz"></div></article>
    <article class="panel"><h2>Ритм по главам</h2><div id="chapters" class="viz"></div></article>
    <article class="panel"><h2>Тональность по главам</h2><div id="sentiment" class="viz"></div></article>
    <article class="panel full"><h2>Персонажи и связи</h2><div id="network" class="viz tall"></div></article>
    <article class="panel"><h2>Персонажи</h2><div class="scroll-panel" id="characters-table"></div></article>
    <article class="panel"><h2>Hapax</h2><div class="scroll-panel" id="hapax-table"></div></article>
    <article class="panel"><h2>Метаданные прогона</h2><div class="scroll-panel" id="metadata-table"></div></article>
    <article class="panel"><h2>Пунктуация</h2><div id="punctuation" class="viz"></div></article>
    <article class="panel"><h2>Стиль: radar</h2><div id="style-radar" class="viz"></div></article>
    <article class="panel full"><h2>Главы: words × sentences</h2><div id="chapter-scatter" class="viz"></div></article>
    <article class="panel full"><h2>Персонажи × главы</h2><div id="character-heatmap" class="viz tall"></div></article>
    <article class="panel full"><h2>Токены × главы</h2><div id="token-heatmap" class="viz tall"></div></article>
    <article class="panel full"><h2>Zipf: rank × frequency</h2><div id="zipf" class="viz"></div></article>
  </section>
`

const statusEl = document.querySelector('#book-meta')
const bookSelect = document.querySelector('#book-select')
const topNInput = document.querySelector('#top-n')
const summaryCards = document.querySelector('#summary-cards')

const charts = Object.fromEntries(['wordcloud', 'tokens', 'chapters', 'sentiment', 'network', 'punctuation', 'style-radar', 'chapter-scatter', 'character-heatmap', 'token-heatmap', 'zipf'].map((id) => [id, createChart(document.getElementById(id))]))

function pickRows(rows, limit) {
        return Array.isArray(rows) ? rows.slice(0, limit).filter(Boolean) : []
}

function renderTable(container, rows, headers) {
        const list = normalizeRows(rows)
        if (!list.length) {
                container.innerHTML = '<div class="muted" style="padding:12px">Нет данных</div>'
                return
        }
        container.innerHTML = `
    <table>
      <thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead>
      <tbody>
        ${list.map((row) => `<tr>${headers.map((header) => `<td>${String(row[header] ?? '')}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `
}

function summarize(complexity) {
        const items = [
                ['total_words', 'Слов'],
                ['unique_words', 'Уникальных'],
                ['hapax_count', 'Hapax'],
                ['dis_legomena', 'Dis legomena'],
                ['lexical_density', 'Плотность'],
                ['avg_sentence_length', 'Длина предложения'],
        ]
        return items.map(([key, label]) => ({ label, value: complexity?.[key] ?? '—' }))
}

function renderCards(complexity, bookId) {
        summaryCards.innerHTML = summarize(complexity)
                .map(({ label, value }) => `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`)
                .join('')
        statusEl.textContent = bookId
}

function renderWordCloud(rows) {
        const data = pickRows(normalizeRows(rows), 80).map((row) => ({ name: row.token, value: Number(row.count || row.frequency || 0) }))
        charts.wordcloud.setOption({ tooltip: {}, series: [{ type: 'wordCloud', shape: 'circle', gridSize: 10, sizeRange: [14, 60], rotationRange: [-45, 45], textStyle: { color: () => `hsl(${Math.floor(Math.random() * 360)}, 50%, 38%)` }, data }] })
}

function renderTokenBar(rows, topN) {
        const data = pickRows(normalizeRows(rows), topN)
        charts.tokens.setOption({ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 120, right: 16, top: 10, bottom: 24 }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: data.map((row) => row.token), inverse: true }, series: [{ type: 'bar', data: data.map((row) => Number(row.count || 0)), itemStyle: { color: '#3558a6' } }] })
}

function renderChapters(rows) {
        const list = normalizeRows(rows)
        const labels = list.map((row) => `Г${row.chapter_idx ?? row.chapter ?? ''}`)
        charts.chapters.setOption({ tooltip: { trigger: 'axis' }, legend: { data: ['Слова', 'Sentences', 'Dialogue %'] }, grid: { left: 50, right: 24, top: 32, bottom: 24 }, xAxis: { type: 'category', data: labels }, yAxis: [{ type: 'value', name: 'count' }, { type: 'value', name: '%', max: 100 }], series: [{ name: 'Слова', type: 'bar', data: list.map((row) => Number(row.total_words || row.words || 0)), itemStyle: { color: '#3558a6' } }, { name: 'Sentences', type: 'line', data: list.map((row) => Number(row.total_sentences || row.sentences || 0)), smooth: true, yAxisIndex: 0, color: '#7a4fd7' }, { name: 'Dialogue %', type: 'line', data: list.map((row) => Number((row.dialog_ratio || 0) * 100)), smooth: true, yAxisIndex: 1, color: '#0c8f6a' }] })
}

function renderSentiment(rows) {
        const list = normalizeRows(rows)
        charts.sentiment.setOption({ tooltip: { trigger: 'axis' }, grid: { left: 50, right: 16, top: 18, bottom: 24 }, xAxis: { type: 'category', data: list.map((row) => `Г${row.chapter_idx ?? ''}`) }, yAxis: { type: 'value' }, series: [{ type: 'line', data: list.map((row) => Number(row.avg_score || row.total_score || 0)), smooth: true, areaStyle: { opacity: 0.12 }, lineStyle: { width: 3, color: '#7a4fd7' }, itemStyle: { color: '#7a4fd7' } }] })
}

function renderPunctuation(rows) {
        const data = pickRows(normalizeRows(rows), 20)
        charts.punctuation.setOption({ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 60, right: 18, top: 10, bottom: 24 }, xAxis: { type: 'category', data: data.map((row) => row.punct) }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: data.map((row) => Number(row.count || 0)), itemStyle: { color: '#0c8f6a' } }] })
}

function renderStyleRadar(complexity) {
        charts['style-radar'].setOption({ tooltip: {}, radar: { indicator: [{ name: 'Yule', max: 1000 }, { name: 'Honore', max: 2000 }, { name: 'Density', max: 1 }, { name: 'Sentence', max: 40 }] }, series: [{ type: 'radar', data: [{ value: [Number(complexity?.yules_k || 0), Number(complexity?.honores_r || 0), Number(complexity?.lexical_density || 0), Number(complexity?.avg_sentence_length || 0)], name: 'Стиль' }], areaStyle: { opacity: 0.15 }, lineStyle: { color: '#3558a6' } }] })
}

function renderChapterScatter(rows) {
        const list = normalizeRows(rows)
        charts['chapter-scatter'].setOption({ tooltip: { trigger: 'item' }, grid: { left: 48, right: 24, top: 18, bottom: 32 }, xAxis: { type: 'value', name: 'words' }, yAxis: { type: 'value', name: 'sentences' }, series: [{ type: 'scatter', symbolSize: (value) => Math.max(6, Math.min(22, value[2] / 5)), data: list.map((row) => [Number(row.total_words || row.words || 0), Number(row.total_sentences || row.sentences || 0), Number(row.dialog_ratio || 0) * 100]), itemStyle: { color: '#7a4fd7' } }] })
}

function renderCharacterHeatmap(characterRows, chapterRows) {
        const characters = normalizeRows(characterRows)
        const chaptersRows = normalizeRows(chapterRows)
        const topCharacters = pickRows(characters.slice().sort((a, b) => Number(b.occurrences || 0) - Number(a.occurrences || 0)), 12)
        const names = topCharacters.map((row) => row.name || row.name_lower).filter(Boolean)
        const chapters = chaptersRows.map((row) => `Г${row.chapter_idx ?? ''}`)
        const indexByName = new Map(names.map((name, index) => [String(name).toLowerCase(), index]))
        const data = []
        for (const row of characters) {
                const name = row.name || row.name_lower
                const nameIdx = indexByName.get(String(name || '').toLowerCase())
                if (nameIdx === undefined) continue
                const rawChapterIdx = Number(row.chapter_idx || 0)
                const chapterIdx = chaptersRows.length && Number(chaptersRows[0]?.chapter_idx) === 0 ? rawChapterIdx : rawChapterIdx - 1
                if (!chapters[chapterIdx]) continue
                data.push([chapterIdx, nameIdx, Number(row.count || 0)])
        }
        charts['character-heatmap'].setOption({ tooltip: { position: 'top' }, grid: { left: 110, right: 18, top: 16, bottom: 34 }, xAxis: { type: 'category', data: chapters, splitArea: { show: true } }, yAxis: { type: 'category', data: names, splitArea: { show: true } }, visualMap: { min: 0, max: Math.max(1, ...data.map((item) => item[2])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 }, series: [{ type: 'heatmap', data, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.2)' } } }] })
}

function renderTokenHeatmap(tokenRows, chapterRows) {
        const tokens = normalizeRows(tokenRows)
        const chaptersRows = normalizeRows(chapterRows)
        const topTokens = pickRows(tokens.slice().sort((a, b) => Number(b.count || 0) - Number(a.count || 0)), 14)
        const names = topTokens.map((row) => row.token || row.name).filter(Boolean)
        const chapters = chaptersRows.map((row) => `Г${row.chapter_idx ?? ''}`)
        const indexByToken = new Map(names.map((name, index) => [String(name).toLowerCase(), index]))
        const data = []
        for (const row of tokens) {
                const name = row.token || row.name
                const tokenIdx = indexByToken.get(String(name || '').toLowerCase())
                if (tokenIdx === undefined) continue
                const rawChapterIdx = Number(row.chapter_idx || 0)
                const chapterIdx = chaptersRows.length && Number(chaptersRows[0]?.chapter_idx) === 0 ? rawChapterIdx : rawChapterIdx - 1
                if (!chapters[chapterIdx]) continue
                data.push([chapterIdx, tokenIdx, Number(row.count || 0)])
        }
        charts['token-heatmap'].setOption({ tooltip: { position: 'top' }, grid: { left: 110, right: 18, top: 16, bottom: 34 }, xAxis: { type: 'category', data: chapters, splitArea: { show: true } }, yAxis: { type: 'category', data: names, splitArea: { show: true } }, visualMap: { min: 0, max: Math.max(1, ...data.map((item) => item[2])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 }, series: [{ type: 'heatmap', data, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.2)' } } }] })
}

function renderZipf(rows) {
        const tokens = normalizeRows(rows).map((row) => ({ token: row.token || row.name, count: Number(row.count || row.frequency || 0), rank: Number(row.rank || 0) })).filter((row) => row.token && row.count > 0)
        const sorted = tokens.slice().sort((a, b) => b.count - a.count).map((row, index) => ({ ...row, rank: row.rank || index + 1 }))
        charts.zipf.setOption({ tooltip: { trigger: 'axis' }, grid: { left: 60, right: 18, top: 18, bottom: 40 }, xAxis: { type: 'log', name: 'rank', minorTick: { show: true } }, yAxis: { type: 'log', name: 'frequency', minorTick: { show: true } }, series: [{ type: 'scatter', symbolSize: 6, data: sorted.map((row) => [Math.max(1, row.rank), Math.max(1, row.count), row.token]), itemStyle: { color: '#3558a6' }, encode: { x: 0, y: 1, tooltip: [2, 0, 1] } }] })
}

function renderNetwork(edges, characters) {
        const edgeRows = normalizeRows(edges)
        const characterRows = normalizeRows(characters)
        const topCharacters = new Map()
        for (const row of characterRows.slice(0, 30)) {
                const name = row.name || row.name_lower
                if (name) topCharacters.set(String(name).toLowerCase(), { name, value: Number(row.occurrences || 1) })
        }
        const nodes = []
        const nodeMap = new Map()
        const links = []
        for (const edge of edgeRows.slice(0, 140)) {
                const source = edge.source || edge.source_lower
                const target = edge.target || edge.target_lower
                const weight = Number(edge.weight || 0)
                if (!source || !target || !weight) continue
                for (const name of [source, target]) {
                        const key = String(name).toLowerCase()
                        if (!nodeMap.has(key)) {
                                const seed = topCharacters.get(key)
                                const item = { name: seed?.name || name, value: seed?.value || 1, symbolSize: Math.max(10, Math.min(40, (seed?.value || weight))), itemStyle: { color: '#3558a6' } }
                                nodeMap.set(key, item)
                                nodes.push(item)
                        }
                }
                links.push({ source, target, value: weight, lineStyle: { width: Math.max(1, Math.min(8, weight / 2)) } })
        }
        charts.network.setOption({ tooltip: {}, series: [{ type: 'graph', layout: 'force', roam: true, data: nodes, links, force: { repulsion: 120, edgeLength: 80 }, label: { show: true, position: 'right' }, emphasis: { focus: 'adjacency' } }] })
}

async function loadBook(bookId) {
        const dir = `${DATA_ROOT}/outputs/${encodeURIComponent(bookId)}`
        const loaders = [
                ['tokens', `${dir}/tokens.csv`, 'csv'],
                ['chapters', `${dir}/chapters_summary.json`, 'json'],
                ['complexity', `${dir}/complexity_metrics.json`, 'json'],
                ['sentiment', `${dir}/sentiment_by_chapter.csv`, 'csv'],
                ['cooccurrence', `${dir}/cooccurrence_edges.csv`, 'csv'],
                ['characters', `${dir}/characters.csv`, 'csv'],
                ['hapax', `${dir}/hapax.csv`, 'csv'],
                ['charFreq', `${dir}/character_freq_by_chapter.csv`, 'csv'],
                ['tokenFreq', `${dir}/token_freq_by_chapter.csv`, 'csv'],
                ['punctuation', `${dir}/punctuation_counts.csv`, 'csv'],
                ['metadata', `${dir}/run_metadata.json`, 'json'],
        ]
        const payload = {}
        for (const [key, path, type] of loaders) {
                try {
                        payload[key] = type === 'json' ? await fetchJSON(path) : parseCSV(await fetchText(path))
                } catch {
                        payload[key] = null
                }
        }
        return {
                tokens: Array.isArray(payload.tokens) ? payload.tokens : [],
                chapters: normalizeRows(payload.chapters),
                complexity: payload.complexity && typeof payload.complexity === 'object' ? payload.complexity : {},
                sentiment: normalizeRows(payload.sentiment),
                cooccurrence: normalizeRows(payload.cooccurrence),
                characters: normalizeRows(payload.characters),
                hapax: normalizeRows(payload.hapax),
                charFreq: normalizeRows(payload.charFreq),
                tokenFreq: normalizeRows(payload.tokenFreq),
                punctuation: normalizeRows(payload.punctuation),
                metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
        }
}

async function init() {
        let manifest = null
        try {
                manifest = await fetchJSON(`${DATA_ROOT}/index.json`)
        } catch {
                manifest = null
        }
        const books = Array.isArray(manifest?.books) && manifest.books.length ? manifest.books : FALLBACK_BOOKS.map((id) => ({ id, title: id }))
        bookSelect.innerHTML = books.map((book) => `<option value="${book.id}">${book.title || book.id}</option>`).join('')
        const render = async () => {
                const data = await loadBook(bookSelect.value)
                const complexity = data.complexity || {}
                const topN = Number(topNInput.value || 20)
                renderCards(complexity, bookSelect.value)
                renderWordCloud(data.tokens)
                renderTokenBar(data.tokens, topN)
                renderChapters(data.chapters)
                renderSentiment(data.sentiment)
                renderNetwork(data.cooccurrence, data.characters)
                renderPunctuation(data.punctuation)
                renderStyleRadar(complexity)
                renderChapterScatter(data.chapters)
                renderCharacterHeatmap(data.charFreq, data.chapters)
                renderTokenHeatmap(data.tokenFreq, data.chapters)
                renderZipf(data.tokens)
                renderTable(document.querySelector('#characters-table'), data.characters, ['name', 'occurrences', 'num_chapters', 'context_sample'])
                renderTable(document.querySelector('#hapax-table'), data.hapax, ['token', 'count'])
                renderTable(document.querySelector('#metadata-table'), data.metadata ? [
                        { key: 'book_id', value: data.metadata.book_id },
                        { key: 'start_time', value: data.metadata.start_time },
                        { key: 'end_time', value: data.metadata.end_time },
                        { key: 'duration_seconds', value: data.metadata.duration_seconds },
                        { key: 'lang', value: data.metadata.config?.lang },
                        { key: 'ner_mode', value: data.metadata.config?.ner_mode },
                        { key: 'sentiment_mode', value: data.metadata.config?.sentiment_mode },
                ] : [], ['key', 'value'])
        }
        bookSelect.addEventListener('change', render)
        topNInput.addEventListener('input', render)
        await render()
}

window.addEventListener('resize', () => Object.values(charts).forEach((chart) => chart.resize()))
init()
