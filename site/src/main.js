import * as echarts from 'echarts'
import 'echarts-wordcloud'
import './style.css'

// Vite serves files from site/public at the web root.
// The data folder on disk is site/public/data, therefore it is available as /data/...
const DATA_ROOT = './data'
const FALLBACK_BOOKS = [
        'tolstoj_lew_nikolaewich-text_1',
        'tolstoj_lew_nikolaewich-text_2',
        'tolstoj_lew_nikolaewich-text_3',
        'tolstoj_lew_nikolaewich-text_4',
        'чехов-письмо',
]

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="title-row">
        <div>
          <h1>Лингвистический атлас книг</h1>
          <p>Интерактивная статическая витрина: собирает тексты, метрики и связи в одном месте, чтобы быстро увидеть структуру книги без сервера и базы данных.</p>
        </div>
        <div class="status" id="status">Загрузка каталога...</div>
      </div>
      <div class="controls">
        <label>
          Книга
          <select id="book-select"></select>
        </label>
        <label>
          Top-N токенов
          <input id="top-n" type="range" min="10" max="40" step="5" value="20" />
        </label>
        <div class="status" id="book-meta"></div>
      </div>
      <div class="cards" id="summary-cards"></div>
    </header>

    <section class="grid">
      <article class="panel full">
        <h2>Частотное ядро</h2>
        <p class="panel-desc">Облако показывает самые заметные слова книги: чем крупнее слово, тем чаще оно встречается и тем сильнее влияет на общий словарь текста.</p>
        <div id="wordcloud" class="viz tall"></div>
      </article>
      <article class="panel">
        <h2>Top tokens</h2>
        <p class="panel-desc">Столбцы ранжируют самые частые токены, чтобы можно было быстро сравнить лидеров словаря и увидеть, какие слова доминируют в тексте.</p>
        <div id="tokens" class="viz"></div>
      </article>
      <article class="panel">
        <h2>Ритм по главам</h2>
        <p class="panel-desc">График по главам показывает объём текста, длину и диалоговую насыщенность, чтобы видеть, где повествование ускоряется или замедляется.</p>
        <div id="chapters" class="viz"></div>
      </article>
      <article class="panel">
        <h2>Тональность по главам</h2>
        <p class="panel-desc">Линия отражает изменение эмоционального тона по главам: подъемы и просадки помогают заметить напряжённые и спокойные участки книги.</p>
        <div id="sentiment" class="viz"></div>
      </article>
      <article class="panel full">
        <h2>Персонажи и связи</h2>
        <p class="panel-desc">Сеть показывает, кто с кем чаще связан в тексте. Узлы крупнее у более заметных персонажей, а линии помогают увидеть силу пересечений и группировки.</p>
        <div id="network" class="viz tall"></div>
      </article>
      <article class="panel">
        <h2>Персонажи</h2>
        <p class="panel-desc">Таблица перечисляет ключевых персонажей и их частоту, чтобы можно было быстро найти главных действующих лиц и оценить их вклад.</p>
        <div class="scroll-panel" id="characters-table"></div>
      </article>
      <article class="panel">
        <h2>Hapax</h2>
        <p class="panel-desc">Здесь собраны слова, которые встретились один раз. Это полезно для поиска редкой лексики, имён и уникальных деталей языка автора.</p>
        <div class="scroll-panel" id="hapax-table"></div>
      </article>
      <article class="panel">
        <h2>Метаданные прогона</h2>
        <p class="panel-desc">Таблица фиксирует, когда и как был получен набор данных: это помогает понимать источник, режимы обработки и качество результата.</p>
        <div class="scroll-panel" id="metadata-table"></div>
      </article>
      <article class="panel">
        <h2>Пунктуация</h2>
        <p class="panel-desc">Гистограмма показывает, какие знаки препинания преобладают. По ней видно ритм, паузы и общую «манеру дыхания» текста.</p>
        <div id="punctuation" class="viz"></div>
      </article>
      <article class="panel">
        <h2>Стиль: radar</h2>
        <p class="panel-desc">Радар собирает несколько стилевых индикаторов вместе, чтобы быстро сравнить плотность речи, длину фраз и другие признаки авторского почерка.</p>
        <div id="style-radar" class="viz"></div>
      </article>
      <article class="panel full">
        <h2>Главы: words × sentences</h2>
        <p class="panel-desc">Точки показывают главы как отдельные участки: чем выше и правее точка, тем длиннее и сложнее глава по структуре.</p>
        <div id="chapter-scatter" class="viz"></div>
      </article>
      <article class="panel full">
        <h2>Персонажи × главы</h2>
        <p class="panel-desc">Тепловая карта показывает, где именно персонажи активнее появляются в повествовании и как меняется их присутствие от главы к главе.</p>
        <div id="character-heatmap" class="viz tall"></div>
      </article>
      <article class="panel full">
        <h2>Токены × главы</h2>
        <p class="panel-desc">Эта карта помогает увидеть, какие слова концентрируются в отдельных главах и где возникает тематический повтор или смена лексики.</p>
        <div id="token-heatmap" class="viz tall"></div>
      </article>
      <article class="panel full">
        <h2>Zipf: rank × frequency</h2>
        <p class="panel-desc">Диаграмма сравнивает ранг слова и его частоту, чтобы показать, насколько словарь подчиняется типичному распределению Zipf.</p>
        <div id="zipf" class="viz"></div>
      </article>
    </section>
  </div>
`

const statusEl = document.querySelector('#status')
const bookSelect = document.querySelector('#book-select')
const topNInput = document.querySelector('#top-n')
const bookMeta = document.querySelector('#book-meta')
const summaryCards = document.querySelector('#summary-cards')

const chartIds = ['wordcloud', 'tokens', 'chapters', 'sentiment', 'network', 'punctuation', 'style-radar', 'chapter-scatter', 'character-heatmap', 'token-heatmap', 'zipf']
const charts = Object.fromEntries(chartIds.map((id) => [id, echarts.init(document.getElementById(id))]))

let manifest = null
const cache = new Map()

function fmtNumber(value) {
        return new Intl.NumberFormat('ru-RU').format(Number(value || 0))
}

function parseCSV(text) {
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
                        if (row.some((value) => String(value).trim() !== '')) {
                                rows.push(row)
                        }
                        row = []
                        cell = ''
                        continue
                }
                if (char !== '\r') {
                        cell += char
                }
        }

        if (cell.length || row.length) {
                row.push(cell)
                if (row.some((value) => String(value).trim() !== '')) {
                        rows.push(row)
                }
        }

        if (!rows.length) return []
        const headers = rows.shift().map((value) => String(value).trim())
        return rows.map((values) => Object.fromEntries(headers.map((header, idx) => [header, values[idx] ?? ''])))
}

async function fetchText(path) {
        const response = await fetch(path)
        if (!response.ok) {
                throw new Error(`Не удалось загрузить ${path}: ${response.status}`)
        }
        return response.text()
}

async function fetchJSON(path) {
        const response = await fetch(path)
        if (!response.ok) {
                throw new Error(`Не удалось загрузить ${path}: ${response.status}`)
        }
        const text = await response.text()
        try {
                return JSON.parse(text)
        } catch (error) {
                const preview = text.slice(0, 80).replace(/\s+/g, ' ')
                throw new Error(`Некорректный JSON в ${path}: ${preview}`)
        }
}

async function loadBook(bookId) {
        if (cache.has(bookId)) return cache.get(bookId)
        const dir = `${DATA_ROOT}/outputs/${encodeURIComponent(bookId)}`
        const payload = {}
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

        for (const [key, path, type] of loaders) {
                try {
                        payload[key] = type === 'json' ? await fetchJSON(path) : parseCSV(await fetchText(path))
                } catch (error) {
                        payload[key] = null
                        payload[`${key}Error`] = error
                }
        }

        const normalized = {
                tokens: Array.isArray(payload.tokens) ? payload.tokens : [],
                chapters: Array.isArray(payload.chapters?.chapters) ? payload.chapters.chapters : (Array.isArray(payload.chapters) ? payload.chapters : []),
                complexity: payload.complexity && typeof payload.complexity === 'object' ? payload.complexity : {},
                sentiment: Array.isArray(payload.sentiment) ? payload.sentiment : [],
                cooccurrence: Array.isArray(payload.cooccurrence) ? payload.cooccurrence : [],
                characters: Array.isArray(payload.characters) ? payload.characters : [],
                hapax: Array.isArray(payload.hapax) ? payload.hapax : [],
                charFreq: Array.isArray(payload.charFreq) ? payload.charFreq : [],
                tokenFreq: Array.isArray(payload.tokenFreq) ? payload.tokenFreq : [],
                punctuation: Array.isArray(payload.punctuation) ? payload.punctuation : [],
                metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
        }

        cache.set(bookId, normalized)
        return normalized
}

function pickRows(rows, limit) {
        return Array.isArray(rows) ? rows.slice(0, limit).filter(Boolean) : []
}

function normalizeRows(value) {
        if (Array.isArray(value)) return value
        if (value && Array.isArray(value.chapters)) return value.chapters
        if (value && Array.isArray(value.rows)) return value.rows
        if (value && typeof value === 'object') return Object.values(value)
        return []
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
        bookMeta.textContent = bookId
}

function renderTable(container, rows, headers) {
        const list = normalizeRows(rows)
        if (!list.length) {
                container.innerHTML = '<div class="muted" style="padding:12px">Данных для этой таблицы нет в выбранной книге.</div>'
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

function renderWordCloud(rows) {
        const data = pickRows(normalizeRows(rows), 80).map((row) => ({ name: row.token, value: Number(row.count || row.frequency || 0) }))
        charts.wordcloud.setOption({
                tooltip: {},
                series: [{
                        type: 'wordCloud',
                        shape: 'circle',
                        gridSize: 10,
                        sizeRange: [14, 60],
                        rotationRange: [-45, 45],
                        textStyle: { color: () => `hsl(${Math.floor(Math.random() * 360)}, 50%, 38%)` },
                        data,
                }],
        })
}

function renderTokenBar(rows, topN) {
        const data = pickRows(normalizeRows(rows), topN)
        charts.tokens.setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { left: 120, right: 16, top: 10, bottom: 24 },
                xAxis: { type: 'value' },
                yAxis: { type: 'category', data: data.map((row) => row.token), inverse: true },
                series: [{ type: 'bar', data: data.map((row) => Number(row.count || 0)), itemStyle: { color: '#3558a6' } }],
        })
}

function renderChapters(rows) {
        const list = normalizeRows(rows)
        const labels = list.map((row) => `Г${row.chapter_idx ?? row.chapter ?? ''}`)
        charts.chapters.setOption({
                tooltip: { trigger: 'axis' },
                legend: { data: ['Слова', 'Sentences', 'Dialogue %'] },
                grid: { left: 50, right: 24, top: 32, bottom: 24 },
                xAxis: { type: 'category', data: labels },
                yAxis: [
                        { type: 'value', name: 'count' },
                        { type: 'value', name: '%', max: 100 },
                ],
                series: [
                        { name: 'Слова', type: 'bar', data: list.map((row) => Number(row.total_words || 0)), itemStyle: { color: '#3558a6' } },
                        { name: 'Sentences', type: 'line', data: list.map((row) => Number(row.total_sentences || 0)), smooth: true, yAxisIndex: 0, color: '#7a4fd7' },
                        { name: 'Dialogue %', type: 'line', data: list.map((row) => Number((row.dialog_ratio || 0) * 100)), smooth: true, yAxisIndex: 1, color: '#0c8f6a' },
                ],
        })
}

function renderSentiment(rows) {
        const list = normalizeRows(rows)
        charts.sentiment.setOption({
                tooltip: { trigger: 'axis' },
                grid: { left: 50, right: 16, top: 18, bottom: 24 },
                xAxis: { type: 'category', data: list.map((row) => `Г${row.chapter_idx ?? ''}`) },
                yAxis: { type: 'value' },
                series: [{
                        type: 'line',
                        data: list.map((row) => Number(row.avg_score || row.total_score || 0)),
                        smooth: true,
                        areaStyle: { opacity: 0.12 },
                        lineStyle: { width: 3, color: '#7a4fd7' },
                        itemStyle: { color: '#7a4fd7' },
                }],
        })
}

function renderPunctuation(rows) {
        const data = pickRows(normalizeRows(rows), 20)
        charts.punctuation.setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { left: 60, right: 18, top: 10, bottom: 24 },
                xAxis: { type: 'category', data: data.map((row) => row.punct) },
                yAxis: { type: 'value' },
                series: [{ type: 'bar', data: data.map((row) => Number(row.count || 0)), itemStyle: { color: '#0c8f6a' } }],
        })
}

function renderStyleRadar(complexity) {
        charts['style-radar'].setOption({
                tooltip: {},
                radar: {
                        indicator: [
                                { name: 'Yule', max: 1000 },
                                { name: 'Honore', max: 500 },
                                { name: 'Density', max: 1 },
                                { name: 'Sentence', max: 40 },
                        ],
                },
                series: [{
                        type: 'radar',
                        data: [{
                                value: [
                                        Number(complexity?.yules_k || 0),
                                        Number(complexity?.honores_r || 0),
                                        Number(complexity?.lexical_density || 0),
                                        Number(complexity?.avg_sentence_length || 0),
                                ],
                                name: 'Стиль',
                        }],
                        areaStyle: { opacity: 0.15 },
                        lineStyle: { color: '#3558a6' },
                }],
        })
}

function renderChapterScatter(rows) {
        const list = normalizeRows(rows)
        charts['chapter-scatter'].setOption({
                tooltip: { trigger: 'item' },
                grid: { left: 48, right: 24, top: 18, bottom: 32 },
                xAxis: { type: 'value', name: 'words' },
                yAxis: { type: 'value', name: 'sentences' },
                series: [{
                        type: 'scatter',
                        symbolSize: (value) => Math.max(6, Math.min(22, value[2] / 5)),
                        data: list.map((row) => [Number(row.total_words || 0), Number(row.total_sentences || 0), Number(row.dialog_ratio || 0) * 100]),
                        itemStyle: { color: '#7a4fd7' },
                }],
        })
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
                const chapterIdx = chaptersRows.length && chaptersRows[0]?.chapter_idx === 0 ? rawChapterIdx : rawChapterIdx - 1
                if (!chapters[chapterIdx]) continue
                data.push([chapterIdx, nameIdx, Number(row.count || 0)])
        }
        charts['character-heatmap'].setOption({
                tooltip: { position: 'top' },
                grid: { left: 110, right: 18, top: 16, bottom: 34 },
                xAxis: { type: 'category', data: chapters, splitArea: { show: true } },
                yAxis: { type: 'category', data: names, splitArea: { show: true } },
                visualMap: { min: 0, max: Math.max(1, ...data.map((item) => item[2])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 },
                series: [{ type: 'heatmap', data, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.2)' } } }],
        })
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
                const chapterIdx = chaptersRows.length && chaptersRows[0]?.chapter_idx === 0 ? rawChapterIdx : rawChapterIdx - 1
                if (!chapters[chapterIdx]) continue
                data.push([chapterIdx, tokenIdx, Number(row.count || 0)])
        }

        charts['token-heatmap'].setOption({
                tooltip: { position: 'top' },
                grid: { left: 110, right: 18, top: 16, bottom: 34 },
                xAxis: { type: 'category', data: chapters, splitArea: { show: true } },
                yAxis: { type: 'category', data: names, splitArea: { show: true } },
                visualMap: { min: 0, max: Math.max(1, ...data.map((item) => item[2])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 },
                series: [{ type: 'heatmap', data, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.2)' } } }],
        })
}

function renderZipf(rows) {
        const tokens = normalizeRows(rows)
                .map((row) => ({ token: row.token || row.name, count: Number(row.count || row.frequency || 0), rank: Number(row.rank || 0) }))
                .filter((row) => row.token && row.count > 0)

        const sorted = tokens
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((row, index) => ({ ...row, rank: row.rank || index + 1 }))

        charts.zipf.setOption({
                tooltip: { trigger: 'axis' },
                grid: { left: 60, right: 18, top: 18, bottom: 40 },
                xAxis: { type: 'log', name: 'rank', minorTick: { show: true } },
                yAxis: { type: 'log', name: 'frequency', minorTick: { show: true } },
                series: [{
                        type: 'scatter',
                        symbolSize: 6,
                        data: sorted.map((row) => [Math.max(1, row.rank), Math.max(1, row.count), row.token]),
                        itemStyle: { color: '#3558a6' },
                        encode: { x: 0, y: 1, tooltip: [2, 0, 1] },
                }],
        })
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

        charts.network.setOption({
                tooltip: {},
                series: [{
                        type: 'graph',
                        layout: 'force',
                        roam: true,
                        data: nodes,
                        links,
                        force: { repulsion: 120, edgeLength: 80 },
                        label: { show: true, position: 'right' },
                        emphasis: { focus: 'adjacency' },
                }],
        })
}

async function renderBook(bookId) {
        statusEl.textContent = `Загружаю ${bookId}...`
        const data = await loadBook(bookId)
        const complexity = data.complexity || {}
        const topN = Number(topNInput.value || 20)
        renderCards(complexity, bookId)
        renderWordCloud(data.tokens || [])
        renderTokenBar(data.tokens || [], topN)
        renderChapters(data.chapters || [])
        renderSentiment(data.sentiment || [])
        renderNetwork(data.cooccurrence || [], data.characters || [])
        renderPunctuation(data.punctuation || [])
        renderStyleRadar(complexity)
        renderChapterScatter(data.chapters || [])
        renderCharacterHeatmap(data.charFreq || [], data.chapters || [])
        renderTokenHeatmap(data.tokenFreq || [], data.chapters || [])
        renderZipf(data.tokens || [])
        renderTable(document.querySelector('#characters-table'), pickRows(data.characters || [], 80), ['name', 'occurrences', 'num_chapters', 'context_sample'])
        renderTable(document.querySelector('#hapax-table'), pickRows(data.hapax || [], 120), ['token', 'count'])
        renderTable(document.querySelector('#metadata-table'), data.metadata ? [
                { key: 'book_id', value: data.metadata.book_id },
                { key: 'start_time', value: data.metadata.start_time },
                { key: 'end_time', value: data.metadata.end_time },
                { key: 'duration_seconds', value: data.metadata.duration_seconds },
                { key: 'lang', value: data.metadata.config?.lang },
                { key: 'ner_mode', value: data.metadata.config?.ner_mode },
                { key: 'sentiment_mode', value: data.metadata.config?.sentiment_mode },
        ] : [], ['key', 'value'])

        const warnings = [data.tokensError, data.chaptersError, data.complexityError, data.punctuationError, data.charFreqError, data.metadataError].filter(Boolean)
        statusEl.textContent = warnings.length ? `Загружено с пропусками: ${warnings.length}` : 'Готово'
}

async function init() {
        try {
                try {
                        manifest = await fetchJSON(`${DATA_ROOT}/index.json`)
                } catch (error) {
                        manifest = null
                        statusEl.textContent = 'Каталог не прочитан, использую запасной список'
                }

                const books = Array.isArray(manifest?.books) && manifest.books.length
                        ? manifest.books
                        : FALLBACK_BOOKS.map((id) => ({ id, title: id }))

                bookSelect.innerHTML = books.map((book) => `<option value="${book.id}">${book.title || book.id}</option>`).join('')
                bookSelect.addEventListener('change', () => renderBook(bookSelect.value))
                topNInput.addEventListener('input', () => {
                        if (bookSelect.value) renderBook(bookSelect.value)
                })
                await renderBook(books[0].id)
        } catch (error) {
                statusEl.textContent = 'Ошибка запуска витрины'
                app.insertAdjacentHTML('afterbegin', `<div class="error">${error.message}</div>`)
        }
}

window.addEventListener('resize', () => {
        Object.values(charts).forEach((chart) => chart.resize())
})

init()
