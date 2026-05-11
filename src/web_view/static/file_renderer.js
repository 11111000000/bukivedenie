// Lightweight file renderer used by index.html when module scripts are available
// This script implements safer CSV/JSONL handling and renders into display containers

async function api(path, opts) {
  try {
    const res = await fetch(path, opts);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return await res.json();
    const text = await res.text();
    try { return JSON.parse(text); } catch(e) { return {error: text}; }
  } catch(e) { return {error: String(e)}; }
}

function createTextNode(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

function buildTableFromArray(headers, rows) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th'); th.textContent = h; tr.appendChild(th);
  });
  thead.appendChild(tr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    for (let i=0;i<headers.length;i++) {
      const td = document.createElement('td'); td.textContent = row[i] !== undefined ? String(row[i]) : ''; tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

async function renderFileInto(book, name, container) {
  // container may be an element or id
  const cont = typeof container === 'string' ? document.getElementById(container) : container;
  if (!cont) return;
  cont.innerHTML = '';
  const parsedResp = await api('/api/file_parsed?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(name));
  if (parsedResp.error) {
    cont.appendChild(createTextNode('pre', 'Error: ' + parsedResp.error));
    return;
  }
  // Create toolbar
  const toolbar = document.createElement('div'); toolbar.style.display='flex'; toolbar.style.justifyContent='space-between'; toolbar.style.marginBottom='8px';
  const title = document.createElement('div'); title.textContent = name; title.style.fontWeight='600';
  const actions = document.createElement('div');
  const dl = document.createElement('button'); dl.textContent='Скачать'; dl.onclick = () => { window.location = '/api/file_download?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(name); };
  actions.appendChild(dl);
  toolbar.appendChild(title); toolbar.appendChild(actions);
  cont.appendChild(toolbar);

  const content = document.createElement('div'); content.style.overflow='auto'; content.style.maxHeight='520px';

  if (parsedResp.type === 'csv') {
    const headers = parsedResp.headers || [];
    const rows = parsedResp.rows || [];
    if (rows.length === 0) { content.appendChild(createTextNode('div','Empty CSV')); cont.appendChild(content); return; }
    // render table with pagination (show first 200 rows and provide controls)
    const tableWrap = document.createElement('div');
    const table = buildTableFromArray(headers, rows.slice(0,200));
    table.style.width='100%'; tableWrap.appendChild(table);
    content.appendChild(tableWrap);

    // helper: infer canonical book id when server uses outputs/tables or outputs/processed
    function inferBookId(bookParam, fileName) {
      if (!bookParam) return '';
      if (bookParam === 'tables' || bookParam === 'processed') {
        // try to get prefix before first underscore
        const m = fileName.match(/^([^_]+)_/);
        if (m) return m[1];
        // fallback: remove suffixes
        return fileName.replace(/^(.*)\.(csv|jsonl|json)$/i, '$1');
      }
      return bookParam;
    }

    // If CSV looks like surface_tokens.csv, add interactivity: click row -> show sentence snippets and token-by-chapter
    const hasSurface = headers.includes('surface');
    let sentencesCache = null; // lazy load

    if (hasSurface) {
      // make rows clickable: attach listener to tbody rows
      const tbody = table.querySelector('tbody');
      tbody.querySelectorAll('tr').forEach((tr, idx) => {
        tr.style.cursor = 'pointer';
        tr.title = 'Кликните, чтобы показать примеры предложений и частотность по главам';
        tr.addEventListener('click', async () => {
          const row = rows[idx];
          const surface = row[headers.indexOf('surface')];
          const lower = row[headers.indexOf('lower')] || '';
          const first_offset = row[headers.indexOf('first_offset')];
          const first_sentence_index = row[headers.indexOf('first_sentence_index')];

          // result panel
          let panel = tableWrap.querySelector('.token-detail-panel');
          if (!panel) {
            panel = document.createElement('div'); panel.className = 'token-detail-panel'; panel.style.marginTop='12px'; panel.style.padding='8px'; panel.style.border='1px solid #ddd'; panel.style.background='#fff';
            tableWrap.appendChild(panel);
          }
          panel.innerHTML = '';

          const h = document.createElement('div'); h.style.fontWeight='600'; h.textContent = `Token: ${surface}`;
          panel.appendChild(h);
          const meta = document.createElement('div'); meta.style.marginBottom='8px'; meta.textContent = `first_offset: ${first_offset || ''}, first_sentence_index: ${first_sentence_index || ''}`;
          panel.appendChild(meta);

          // buttons: show sentences, show by chapter
          const btns = document.createElement('div'); btns.style.marginBottom='8px';
          const showSents = document.createElement('button'); showSents.textContent = 'Показать предложения (контекст)'; showSents.style.marginRight='8px';
          const showByChap = document.createElement('button'); showByChap.textContent = 'Показать по главам';
          btns.appendChild(showSents); btns.appendChild(showByChap);
          panel.appendChild(btns);

          const out = document.createElement('div'); panel.appendChild(out);

          // helper to fetch sentences.jsonl (tries processed/<book>_sentences.jsonl, then <book>/sentences.jsonl)
          async function fetchSentences(bookParam, fileName) {
            if (sentencesCache) return sentencesCache;
            const bookId = inferBookId(bookParam, fileName);
            // try processed
            let resp = await api('/api/file?book=processed&name=' + encodeURIComponent(bookId + '_sentences.jsonl'));
            if (resp && !resp.error) {
              sentencesCache = resp.content || '';
              return sentencesCache;
            }
            // try book folder
            resp = await api('/api/file?book=' + encodeURIComponent(bookId) + '&name=sentences.jsonl');
            if (resp && !resp.error) {
              sentencesCache = resp.content || '';
              return sentencesCache;
            }
            return null;
          }

          showSents.onclick = async () => {
            out.innerHTML = 'Загрузка...';
            const raw = await fetchSentences(book, name);
            if (!raw) {
              out.textContent = 'sentences.jsonl not found for this book';
              return;
            }
            // parse JSONL and find sentences that contain the token (match on tokens[].text lowercase)
            const lines = raw.split('\n').filter(Boolean);
            const matches = [];
            const searchLower = (surface || '').toLowerCase();
            for (let i=0;i<lines.length;i++) {
              try {
                const obj = JSON.parse(lines[i]);
                if (!obj.tokens) continue;
                // quick check by sentence index if available
                if (typeof first_sentence_index !== 'undefined' && first_sentence_index!=='' && obj.sentence_index === Number(first_sentence_index)) {
                  matches.push(obj); if (matches.length>=20) break; continue;
                }
                // otherwise search tokens
                for (const t of obj.tokens) {
                  if ((t.text || '').toLowerCase() === searchLower) { matches.push(obj); break; }
                }
                if (matches.length>=50) break;
              } catch(e) { continue; }
            }
            if (matches.length === 0) { out.textContent = 'No sentence matches found'; return; }
            // render matches
            out.innerHTML = '';
            const tbl = document.createElement('div');
            matches.slice(0,50).forEach(s => {
              const p = document.createElement('div'); p.style.marginBottom='6px';
              const si = s.sentence_index!==undefined ? ('['+s.sentence_index+'] ') : '';
              const text = (s.tokens || []).map(t=>t.text).join(' ');
              p.textContent = si + text;
              tbl.appendChild(p);
            });
            out.appendChild(tbl);
          };

          showByChap.onclick = async () => {
            out.innerHTML = 'Загрузка по главам...';
            // infer book id
            const bookId = inferBookId(book, name);
            const resp = await api('/api/token_by_chapter?book=' + encodeURIComponent(bookId) + '&token=' + encodeURIComponent(surface));
            if (!resp || resp.error) { out.textContent = 'Error: ' + (resp && resp.error ? resp.error : 'unknown'); return; }
            const rows = resp.counts || [];
            const table = document.createElement('table'); table.style.width='100%'; table.style.borderCollapse='collapse';
            const thead = document.createElement('thead'); const htr = document.createElement('tr'); ['chapter_idx','title','count'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; th.style.textAlign='left'; th.style.padding='4px'; htr.appendChild(th); }); thead.appendChild(htr); table.appendChild(thead);
            const tbody2 = document.createElement('tbody');
            rows.forEach(r=>{ const tr2 = document.createElement('tr'); ['chapter_idx','title','count'].forEach(k=>{ const td=document.createElement('td'); td.textContent = r[k]; td.style.padding='4px'; tr2.appendChild(td); }); tbody2.appendChild(tr2); }); table.appendChild(tbody2);
            out.innerHTML = '';
            out.appendChild(table);
          };

        });
      });
    }

    if (rows.length > 200) {
      const pager = document.createElement('div'); pager.style.marginTop='8px';
      const info = document.createElement('span'); info.textContent = `Показано 1–200 из ${rows.length}`; pager.appendChild(info);
      const loadMore = document.createElement('button'); loadMore.textContent = 'Загрузить ещё'; loadMore.style.marginLeft='12px';
      let offset = 200;
      loadMore.onclick = () => {
        const more = rows.slice(offset, offset+200);
        more.forEach((r,ri) => {
          const tr = document.createElement('tr');
          for (let i=0;i<headers.length;i++){ const td=document.createElement('td'); td.textContent = r[i]!==undefined ? r[i] : ''; tr.appendChild(td); }
          table.querySelector('tbody').appendChild(tr);
        });
        offset += more.length;
        info.textContent = `Показано 1–${offset} из ${rows.length}`;
        if (offset >= rows.length) loadMore.disabled = true;
      };
      pager.appendChild(loadMore);
      content.appendChild(pager);
    }

  } else if (parsedResp.type === 'json' || parsedResp.type === 'jsonl') {
    const pre = document.createElement('pre'); pre.textContent = JSON.stringify(parsedResp.data, null, 2);
    content.appendChild(pre);
  } else {
    const pre = document.createElement('pre'); pre.textContent = parsedResp.content || '';
    content.appendChild(pre);
  }

  cont.appendChild(content);
}

// expose globally for non-module fallback
window.renderFileInto = renderFileInto;

export { renderFileInto };

// expose globally for non-module fallback
window.renderFileInto = renderFileInto;

export { renderFileInto };
