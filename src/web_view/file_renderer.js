// Helper to render CSV safely using simple parser (handles quoted fields)
function parseCSV(text){
  const rows = [];
  const lines = text.split('\n');
  for(let line of lines){
    if(line.trim()==='') continue;
    const cols = [];
    let cur='';
    let inQuotes=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(inQuotes && i+1<line.length && line[i+1]==='"'){
          cur += '"'; i++; continue;
        }
        inQuotes = !inQuotes; continue;
      }
      if(ch===',' && !inQuotes){ cols.push(cur); cur=''; continue; }
      cur += ch;
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

const MAX_ROWS = 30;

function renderCSV(container, text){
  const rows = parseCSV(text);
  if(rows.length===0){ container.innerHTML='<i>Empty CSV</i>'; return; }
  const headers = rows[0];
  const total = rows.length - 1; // excluding header
  let html = '';
  if(total > MAX_ROWS) html += `<div style="margin-bottom:6px;color:#555;">Показано ${MAX_ROWS} из ${total} строк (всего). Чтобы скачать полный файл, нажмите «Скачать».</div>`;
  html += '<table><thead><tr>' + headers.map(h=>`<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  const limit = Math.min(MAX_ROWS, total);
  for(let i=1;i<=limit;i++){
    const cols = rows[i];
    html += '<tr>' + headers.map((_,j)=>`<td>${cols[j] ? cols[j] : ''}</td>`).join('') + '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderRows(container, rows){
  if(!rows || rows.length===0){ container.innerHTML='<i>Empty table</i>'; return; }
  const total = rows.length;
  const headers = Object.keys(rows[0]);
  let html = '';
  if(total > MAX_ROWS) html += `<div style="margin-bottom:6px;color:#555;">Показано ${MAX_ROWS} из ${total} строк (всего). Чтобы скачать полный файл, нажмите «Скачать».</div>`;
  html += '<table><thead><tr>' + headers.map(h=>`<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  const limit = Math.min(MAX_ROWS, total);
  for(let i=0;i<limit;i++){
    const r = rows[i];
    html += '<tr>' + headers.map(h=>`<td>${r[h] !== undefined ? r[h] : ''}</td>`).join('') + '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

export { renderCSV, renderRows };