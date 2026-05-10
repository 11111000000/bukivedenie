// Simple widget: input token + button -> fetch token_freq_by_chapter.csv and render aggregated table per chapter
import { renderCSV, renderRows } from './file_renderer.js';

async function fetchTokenFreqCSV(book) {
  const resp = await fetch('/api/file?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent('token_freq_by_chapter.csv'));
  if (!resp.ok) throw new Error('cannot fetch token_freq_by_chapter.csv');
  const j = await resp.json();
  return j.content || '';
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
    const q = input.value.trim().toLowerCase();
    if (!q) { out.innerHTML = '<i>Введите токен</i>'; return; }
    try {
      if (!csvCache) {
        const txt = await fetchTokenFreqCSV(book);
        csvCache = parseCSVToRows(txt);
      }
      // filter csvCache for token == q
      const filtered = csvCache.filter(r => r.token_lower === q || r.token === q);
      if (filtered.length === 0) {
        out.innerHTML = '<i>Токен не найден в токенах по главам</i>';
        return;
      }
      // Build table rows: headers chapter_idx, count
      const rows = filtered.map(r=>({chapter_idx: r.chapter_idx, count: Number(r.count)})).sort((a,b)=>Number(a.chapter_idx)-Number(b.chapter_idx));
      // Render simple table
      let html = '<table><thead><tr><th>chapter_idx</th><th>count</th></tr></thead><tbody>';
      for(const rr of rows) html += `<tr><td>${rr.chapter_idx}</td><td>${rr.count}</td></tr>`;
      html += '</tbody></table>';
      out.innerHTML = html;
    } catch(e){
      out.innerHTML = '<i>Error: '+String(e)+'</i>';
    }
  });
}
