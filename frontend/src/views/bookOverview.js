import { api } from '../api.js'
import { setState } from '../state.js'
import { buildChapterStructure } from './booksList.js'

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

function formatCount(value){
  return toNumber(value).toLocaleString()
}

export function buildOverviewMetrics(summary, files=[]){
  const summaryStats = summary?.summary || {}
  const fragments = summary?.fragments || []
  const textIndex = summary?.text_index || []
  const punctuation = summary?.punctuation_timeline || []
  return [
    { label: 'Ready', value: summary?.ready ? 'yes' : 'no', detail: summary?.ready ? 'Summary payload is available' : 'Summary payload missing or pending' },
    { label: 'Chapters', value: summaryStats.chapters_total ?? summaryStats.chapters ?? '—', detail: 'Book-level chapter count' },
    { label: 'Fragments', value: fragments.length || '—', detail: 'Ordered chapter fragments' },
    { label: 'Token rows', value: textIndex.length || '—', detail: 'Stable token ranking rows' },
    { label: 'Punctuation rows', value: punctuation.length || '—', detail: 'Chapter punctuation timeline' },
    { label: 'Files', value: files.length || '—', detail: 'Available source files' },
  ]
}

export function buildTopTokens(textIndex=[], limit=6){
  return textIndex.slice(0, limit).map((row, index) => ({
    token: String(row?.token ?? row?.[0] ?? '').trim() || `token-${index + 1}`,
    count: toNumber(row?.count ?? row?.[1]),
  })).filter(row => row.count > 0)
}

export function buildPunctuationPreview(rows=[], limit=5){
  return rows.slice(0, limit).map((row, index) => ({
    label: String(row?.symbol ?? row?.punctuation ?? row?.mark ?? row?.char ?? row?.label ?? row?.name ?? row?.[0] ?? `#${index + 1}`),
    count: toNumber(row?.count ?? row?.total ?? row?.value ?? row?.[1]),
  }))
}

export function buildOverviewActions(book){
  return [
    { label: 'Atlas shell', href: '#/books', kind: 'secondary' },
    { label: 'Tokens', href: `#/books/${encodeURIComponent(book)}/widget/tokens`, kind: 'contrast' },
    { label: 'Word Cloud', href: `#/books/${encodeURIComponent(book)}/widget/wordcloud`, kind: 'contrast' },
    { label: 'Network', href: `#/books/${encodeURIComponent(book)}/widget/network`, kind: 'contrast' },
    { label: 'Sentiment', href: `#/books/${encodeURIComponent(book)}/widget/sentiment`, kind: 'contrast' },
    { label: 'Heatmap', href: `#/books/${encodeURIComponent(book)}/widget/heatmap`, kind: 'contrast' },
    { label: 'Files', href: `#/book/${encodeURIComponent(book)}/files`, kind: 'secondary' },
  ]
}

export async function viewBookOverview(book){
  const el = document.getElementById('view')
  if(!el){
    console.error('view mount not found in viewBookOverview')
    return
  }
  // append a small loader node to avoid clearing the whole view and causing flash
  const _loader = document.createElement('div')
  _loader.id = 'view-loading'
  _loader.textContent = 'Загружаю обзор…'
  el.appendChild(_loader)
  const [files, summary, index] = await Promise.all([
    api.files(book).then(r=>r.files||[]).catch(()=>[]),
    api.bookSummary(book).catch(()=>null),
    api.bookIndex(book).catch(()=>null),
  ])
  const metrics = buildOverviewMetrics(summary, files)
  const topTokens = buildTopTokens(summary?.text_index || [])
  const punctuation = buildPunctuationPreview(summary?.punctuation_timeline || [])
  const fragments = (summary?.fragments || []).slice(0, 4)
  const chapterRows = index?.rows || index?.fragments || index?.items || index || summary?.fragments || []
  const chapterStructure = buildChapterStructure(chapterRows, 8)
  try{ setState({ selectedBook: book }) }catch(e){}

  const finalHTML = `
    <section style="display:grid; gap:16px;">
      <header style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:16px;">
        <div style="max-width:64ch;">
          <p style="margin:0; text-transform:uppercase; letter-spacing:.12em; font-size:.78rem; opacity:.7;">Atlas center</p>
          <h2 style="margin:.15rem 0 .4rem;">${escapeHtml(book)}</h2>
          <p style="margin:0; opacity:.82;">A compact dashboard built from the summary payload, fragment list, token index, and punctuation timeline.</p>
        </div>
        <div style="display:grid; gap:8px; min-width:min(100%, 280px);">
          ${buildOverviewActions(book).map(action => `<a class="${action.kind}" href="${action.href}">${escapeHtml(action.label)}</a>`).join('')}
        </div>
      </header>
      <section style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px;">
        ${metrics.map(metric => `
          <article style="border:1px solid var(--pico-muted-border-color); border-radius:14px; padding:12px 14px; background:var(--pico-card-background-color);">
            <div style="font-size:.8rem; opacity:.72;">${escapeHtml(metric.label)}</div>
            <div style="font-size:1.15rem; font-weight:700; margin-top:4px;">${escapeHtml(metric.value)}</div>
            <div style="opacity:.72;">${escapeHtml(metric.detail)}</div>
          </article>
        `).join('')}
      </section>
      <section class="dashboard-chapters dashboard-chapters--overview">
        <div class="dashboard-text-viewer__meta">Chapter structure</div>
        ${chapterStructure.items.length ? `
          <div class="dashboard-chapters__track dashboard-chapters__track--overview" aria-label="Chapter structure">
            ${chapterStructure.items.map(({ label, count, width, index }) => `
              <article class="dashboard-chapters__item dashboard-chapters__item--overview" title="${escapeHtml(label)}: ${count}">
                <div class="dashboard-chapters__label">
                  <strong>${escapeHtml(label)}</strong>
                  <span>#${index} ${formatCount(count)}</span>
                </div>
                <div class="dashboard-chapters__bar"><span style="width:${width}%"></span></div>
              </article>
            `).join('')}
          </div>
        ` : '<p style="margin:0; opacity:.72;">No chapter structure available in the summary payload.</p>'}
      </section>
      <section style="display:grid; grid-template-columns:minmax(0, 1.1fr) minmax(280px, .9fr); gap:16px; align-items:start;">
        <article style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:14px; background:var(--pico-card-background-color);">
          <h3 style="margin-top:0; margin-bottom:10px; font-size:1rem;">Top tokens</h3>
          <div style="display:grid; gap:10px;">
            ${topTokens.length ? topTokens.map((row, index) => `
              <div>
                <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:4px;">
                  <strong>${escapeHtml(row.token)}</strong>
                  <span>#${index + 1} ${formatCount(row.count)}</span>
                </div>
                <div style="height:8px; border-radius:999px; background:color-mix(in srgb, var(--pico-muted-border-color) 80%, transparent); overflow:hidden;">
                  <div style="width:${topTokens[0]?.count ? Math.max(8, (row.count / topTokens[0].count) * 100) : 0}%; height:100%; border-radius:inherit; background:linear-gradient(90deg, #2563eb, #8b5cf6);"></div>
                </div>
              </div>
            `).join('') : '<p style="margin:0; opacity:.72;">No token index available.</p>'}
          </div>
          <div style="margin-top:14px;">
            <h3 style="margin:0 0 10px; font-size:1rem;">Recent fragments</h3>
            <div style="display:grid; gap:10px;">
              ${fragments.length ? fragments.map(fragment => `
                <div style="padding:12px; border:1px solid var(--pico-muted-border-color); border-radius:14px;">
                  <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:4px;">
                    <strong>${escapeHtml(fragment.title ?? fragment.name ?? fragment.chapter ?? fragment.chapter_title ?? fragment.chapter_idx ?? 'Fragment')}</strong>
                    <span>${formatCount(fragment.count ?? fragment.words ?? fragment.value ?? 0)}</span>
                  </div>
                  <div style="opacity:.76;">${escapeHtml(fragment.excerpt ?? fragment.preview ?? fragment.text ?? fragment.label ?? '')}</div>
                </div>
              `).join('') : '<p style="margin:0; opacity:.72;">No fragments in the summary payload.</p>'}
            </div>
          </div>
        </article>
        <aside style="display:grid; gap:12px;">
          <section style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:14px; background:var(--pico-card-background-color);">
            <h3 style="margin-top:0; margin-bottom:8px; font-size:1rem;">Punctuation pulse</h3>
            <div style="display:grid; gap:10px;">
              ${punctuation.length ? punctuation.map(item => `
                <div>
                  <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:4px;">
                    <strong>${escapeHtml(item.label)}</strong>
                    <span>${formatCount(item.count)}</span>
                  </div>
                  <div style="height:8px; border-radius:999px; background:color-mix(in srgb, var(--pico-muted-border-color) 80%, transparent); overflow:hidden;">
                    <div style="width:${punctuation[0]?.count ? Math.max(8, (item.count / punctuation[0].count) * 100) : 0}%; height:100%; border-radius:inherit; background:linear-gradient(90deg, #f97316, #ef4444);"></div>
                  </div>
                </div>
              `).join('') : '<p style="margin:0; opacity:.72;">No punctuation timeline available.</p>'}
            </div>
          </section>
      <details style="border:1px solid var(--pico-muted-border-color); border-radius:18px; padding:14px; background:var(--pico-card-background-color);">
            <summary>Files</summary>
            <pre style="white-space:pre-wrap; margin-top:10px;">${files.map(f => `- ${f}`).join('\n')}</pre>
          </details>
        </aside>
      </section>
    </section>
  `
  const frag = document.createRange().createContextualFragment(finalHTML)
  el.replaceChildren(frag)
  const widgetMount = document.getElementById(widgetMountId)
}
