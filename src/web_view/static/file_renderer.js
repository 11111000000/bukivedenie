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

    if (rows.length > 200) {
      const pager = document.createElement('div'); pager.style.marginTop='8px';
      const info = document.createElement('span'); info.textContent = `Показано 1–200 из ${rows.length}`; pager.appendChild(info);
      const loadMore = document.createElement('button'); loadMore.textContent = 'Загрузить ещё'; loadMore.style.marginLeft='12px';
      let offset = 200;
      loadMore.onclick = () => {
        const more = rows.slice(offset, offset+200);
        more.forEach(r => {
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
