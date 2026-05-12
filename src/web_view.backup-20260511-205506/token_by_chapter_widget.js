// Simple widget: input token + button -> fetch token_freq_by_chapter.csv and render aggregated table per chapter
// No imports for fallback; use api helper if available
async function fetchTokenFreqCSV(book) {
  const path = '/api/file?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent('token_freq_by_chapter.csv');
  try {
    if (window.api) {
      const r = await window.api(path);
      if (r && r.content) return r.content;
      return null; // not available
    }
    const resp = await fetch(path);
    if (!resp.ok) return null;
    const j = await resp.json();
    return j.content || null;
  } catch (e) {
    // network error or other issue — treat as missing and let caller use API fallback
    console.warn('fetchTokenFreqCSV failed, will fallback to /api/token_by_chapter', e);
    return null;
  }
}

function parseCSVToRows(text) {
  // reuse parseCSV from file_renderer by importing file_renderer? it's not exported. Reimplement small parser for rows->objects
  const lines = text.split('\n').filter(l=>l.trim());
  if (lines.length===0) return [];
  const headers = lines[0].split(',').map(h=>h.trim());
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(',');
    const obj = {};
    for(let j=0;j<headers.length;j++) obj[headers[j]] = (cols[j] || '').trim();
    rows.push(obj);
  }
  return rows;
}

export async function mountTokenByChapter(containerId, book) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div style="margin-bottom:8px;">
      <input id="tokenQuery" placeholder="Введите токен (например: иван)" style="width:60%;padding:6px;" />
      <button id="tokenQueryBtn" style="padding:6px;margin-left:6px;">Показать частоту по главам</button>
    </div>
    <div id="tokenByChapterResult"></div>
  `;

  const btn = container.querySelector('#tokenQueryBtn');
  const input = container.querySelector('#tokenQuery');
  const out = container.querySelector('#tokenByChapterResult');

  let csvCache = null;
  btn.addEventListener('click', async ()=>{
    const q = input.value.trim();
    if (!q) { out.innerHTML = '<i>Введите токен</i>'; return; }
    const qlow = q.toLowerCase();
    try {
      // First try CSV cache/source
      if (!csvCache) {
        const txt = await fetchTokenFreqCSV(book);
        if (txt) {
          try {
            csvCache = parseCSVToRows(txt);
          } catch(parseErr){
            console.warn('Failed to parse token_freq_by_chapter.csv, will fallback to API', parseErr);
            csvCache = null;
          }
        }
      }

      // If we have CSV data, use it
      if (csvCache) {
        const filtered = csvCache.filter(r => (r.token_lower||'').toLowerCase() === qlow || (r.token||'').toLowerCase() === qlow);
        if (filtered.length === 0) {
          out.innerHTML = '<i>Токен не найден в токенах по главам</i>';
          return;
        }
        const rows = filtered.map(r=>({chapter_idx: r.chapter_idx, count: Number(r.count)})).sort((a,b)=>Number(a.chapter_idx)-Number(b.chapter_idx));
        let html = '<table><thead><tr><th>chapter_idx</th><th>count</th></tr></thead><tbody>';
        for(const rr of rows) html += `<tr><td>${rr.chapter_idx}</td><td>${rr.count}</td></tr>`;
        html += '</tbody></table>';
        out.innerHTML = html;
        return;
      }

      // CSV not available or parsing failed — try server API
      try {
        let resp;
        if (window.api) resp = await window.api('/api/token_by_chapter?book=' + encodeURIComponent(book) + '&token=' + encodeURIComponent(qlow));
        else {
          const r = await fetch('/api/token_by_chapter?book=' + encodeURIComponent(book) + '&token=' + encodeURIComponent(qlow));
          resp = await r.json();
        }
        if (resp && resp.counts) {
          const rows = resp.counts.map(c=>({chapter_idx: c.chapter_idx, title: c.title, count: Number(c.count)}));
          let html = '<table><thead><tr><th>chapter_idx</th><th>title</th><th>count</th></tr></thead><tbody>';
          for(const rr of rows) html += `<tr><td>${rr.chapter_idx}</td><td>${rr.title}</td><td>${rr.count}</td></tr>`;
          html += '</tbody></table>';
          out.innerHTML = html;
          return;
        } else {
          const msg = (resp && resp.error) ? resp.error : 'Данные по токенам недоступны';
          out.innerHTML = '<i>' + msg + '</i>';
          if (window.showUIError) window.showUIError('Ошибка получения частоты по главам', msg, { token: qlow, book });
          return;
        }
      } catch(apiErr){
        console.warn('API token_by_chapter failed', apiErr);
        out.innerHTML = '<i>Не удалось получить данные по токенам (API недоступен)</i>';
        if (window.showUIError) window.showUIError('Ошибка получения частоты по главам', String(apiErr), { token: qlow, book });
        return;
      }

    } catch(e){
      console.error('Unexpected error in token_by_chapter widget', e);
      out.innerHTML = '<i>Ошибка: '+String(e)+'</i>';
      if (window.showUIError) window.showUIError('Внутренняя ошибка виджета', String(e), { token: qlow, book });
    }
  });
}
