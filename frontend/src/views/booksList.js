import { api } from '../api.js'
import { getState, setState } from '../state.js'

const WIDGETS = [
  { key: 'atlas', title: 'Book Atlas', description: 'Selected-book map, file counts, and fast routes.' },
  { key: 'viewer', title: 'Text Viewer', description: 'Preview the current source text and linked fragments.' },
  { key: 'tokens', title: 'Top Tokens', description: 'High-signal words in a compact chart.' },
  { key: 'rhythm', title: 'Punctuation Timeline', description: 'Compact rhythm preview from book_summary data.' },
  { key: 'wordcloud', title: 'Word Cloud', description: 'Loose lexical scan for the book vocabulary.' },
  { key: 'network', title: 'Character Network', description: 'Relationship graph with its own scroll.' },
  { key: 'sentiment', title: 'Sentiment', description: 'Chapter-by-chapter sentiment drift.' },
  { key: 'heatmap', title: 'Heatmap', description: 'Token density across chapters.' },
  { key: 'files', title: 'Files', description: 'Raw inputs and generated artifacts.' },
]

const WIDGET_MODULES = {
  tokens: () => import('./tokensChart.js'),
  wordcloud: () => import('./wordCloud.js'),
  network: () => import('./networkGraph.js'),
  sentiment: () => import('./sentimentChart.js'),
  heatmap: () => import('./heatmap.js'),
}

function escapeHtml(value){
  return String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function normalizeBookId(book){
  if(typeof book === 'string') return book
  return String(book?.book_id || book?.book || book?.title || '')
}

async function renderWidgetInto(mount, widgetKey, book){
  if(!mount) return
  const loader = WIDGET_MODULES[widgetKey]
  if(!loader){
    mount.innerHTML = `<p>Виджет <strong>${escapeHtml(widgetKey || '—')}</strong> переключается в компактном виде внутри атласа.</p>`
    return
  }
  // show a local loader inside the mount to avoid clearing the whole dashboard
  const widgetLoader = document.createElement('div')
  widgetLoader.className = 'widget-loading'
  widgetLoader.textContent = 'Загружаю визуализацию…'
  mount.appendChild(widgetLoader)
  try{
    const mod = await loader()
    if(typeof mod.renderInto === 'function'){
      // let the module render into the mount (it may clear/mutate it)
      await mod.renderInto(mount, book)
      return
    }
    mount.innerHTML = `<p>Виджет ${escapeHtml(widgetKey)} не поддерживает встроенный режим.</p>`
  }finally{
    if(widgetLoader.parentNode) widgetLoader.remove()
  }
}

export function selectedBookFromInput(book, books, selectedBook=''){
  const list = (books || []).map(normalizeBookId).filter(Boolean)
  const current = normalizeBookId(book)
  const selected = normalizeBookId(selectedBook)
  if(current && list.includes(current)) return current
  if(selected && list.includes(selected)) return selected
  return list[0] || ''
}

export function selectedFragmentFromInput(fragment, fragments, selectedFragment=''){
  const list = (fragments || []).map(String)
  const current = String(fragment || '')
  const selected = String(selectedFragment || '')
  if(current && list.includes(current)) return current
  if(selected && list.includes(selected)) return selected
  return list[0] || ''
}

export function selectedWidgetFromInput(widget, widgets, selectedWidget=''){
  const list = widgets || []
  if(widget && list.includes(widget)) return widget
  if(selectedWidget && list.includes(selectedWidget)) return selectedWidget
  return list[0] || ''
}

function bookListEntryId(book){
  return normalizeBookId(book)
}

function bookHref(book){
  return `#/books/${encodeURIComponent(book)}`
}

function fragmentHref(book, fragment){
  if(!fragment) return ''
  return `#/books/${encodeURIComponent(book)}/fragment/${encodeURIComponent(fragment)}`
}

function widgetHref(book, key){
  if(key === 'atlas') return `#/books/${encodeURIComponent(book)}`
  if(key === 'files') return `#/book/${encodeURIComponent(book)}/files`
  return `#/books/${encodeURIComponent(book)}/widget/${encodeURIComponent(key)}`
}

function isTextLikeFile(name){
  return /(^|[._-])(text|txt|transcript|excerpt)([._-]|\.|$)/i.test(name)
    || /\.(txt|md|markdown|jsonl)$/i.test(name)
}

export function pickPrimaryTextFile(files){
  const list = files || []
  return list.find(isTextLikeFile)
    || list.find(name => !/\.(csv|tsv|json|jsonl|parquet)$/i.test(name))
    || ''
}

function previewText(value){
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(Boolean)
    .slice(0, 12)
    .join('\n')
}

export function pickTokensFile(files){
  return files.includes('tokens.csv') ? 'tokens.csv' : (files.find(f => f.endsWith('_tokens.csv')) || '')
}

export function buildTokenSummary(rows, limit=5){
  return (rows || []).slice(0, limit).map(row => ({
    token: String(row?.[0] ?? ''),
    count: Number(row?.[1] ?? 0) || 0,
  }))
}

function scaleWidth(count, maxCount){
  if(!maxCount) return 0
  return Math.max((count / maxCount) * 100, 4)
}

function normalizeTimelineItem(item, idx){
  const label = String(item?.symbol ?? item?.punctuation ?? item?.mark ?? item?.char ?? item?.label ?? item?.name ?? item?.chapter ?? item?.[0] ?? `#${idx + 1}`)
  const count = Number(item?.count ?? item?.total ?? item?.value ?? item?.[1] ?? 0) || 0
  return { label, count }
}

export function buildTokenBars(rows, limit=6){
  const items = buildTokenSummary(rows, limit)
  const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0)
  const totalCount = items.reduce((sum, item) => sum + item.count, 0)
  return {
    totalCount,
    maxCount,
    items: items.map(item => ({ ...item, width: scaleWidth(item.count, maxCount) })),
  }
}

export function buildPunctuationTimeline(timeline, limit=8){
  const items = (timeline || []).slice(0, limit).map(normalizeTimelineItem)
  const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0)
  const totalCount = items.reduce((sum, item) => sum + item.count, 0)
  return {
    totalCount,
    maxCount,
    items: items.map(item => ({
      ...item,
      width: scaleWidth(item.count, maxCount),
      height: scaleWidth(item.count, maxCount),
    })),
  }
}

function normalizeChapterStructureItem(item, idx){
  const label = String(item?.title ?? item?.chapter ?? item?.name ?? item?.label ?? item?.fragment ?? item?.section ?? item?.[0] ?? `Chapter ${idx + 1}`)
  const count = Number(item?.count ?? item?.words ?? item?.value ?? item?.total ?? item?.[1] ?? 0) || 0
  return { label, count, index: idx + 1 }
}

export function buildChapterStructure(rows, limit=8){
  const items = (rows || []).slice(0, limit).map(normalizeChapterStructureItem)
  const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0)
  const totalCount = items.reduce((sum, item) => sum + item.count, 0)
  return {
    totalCount,
    maxCount,
    items: items.map(item => ({ ...item, width: scaleWidth(item.count, maxCount) })),
  }
}

export function buildBookSignals(bookSummary){
  const summary = bookSummary?.summary || {}
  const fragments = bookSummary?.fragments || []
  return [
    { label: 'Chapters', value: summary.chapters_total ?? summary.chapters ?? '—' },
    { label: 'Words', value: summary.words ?? '—' },
    { label: 'Tokens', value: summary.tokens ?? '—' },
    { label: 'Punctuation', value: summary.punctuation_marks ?? '—' },
    { label: 'Fragments', value: fragments.length },
  ]
}

export function buildFilesSummary(files, limit=4){
  const selectedFiles = files || []
  const visibleFiles = selectedFiles.slice(0, limit)
  return {
    countText: selectedFiles.length === 1 ? '1 file available' : `${selectedFiles.length} files available`,
    visibleFiles,
    remainingCount: Math.max(selectedFiles.length - visibleFiles.length, 0),
  }
}

export function buildAtlasSummary(book, files, tokenSummary){
  const selectedFiles = files || []
  const textFiles = selectedFiles.filter(isTextLikeFile)
  const primaryTextFile = pickPrimaryTextFile(selectedFiles)
  const tokensFile = pickTokensFile(selectedFiles)
  const topToken = tokenSummary?.[0] || null

  return {
    fileCountText: selectedFiles.length === 1 ? '1 file available' : `${selectedFiles.length} files available`,
    textCountText: textFiles.length === 1 ? '1 text fragment' : `${textFiles.length} text fragments`,
    primaryTextFile,
    tokensFile,
    topToken,
    viewerHref: primaryTextFile ? `#/book/${encodeURIComponent(book)}/file/${encodeURIComponent(primaryTextFile)}` : '',
  }
}

export function buildAtlasMap(book, atlasSummary, textFiles=[], bookSummary=null, selectedFragment=''){
  const primaryTextHref = atlasSummary?.viewerHref || ''
  const tokensHref = atlasSummary?.tokensFile ? `#/books/${encodeURIComponent(book)}/widget/tokens` : ''
  const fragment = selectedFragmentFromInput(selectedFragment, textFiles)
  const fragmentLinkHref = fragment ? fragmentHref(book, fragment) : ''

  return [
    { label: 'Book', value: book, href: bookHref(book), state: 'selected' },
    { label: 'Summary', value: bookSummary?.ready ? 'ready' : 'pending', href: '', state: bookSummary?.ready ? 'ready' : 'pending' },
    { label: 'Primary text', value: atlasSummary?.primaryTextFile || 'none', href: primaryTextHref, state: primaryTextHref ? 'linked' : 'empty' },
    { label: 'Tokens', value: atlasSummary?.tokensFile || 'none', href: tokensHref, state: tokensHref ? 'linked' : 'empty' },
    { label: 'Fragments', value: fragment || (textFiles.length ? `${textFiles.length} detected` : 'none'), href: fragmentLinkHref, state: fragmentLinkHref ? 'selected' : 'empty' },
  ]
}

export async function viewBooks(book='', fragment='', activeWidget=''){
  const mount = document.getElementById('view')
  if(!mount){
    console.error('view mount not found in viewBooks')
    return
  }

  // show a local loader without wiping out the whole mount to avoid visual flash
  const _loader = document.createElement('div')
  _loader.id = 'view-loading'
  _loader.textContent = 'Загружаю список книг…'
  mount.appendChild(_loader)
  const { books } = await api.books()
  const visibleBooks = (books || []).map(bookListEntryId).filter(b => b && !['processed', 'tables', '__pycache__'].includes(b))
  if(!visibleBooks.length){
    mount.innerHTML = '<p>Книги не найдены. Добавьте raw-файлы и запустите анализ.</p>'
    return
  }

  const selected = selectedBookFromInput(book, visibleBooks, getState().selectedBook)
  const selectedFiles = await api.files(selected).then(r => r.files || []).catch(() => [])
  const textFiles = selectedFiles.filter(isTextLikeFile)
  const primaryTextFile = pickPrimaryTextFile(selectedFiles)
  const tokensFile = pickTokensFile(selectedFiles)
  const selectedFragment = selectedFragmentFromInput(fragment, textFiles, getState().selectedFragment)
  const widgetKeys = WIDGETS.filter(widget => widget.key !== 'atlas' && widget.key !== 'files').map(widget => widget.key)
  const selectedWidget = selectedWidgetFromInput(activeWidget, widgetKeys, getState().selectedWidget)
  const bookSummary = await api.bookSummary(selected).catch(() => null)
  const tokenSummary = tokensFile
    ? await api.fileParsed(selected, tokensFile)
      .then(resp => resp?.type === 'csv' ? buildTokenSummary(resp.rows || []) : [])
      .catch(() => [])
    : []
  const textPreview = primaryTextFile
    ? await api.fileParsed(selected, primaryTextFile)
      .then(resp => previewText(resp?.content ?? resp?.data ?? '')).catch(() => '')
    : ''
  const chapterRows = bookSummary?.book_index?.rows || bookSummary?.book_index?.fragments || bookSummary?.fragments || []
  const chapterStructure = buildChapterStructure(chapterRows, 8)
  const atlasSummary = buildAtlasSummary(selected, selectedFiles, tokenSummary)
  const bookSignals = buildBookSignals(bookSummary)
  const tokenBars = buildTokenBars(tokenSummary)
  const punctuationTimeline = buildPunctuationTimeline(bookSummary?.punctuation_timeline || [])
  const atlasContext = [
    { label: 'Status', value: bookSummary?.ready ? 'ready' : 'pending' },
    { label: 'Primary text', value: atlasSummary.primaryTextFile || 'none' },
    { label: 'Token file', value: atlasSummary.tokensFile || 'none' },
    { label: 'Fragment', value: selectedFragment || 'none' },
  ]
  const atlasMap = buildAtlasMap(selected, atlasSummary, textFiles, bookSummary, selectedFragment)
  const atlasRoutes = [
    { label: 'Atlas', href: bookHref(selected) },
    { label: 'Text viewer', href: atlasSummary.viewerHref || `#/book/${encodeURIComponent(selected)}/file/${encodeURIComponent(atlasSummary.primaryTextFile || '')}` },
    { label: 'Files', href: `#/book/${encodeURIComponent(selected)}/files` },
  ].filter(route => route.href && !route.href.endsWith('/file/'))
  const visibleWidgets = WIDGETS.filter(widget => widget.key !== 'atlas' && widget.key !== 'files')
  const widgetTabs = visibleWidgets.map(widget => `
    <li class="dashboard-link-list__item">
      <a class="dashboard-widget-tab${widget.key === selectedWidget ? ' is-active' : ''}" href="#/books/${encodeURIComponent(selected)}/widget/${encodeURIComponent(widget.key)}" aria-current="${widget.key === selectedWidget ? 'page' : 'false'}">${escapeHtml(widget.title)}</a>
    </li>
  `).join('')
  const bookItems = visibleBooks.map(b => `
    <li class="dashboard-link-list__item">
      <a class="book-chip${b === selected ? ' is-active' : ''}" href="${bookHref(b)}" aria-current="${b === selected ? 'page' : 'false'}">
        <strong>${escapeHtml(b)}</strong>
        <span>${b === selected ? 'Active book' : 'Open book'}</span>
      </a>
    </li>
  `).join('')
  const selectedWidgetMeta = WIDGETS.find(widget => widget.key === selectedWidget) || WIDGETS.find(widget => widget.key === 'tokens')
  const widgetMountId = 'dashboard-active-widget'

  try{ setState({ selectedBook: selected, selectedFragment, selectedWidget }) }catch(e){}

  const finalHTML = `
    <section class="dashboard-shell">
      <aside class="dashboard-books">
        <hgroup>
          <p class="dashboard-books__eyebrow">Atlas navigator</p>
          <h2>Книги</h2>
          <p>Choose a book to refresh the dashboard.</p>
        </hgroup>
        <nav class="book-chip-list" aria-label="Book selection">
          <ul class="dashboard-link-list">${bookItems}</ul>
        </nav>
      </aside>
      <section class="dashboard-main">
        <header class="dashboard-hero">
          <div class="dashboard-hero__copy">
            <p class="dashboard-hero__eyebrow">Visual atlas</p>
            <h2>${escapeHtml(selected)}</h2>
            <p>Atlas-first dashboard for the selected book. Switch visualizations without leaving the page.</p>
            <div class="dashboard-hero__context" aria-label="Selected book context">
              ${atlasContext.map(item => `<span><strong>${escapeHtml(item.label)}</strong> ${escapeHtml(item.value)}</span>`).join('')}
            </div>
          </div>
          <div class="dashboard-hero__actions">
            <a class="dashboard-widget__link" href="#/book/${encodeURIComponent(selected)}">Book overview</a>
            <a class="dashboard-widget__link" href="#/book/${encodeURIComponent(selected)}/files">Files</a>
            <nav class="dashboard-widget-tabs" aria-label="Visualization menu">
              <ul class="dashboard-link-list">${widgetTabs}</ul>
            </nav>
            <nav class="dashboard-hero__routes" aria-label="Atlas routes">
              <ul class="dashboard-link-list">${atlasRoutes.map(route => `<li class="dashboard-link-list__item"><a href="${route.href}">${escapeHtml(route.label)}</a></li>`).join('')}</ul>
            </nav>
          </div>
        </header>
        <section class="dashboard-atlas-panel">
          <div class="dashboard-atlas-panel__main">
            <div class="dashboard-atlas__selected">Atlas center</div>
            <a class="dashboard-atlas__book" href="${bookHref(selected)}">${escapeHtml(selected)}</a>
            <p>${selectedFiles.length ? `${atlasSummary.fileCountText}.` : 'No files available yet.'} ${textFiles.length ? `${atlasSummary.textCountText}.` : 'No text fragments detected yet.'}</p>
            <div class="dashboard-atlas__map" aria-label="Book map">
              <div class="dashboard-atlas__map-track">
                ${atlasMap.map((stop, index) => `
                  ${stop.href ? `<a class="dashboard-atlas__map-stop dashboard-atlas__map-stop--${stop.state}" href="${stop.href}">` : `<span class="dashboard-atlas__map-stop dashboard-atlas__map-stop--${stop.state}">`}
                    <strong>${escapeHtml(stop.label)}</strong>
                    <span>${escapeHtml(stop.value)}</span>
                  ${stop.href ? '</a>' : '</span>'}
                  ${index < atlasMap.length - 1 ? '<span class="dashboard-atlas__map-rail" aria-hidden="true"></span>' : ''}
                `).join('')}
              </div>
            </div>
            <div class="dashboard-widget dashboard-widget--focus dashboard-widget--${selectedWidget}">
              <div class="dashboard-widget__header">
                <div class="dashboard-widget__heading">
                  <h3>${escapeHtml(selectedWidgetMeta.title)}</h3>
                  <p>${escapeHtml(selectedWidgetMeta.description)}</p>
                </div>
                <a class="dashboard-widget__link" href="${widgetHref(selected, selectedWidget)}">Open</a>
              </div>
              <div class="dashboard-widget__body">
                <div class="dashboard-widget__active-mount" id="${widgetMountId}"></div>
                ${selectedWidget === 'rhythm' ? `
                  <div class="dashboard-rhythm-summary">
                    <div class="dashboard-text-viewer__meta">${punctuationTimeline.items.length ? `<span>${punctuationTimeline.totalCount} punctuation marks tracked</span>` : 'No punctuation timeline available yet.'}</div>
                    ${punctuationTimeline.items.length ? `<div class="dashboard-rhythm-chart">${punctuationTimeline.items.map(({ label, count, width, height }) => `<div class="dashboard-rhythm-chart__node"><div class="dashboard-rhythm-chart__bubble" style="width:${width}%;height:${height}%"></div><strong>${escapeHtml(label)}</strong><span>${count}</span></div>`).join('')}</div>` : '<p>Punctuation timeline is not available for this book yet.</p>'}
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="dashboard-chapters">
              <div class="dashboard-text-viewer__meta">Chapter structure</div>
              ${chapterStructure.items.length ? `<div class="dashboard-chapters__track" aria-label="Chapter structure">${chapterStructure.items.map(({ label, count, width, index }) => `<div class="dashboard-chapters__item"><div class="dashboard-chapters__label"><strong>${escapeHtml(label)}</strong><span>#${index} ${count}</span></div><div class="dashboard-chapters__bar"><span style="width:${width}%"></span></div></div>`).join('')}</div>` : '<p>No chapter structure available yet.</p>'}
            </div>
            ${bookSummary ? `<div class="dashboard-atlas__signals dashboard-atlas__signals--compact">${bookSignals.slice(0, 4).map(({ label, value }) => `<span><strong>${escapeHtml(label)}</strong> ${escapeHtml(value)}</span>`).join('')}</div>` : ''}
            <div class="dashboard-atlas__preview">
              <div class="dashboard-text-viewer__meta">Primary text</div>
              ${atlasSummary.primaryTextFile ? `<a href="${atlasSummary.viewerHref}">${escapeHtml(atlasSummary.primaryTextFile)}</a><a class="dashboard-widget__link" href="${atlasSummary.viewerHref}">Open in viewer</a>` : '<p>No primary text source detected yet.</p>'}
            </div>
            ${atlasSummary.primaryTextFile && textPreview ? `<pre>${escapeHtml(textPreview)}</pre>` : ''}
          </div>
          <aside class="dashboard-atlas-panel__side">
            <div class="dashboard-atlas__stats">
              <span>${atlasSummary.fileCountText}</span>
              <span>${atlasSummary.textCountText}</span>
              <span>${atlasSummary.tokensFile ? `Token file: ${escapeHtml(atlasSummary.tokensFile)}` : 'No token file'}</span>
              <span>${atlasSummary.topToken ? `Top token: ${escapeHtml(atlasSummary.topToken.token)} (${atlasSummary.topToken.count})` : 'No token summary'}</span>
            </div>
            ${bookSummary ? `<div class="dashboard-atlas__signals"><strong>Book summary</strong><ul class="dashboard-fragment-list">${bookSignals.map(({ label, value }) => `<li><strong>${escapeHtml(label)}</strong> <span>${escapeHtml(value)}</span></li>`).join('')}</ul></div>` : ''}
            <div class="dashboard-atlas__fragments">
              <strong>Text fragments</strong>
              ${textFiles.length ? `<ul class="dashboard-fragment-list">${textFiles.slice(0, 4).map(name => `<li class="${name === selectedFragment ? 'is-active' : ''}"><a href="${fragmentHref(selected, name)}" aria-current="${name === selectedFragment ? 'page' : 'false'}"><strong>${escapeHtml(name)}</strong>${name === selectedFragment ? '<span>Selected fragment</span>' : '<span>Open fragment</span>'}</a></li>`).join('')}</ul>` : '<p>No text-like fragment files detected.</p>'}
            </div>
          </aside>
        </section>
      </section>
    </section>
  `
  // perform atomic replace to avoid flash
  const frag = document.createRange().createContextualFragment(finalHTML)
  mount.replaceChildren(frag)
  const widgetMount = document.getElementById(widgetMountId)
  if(selectedWidget && widgetMount){
    try{
      await renderWidgetInto(widgetMount, selectedWidget, selected)
    }catch(error){
      widgetMount.innerHTML = `<p>Не удалось загрузить виджет: ${escapeHtml(error?.message || error)}</p>`
    }
  }
}
