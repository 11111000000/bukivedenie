import { renderCSV, renderRows } from './file_renderer.js';
import { mountTokenByChapter } from './token_by_chapter_widget.js';

// API helper
async function api(path, opts) {
  const tryFallback = async (p, options) => {
    try {
      const res = await fetch(p, options);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await res.json();
      const text = await res.text();
      try { return JSON.parse(text); } catch (e) { return { error: text }; }
    } catch (e) {
      return { error: String(e) };
    }
  };
  let result = await tryFallback(path, opts);
  if (result && result.error && (String(result.error).includes('Failed to fetch') || String(result.error).includes('NetworkError') || window.location.port === '8002')) {
    try {
      const base = 'http://127.0.0.1:8000';
      const p2 = path.startsWith('/') ? base + path : base + '/' + path;
      result = await tryFallback(p2, opts);
    } catch (e) {
      // ignore
    }
  }
  return result;
}

function makeId(book, name) {
  return ('file_' + book + '_' + name).replace(/[^a-zA-Z0-9_\-]/g, '_');
}

async function renderFileInto(book, name, containerOrId) {
  try {
    const container = (typeof containerOrId === 'string') ? document.getElementById(containerOrId) : containerOrId;
    if (!container) return;
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      // Use /api/file (JSON with content) as primary source; parse CSV client-side to avoid file_json server issues
      const rawResp = await api('/api/file?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(name));
      if (rawResp && rawResp.content) {
        renderCSV(container, rawResp.content);
        return;
      }
      // fallback: try file_json if /api/file failed
      const resp = await api('/api/file_json?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(name));
      if (resp && resp.rows) { renderRows(container, resp.rows); return; }
      container.innerText = 'Error: ' + ((resp && resp.error) ? resp.error : 'cannot load file');
      return;
    }
    const resp = await api('/api/file?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(name));
    if (resp.error) { container.innerText = 'Error: ' + resp.error; return; }
    if (ext === 'json') {
      try { const obj = JSON.parse(resp.content); container.innerHTML = '<pre>' + JSON.stringify(obj, null, 2) + '</pre>'; }
      catch (e) { container.innerText = resp.content; }
    } else { container.innerHTML = '<pre>' + resp.content + '</pre>'; }
  } catch (e) {
    const container = (typeof containerOrId === 'string') ? document.getElementById(containerOrId) : containerOrId;
    if (container) container.innerText = 'Error loading file';
  }
}

// UI error helper for module app (logs to console and shows error panel)
function showUIErrorModule(title, message, details){
  try{ console.error('[UI ERROR]', title, message, details); } catch(e){}
  try{
    const panel = document.getElementById('errorPanel');
    const titleEl = document.getElementById('errorTitle');
    const msgEl = document.getElementById('errorMessage');
    const detailsEl = document.getElementById('errorDetails');
    if (!panel || !titleEl || !msgEl || !detailsEl) return;
    titleEl.innerText = title || 'Ошибка';
    msgEl.innerText = (typeof message === 'string') ? message : JSON.stringify(message, null, 2);
    if (details) { detailsEl.style.display = 'none'; detailsEl.innerText = typeof details === 'string' ? details : JSON.stringify(details, null, 2); }
    else { detailsEl.style.display = 'none'; detailsEl.innerText = ''; }
    panel.style.display = 'block';
  }catch(e){ console.error('showUIErrorModule failed', e); }
}

// Show cloud tab and build a simple token cloud from tokens.csv (or show provided image filename)
async function showCloudInlineModule(book, filename=null){
  const headers = document.getElementById('tabHeaders');
  const content = document.getElementById('tabContent');
  const name = filename || 'cloud_preview';
  const id = makeId(book, name);
  if (!document.getElementById('tab_' + id)){
    const hbtn = document.createElement('button'); hbtn.id = 'tab_' + id; hbtn.textContent = filename? 'Cloud' : 'Cloud Preview'; hbtn.style.marginRight='8px';
    hbtn.onclick = ()=>{
      Array.from(headers.children).forEach(h=>h.classList.remove('active'));
      hbtn.classList.add('active');
      Array.from(content.children).forEach(c=>c.style.display='none');
      document.getElementById('panel_' + id).style.display = 'block';
    };
    headers.appendChild(hbtn);
    const panel = document.createElement('div'); panel.id = 'panel_' + id; panel.style.display='block'; panel.style.padding='8px'; panel.innerHTML = '';
    const toolbar = document.createElement('div'); toolbar.style.display='flex'; toolbar.style.justifyContent='space-between'; toolbar.style.marginBottom='8px';
    const title = document.createElement('div'); title.textContent = filename? name : 'Cloud Preview'; title.style.fontWeight='600';
    const actions = document.createElement('div');
    const dl = document.createElement('button'); dl.textContent = 'Скачать'; dl.style.marginRight='8px';
    dl.onclick = ()=>{ if (filename) window.location = '/api/figure_download?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(filename); };
    const gen = document.createElement('button'); gen.textContent='Сгенерировать облако'; gen.onclick = async ()=>{
      gen.disabled = true; gen.textContent = 'Генерация...';
      try {
        const res = await api('/api/cloud_generate', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({book: book}) });
        if (res && res.error) { showUIErrorModule('Ошибка генерации облака', res.error || JSON.stringify(res), { endpoint: '/api/cloud_generate', book }); }
        else { await loadBookFiles(book); setTimeout(()=>loadCloudPreview(book), 5000); }
      } catch(e){ showUIErrorModule('Исключение при генерации облака', String(e), { endpoint: '/api/cloud_generate', book }); }
      finally { gen.disabled = false; gen.textContent = 'Сгенерировать облако'; }
    };
    actions.appendChild(dl); actions.appendChild(gen);
    toolbar.appendChild(title); toolbar.appendChild(actions); panel.appendChild(toolbar);
    const body = document.createElement('div'); body.id = id + '_body'; panel.appendChild(body); content.appendChild(panel);
  }
  Array.from(headers.children).forEach(h=>h.classList.remove('active'));
  const btn = document.getElementById('tab_' + id); if (btn) btn.classList.add('active');
  Array.from(content.children).forEach(c=>c.style.display='none');
  const panelEl = document.getElementById('panel_' + id); if (panelEl) panelEl.style.display = 'block';
  const bodyEl = document.getElementById(id + '_body'); if (!bodyEl) return; bodyEl.innerHTML = '';
  if (filename){ const img = document.createElement('img'); img.src = '/api/figure_download?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(filename); img.style.maxWidth='100%'; img.style.height='auto'; bodyEl.appendChild(img); return; }

  const cloudWrap = document.createElement('div'); cloudWrap.style.padding = '8px'; const loading = document.createElement('div'); loading.textContent = 'Загрузка tokens.csv и генерация облака...'; cloudWrap.appendChild(loading); bodyEl.appendChild(cloudWrap);
  try{
    const parsed = await api('/api/file_parsed?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent('tokens.csv'));
    if (!parsed || parsed.error) { showUIErrorModule('Не удалось загрузить tokens.csv', parsed && parsed.error ? parsed.error : 'unknown', { book }); loading.textContent = 'Ошибка: ' + (parsed && parsed.error ? parsed.error : 'cannot load tokens.csv'); return; }
    if (parsed.type !== 'csv') { loading.textContent = 'tokens.csv имеет неверный формат: ' + parsed.type; return; }
    const headersCsv = parsed.headers || []; const rows = parsed.rows || [];
    if (rows.length === 0) { loading.textContent = 'tokens.csv пустой'; return; }
    let tokenIdx = headersCsv.indexOf('token'); if (tokenIdx === -1) tokenIdx = headersCsv.indexOf('word'); let countIdx = headersCsv.indexOf('count'); if (countIdx === -1) countIdx = headersCsv.indexOf('frequency'); if (tokenIdx === -1) { loading.textContent = 'tokens.csv не содержит столбца token'; return; }
    const items = []; for (const r of rows) { const tok = r[tokenIdx]; if (!tok) continue; let c = 1; if (countIdx !== -1) { const v = r[countIdx]; const n = Number(v); if (!isNaN(n)) c = n; } items.push({ token: String(tok), count: c }); }
    if (items.length === 0) { loading.textContent = 'Нет токенов для отображения'; return; }
    items.sort((a,b)=>b.count - a.count); const TOP = 200; const topItems = items.slice(0, TOP); const counts = topItems.map(x=>x.count); const maxC = Math.max(...counts); const minC = Math.min(...counts);
    cloudWrap.innerHTML = ''; const cloudBox = document.createElement('div'); cloudBox.style.border = '1px solid #ddd'; cloudBox.style.padding = '12px'; cloudBox.style.minHeight = '180px'; cloudBox.style.background = '#fff'; cloudBox.style.lineHeight = '1.1';
    // palette is defined later when needed (avoid duplicate declarations)
    cloudBox.style.position = 'relative';
    cloudBox.style.width = '100%';
    cloudBox.style.height = '520px';
    cloudBox.style.overflow = 'hidden';

    const minFont = 12; const maxFont = 72;
    function mapSize(count){ if (minC === maxC) return Math.round((minFont+maxFont)/2); return Math.round(minFont + (count - minC) / (maxC - minC) * (maxFont - minFont)); }

    // build words array for d3-cloud
    const words = topItems.map(it => ({ text: it.token, size: mapSize(it.count), raw: it }));

    // create framed SVG box
    cloudBox.innerHTML = '';
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('width','100%'); svg.setAttribute('height','100%'); svg.style.display='block'; svg.style.background='#fff'; svg.style.border = '1px solid #ddd'; svg.style.padding = '8px';
    cloudBox.appendChild(svg);
    const boxRect = cloudBox.getBoundingClientRect();
    const width = Math.max(200, Math.floor(boxRect.width));
    const height = Math.max(200, Math.floor(boxRect.height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const palette = window.WORDCLOUD_PALETTE || ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];

    if (!window.d3 || !window.d3.layout || !window.d3.layout.cloud) {
      // d3-cloud not available: simple inline fallback
      const div = document.createElement('div'); div.style.padding='12px'; div.style.background='#fff';
      for (let i=0;i<words.length;i++){ const w = words[i]; const t = document.createElement('span'); t.style.fontSize = w.size + 'px'; t.style.margin = '6px'; t.style.display='inline-block'; t.style.color = palette[i % palette.length]; t.textContent = w.text; div.appendChild(t); }
      svg.appendChild(div);
      return;
    }

    // Use d3-cloud to compute positions
    const layout = window.d3.layout.cloud()
      .size([width, height])
      .words(words)
      .padding(3)
      .rotate(() => (Math.random() > 0.5 ? 0 : (Math.random()*2-1)*90))
      .font('Impact')
      .fontSize(d => d.size)
      .spiral('archimedean')
      .on('end', draw);

    layout.start();

    function draw(placedWords){
      // clear svg
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      // add a white frame (rect) for visible border
      const rect = document.createElementNS(svgNS, 'rect'); rect.setAttribute('x','0'); rect.setAttribute('y','0'); rect.setAttribute('width', String(width)); rect.setAttribute('height', String(height)); rect.setAttribute('fill','#ffffff'); rect.setAttribute('stroke','#ddd'); svg.appendChild(rect);
      const g = document.createElementNS(svgNS, 'g'); g.setAttribute('transform', `translate(${width/2},${height/2})`);
      svg.appendChild(g);
      placedWords.forEach((w, idx) => {
        const textEl = document.createElementNS(svgNS, 'text');
        textEl.setAttribute('text-anchor','middle');
        textEl.setAttribute('transform', `translate(${w.x},${w.y}) rotate(${w.rotate})`);
        textEl.setAttribute('font-size', String(w.size));
        textEl.setAttribute('font-family','Impact, Arial');
        textEl.setAttribute('fill', palette[idx % palette.length]);
        textEl.style.cursor = 'pointer';
        textEl.textContent = w.text;
        textEl.addEventListener('click', async () => {
          try {
            const resp = await api('/api/token_by_chapter?book=' + encodeURIComponent(book) + '&token=' + encodeURIComponent(w.text));
            if (!resp || resp.error) { console.error('token_by_chapter error', resp); showUIErrorModule('Ошибка получения частоты по главам', resp && resp.error ? resp.error : 'unknown', { token: w.text, book }); return; }
            const existing = bodyEl.querySelector('.token-detail-panel'); if (existing) existing.remove(); const panel = document.createElement('div'); panel.className = 'token-detail-panel'; panel.style.marginTop='10px'; panel.style.padding='8px'; panel.style.border='1px solid #eee'; panel.style.background='#fafafa'; const h = document.createElement('div'); h.textContent = 'Частота по главам для: ' + w.text; h.style.fontWeight='600'; h.style.marginBottom='6px'; panel.appendChild(h);
            const tbl = document.createElement('table'); tbl.style.width='100%'; tbl.style.borderCollapse='collapse'; const thead = document.createElement('thead'); const tr = document.createElement('tr'); ['idx','title','count'].forEach(cn=>{ const th=document.createElement('th'); th.textContent=cn; th.style.textAlign='left'; th.style.padding='4px'; tr.appendChild(th); }); thead.appendChild(tr); tbl.appendChild(thead); const tbody = document.createElement('tbody'); (resp.counts||[]).forEach(r=>{ const tr2=document.createElement('tr'); ['chapter_idx','title','count'].forEach(k=>{ const td=document.createElement('td'); td.textContent = r[k]; td.style.padding='4px'; tr2.appendChild(td); }); tbody.appendChild(tr2); }); tbl.appendChild(tbody); panel.appendChild(tbl); bodyEl.appendChild(panel);
          } catch(err) { console.error('token_by_chapter exception', err); showUIErrorModule('Ошибка при запросе token_by_chapter', String(err), { token: w.text, book }); }
        });
        g.appendChild(textEl);
      });
    }
  }catch(e){ console.error('cloud generation exception', e); showUIErrorModule('Ошибка при генерации облака', String(e), { book }); cloudWrap.innerHTML = 'Ошибка: ' + String(e); }
}

const FILE_KEYS = [
  'tokens.csv','hapax.csv','punctuation_counts.csv','characters.csv','character_freq_by_chapter.csv','cooccurrence_edges.csv','sentiment_by_chapter.csv','complexity_metrics.json','chapters_summary.json','run_metadata.json'
];
const FILE_DESCRIPTIONS = {
  'tokens.csv':'Частоты токенов (token, count, rank, per_1k)',
  'surface_tokens.csv':'Surface tokens (case-preserving) - вспомогательная таблица для NER',
  'sentences.jsonl':'Sentences JSONL (tokenized sentences) - вспомогательная для NER',
  'characters.csv':'Список обнаруженных персонажей (name, occurrences, context)'
};

// renderFilesList is no longer used to replace the sidebar. Keep as legacy but avoid wiping the static menu.
function renderFilesList(book, files) {
  // Deprecated in current UI: sidebar is static. Use updateSidebarState instead.
  return;
}

// Helper to resolve logical filename to actual (book/name)
function resolveActualFromList(book, logical, files){
  if (!logical) return null;
  const lower = logical.toLowerCase();
  // exact match
  for (const f of files){ if (f.toLowerCase() === lower) return {book: book, name: f}; }
  // file equals logical without book prefix
  for (const f of files){ const lf = f.toLowerCase(); if (lf.endsWith('/' + lower) || lf === lower) {
    if (f.includes('/')){ const parts = f.split('/'); return {book: parts[0], name: parts.slice(1).join('/')}; }
    return {book: book, name: f}; }
  }
  // files in tables with prefix book_logical -> tables/test_book_tokens.csv
  for (const f of files){ const lf = f.toLowerCase(); if (lf.endsWith('_' + lower)){
    if (f.includes('/')){ const parts = f.split('/'); return {book: parts[0], name: parts.slice(1).join('/')}; }
    // if file is at top-level like test_book_tokens.csv return it as name and book stays as 'tables' or attempt to infer
    if (f.toLowerCase().startsWith(book.toLowerCase() + '_')){
      // likely in top-level outputs as p.name; return as name and book as '' (will call /api/file?book=&name=... which server handles)
      return {book: 'tables', name: f};
    }
    return {book: book, name: f};
  }}
  // contains
  for (const f of files){ if (f.toLowerCase().includes(lower)){
    if (f.includes('/')){ const parts = f.split('/'); return {book: parts[0], name: parts.slice(1).join('/')}; }
    return {book: book, name: f};
  }}
  return null;
}

// Update existing sidebar buttons with presence/actual filename info
function updateSidebarState(book, files) {
  const menu = document.getElementById('fileMenuList');
  if (!menu) return;
  const availableBtns = Array.from(menu.children);
  availableBtns.forEach(btn => {
    const logical = btn.dataset.logical;
    if (!logical) return;
    const resolved = resolveActualFromList(book, logical, files);
    if (resolved) {
      btn.dataset.actual = resolved.name;
      btn.dataset.book = resolved.book;
      btn.classList.remove('missing');
      btn.textContent = logical + ' — ' + resolved.name;
    } else {
      btn.dataset.actual = '';
      btn.dataset.book = '';
      btn.classList.add('missing');
      btn.textContent = logical + ' (not)';
    }
  });
}

function openTab(book, name, present, menuBtn) {
  const content = document.getElementById('tabContent');

  // If 'name' contains a path (like 'tables/filename.csv'), treat the part before slash as book
  let resolvedBook = book;
  let resolvedName = name;
  if (typeof name === 'string' && name.includes('/')) {
    const parts = name.split('/');
    resolvedBook = parts[0];
    resolvedName = parts.slice(1).join('/');
  }

  const id = makeId(resolvedBook, resolvedName);
  // hide all panels first
  Array.from(content.children).forEach(c=>c.style.display='none');

  // sync menu active state
  Array.from(document.getElementById('fileMenuList').children).forEach(n=>n.classList && n.classList.remove('active-menu'));
  if (menuBtn) menuBtn.classList.add('active-menu');

  // If panel exists, show it
  const existing = document.getElementById('panel_' + id);
  if (existing) {
    existing.style.display = 'block';
    return;
  }

  // create panel and render content directly; no top header buttons
  const panel = document.createElement('div');
  panel.id = 'panel_' + id;
  panel.style.display = 'block';
  panel.style.padding = '8px';
  panel.textContent = 'Loading...';
  content.appendChild(panel);

  if (present) {
    try {
      renderFileInto(resolvedBook, resolvedName, panel);
    } catch (e) {
      panel.textContent = 'Error rendering file: ' + e;
    }
  } else {
    panel.textContent = 'File not generated for this book';
  }
}


async function loadBookFiles(book) {
  const resp = await api('/api/files?book=' + encodeURIComponent(book));
  const files = resp.files || [];
  // Update static sidebar buttons to show which files are present
  try { updateSidebarState(book, files); } catch (e) { /* ignore */ }
  // mount token-by-chapter widget (if present)
  try { mountTokenByChapter('tokenByChapterWidget', book); } catch (e) { /* ignore */ }
}

async function loadRawIntoEditor(name) {
  const resp = await api('/api/raw?name=' + encodeURIComponent(name));
  if (resp.error) throw new Error(resp.error);
  document.getElementById('rawEditor').value = resp.content;
  document.getElementById('currentFile').innerText = name;
  try { const book = name.replace(/\.txt$/i, ''); await loadBookFiles(book); } catch (e) {}
}

async function runAnalysisAction() {
  const current = document.getElementById('currentFile').innerText;
  const name = current && current !== '(none)' ? current : '';
  if (!name) { alert('Файл не выбран'); return; }
  const edited = document.getElementById('rawEditor').value;
  const btn = document.getElementById('runAnalysis'); btn.disabled = true; btn.innerText = 'Запуск...';
  try {
    const saveResp = await fetch('/api/raw_save', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,text:edited})});
    const saveJson = await saveResp.json();
    if (saveJson.error) { alert('Сохранение не удалось: ' + saveJson.error); return; }
    const r = await fetch('/api/run_analysis?raw=' + encodeURIComponent(name));
    const text = await r.text(); let resp;
    try { resp = JSON.parse(text); } catch(e) { resp = { error: text }; }
    if (resp.error) { alert('Анализ не удался: ' + (resp.stderr || resp.error)); return; }
    await loadBookFiles(resp.book);
    alert('Анализ завершён. Файлы обновлены для ' + resp.book);
  } catch(e) { alert('Ошибка: ' + e); }
  finally { btn.disabled = false; btn.innerText = 'Сохранить и запустить анализ'; }
}

// populate raw select
async function populateRawSelect() {
  const resp = await api('/api/raw_files'); const raws = resp.files || [];
  const sel = document.getElementById('rawSelect');
  sel.innerHTML = '';
  raws.forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.innerText = name; sel.appendChild(opt); });
  sel.onchange = async () => { const v = sel.value; if (v) await loadRawIntoEditor(v); };
  if (raws.length>0) { sel.value = raws[0]; await loadRawIntoEditor(raws[0]); }
}

// initialize static sidebar (always visible) - shows logical file buttons
function initSidebarStatic(){
  const menu = document.getElementById('fileMenuList');
  if(!menu) return;
  menu.innerHTML = '';
  const available = FILE_KEYS.concat(Object.keys(FILE_DESCRIPTIONS)).filter((v,i,a)=>a.indexOf(v)===i);
  available.forEach(name => {
    const btn = document.createElement('div');
    btn.className = 'file-menu-button missing';
    btn.textContent = name;
    btn.dataset.logical = name;
    btn.onclick = async (e) => {
      // determine current book from selected raw
      const cur = document.getElementById('currentFile').innerText || '';
      const book = cur && cur !== '(none)' ? cur.replace(/\.txt$/i,'') : '';
      if(!book){ alert('Выберите файл слева в селекте сначала'); return; }
      // fetch files for book and try to resolve actual filename
      const resp = await api('/api/files?book=' + encodeURIComponent(book));
      const files = (resp && resp.files) || [];
      let resolved = resolveActualFromList(book, name, files);
      // Fallback: try /api/find_file to search all outputs
      if (!resolved) {
        try {
          const findResp = await api('/api/find_file?logical=' + encodeURIComponent(name) + '&book=' + encodeURIComponent(book));
          const matches = (findResp && findResp.matches) || [];
          if (matches.length === 1) {
            const m = matches[0];
            if (m.includes('/')) { const parts = m.split('/'); resolved = {book: parts[0], name: parts.slice(1).join('/')}; }
            else resolved = {book: 'tables', name: m};
          } else if (matches.length > 1) {
            // pick the best candidate: prefer exact endswith _name
            let chosen = null;
            for (const m of matches) { if (m.toLowerCase().endsWith('_' + name.toLowerCase())) { chosen = m; break; } }
            if (!chosen) chosen = matches[0];
            if (chosen.includes('/')) { const parts = chosen.split('/'); resolved = {book: parts[0], name: parts.slice(1).join('/')}; }
            else resolved = {book: 'tables', name: chosen};
          }
        } catch (e) { /* ignore */ }
      }
      if (resolved) {
        openTab(resolved.book || book, resolved.name, true, e.currentTarget);
      } else {
        openTab(book, name, false, e.currentTarget);
      }
    };
    menu.appendChild(btn);
  });
}

// init
document.addEventListener('DOMContentLoaded', async ()=>{
  document.getElementById('runAnalysis').addEventListener('click', runAnalysisAction);
  await populateRawSelect();
  initSidebarStatic();

  // wire cloud buttons in module UI
  try {
    const showCloudBtn = document.getElementById('showCloudBtn');
    const genCloudBtn = document.getElementById('genCloudBtn');
    if (showCloudBtn) {
      showCloudBtn.addEventListener('click', async () => {
        // determine book like fallback: currentFile -> rawSelect -> first raw_files
        let book = '';
        try { book = (document.getElementById('currentFile').innerText || '').replace(/\.txt$/i, ''); } catch(e){}
        if (!book) {
          try { const sel = document.getElementById('rawSelect'); if (sel && sel.value) book = sel.value.replace(/\.txt$/i,''); } catch(e){}
        }
        if (!book) {
          try { const rf = await api('/api/raw_files'); const files = (rf && rf.files) || []; if (files.length) { book = files[0].replace(/\.txt$/i,''); try { const sel = document.getElementById('rawSelect'); if (sel) { sel.value = files[0]; sel.dispatchEvent(new Event('change')); } } catch(e){} } } catch(e){}
        }
        if (!book) { showUIErrorModule('Книга не выбрана', 'Выберите файл слева в селекте сначала (или откройте raw файл)'); return; }
        try { await showCloudInlineModule(book); } catch (e) { console.error(e); showUIErrorModule('Ошибка при показе облака', String(e)); }
      });
    }
    if (genCloudBtn) {
      genCloudBtn.addEventListener('click', async () => {
        let book = '';
        try { book = (document.getElementById('currentFile').innerText || '').replace(/\.txt$/i, ''); } catch(e){}
        if (!book) { showUIErrorModule('Книга не выбрана', 'Выберите файл слева в селекте сначала'); return; }
        try {
          const res = await api('/api/cloud_generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({book: book}) });
          if (res && res.error) { showUIErrorModule('Ошибка генерации облака', res.error || JSON.stringify(res), { endpoint: '/api/cloud_generate', book }); return; }
          // poll for image appearance and then show it
          const start = Date.now(); const timeout = 120000; let shown = false;
          while (Date.now() - start < timeout) {
            await new Promise(r=>setTimeout(r, 2000));
            const figs = await api('/api/figures?book=' + encodeURIComponent(book));
            if (figs && !figs.error) {
              const pngs = (figs.files||[]).filter(n=>n.toLowerCase().endsWith('.png'));
              if (pngs.length) { await showCloudInlineModule(book, pngs[pngs.length-1]); shown = true; break; }
            }
          }
          if (!shown) showUIErrorModule('Таймаут генерации облака', 'Генерация не завершилась за 2 минуты. Проверьте outputs/' + book + '/cloud_generation.log', { book });
        } catch (e) { showUIErrorModule('Исключение при генерации облака', String(e), { endpoint: '/api/cloud_generate', book }); }
      });
    }
  } catch (e) { console.error('cloud buttons wiring failed', e); }
});

// expose for non-module fallback
window.loadBookFiles = loadBookFiles;
window.loadRawIntoEditor = loadRawIntoEditor;
window.populateRawSelect = populateRawSelect;
window.runAnalysisAction = runAnalysisAction;
// expose cloud helpers
window.showCloudInline = showCloudInlineModule; // for fallback static code if needed
window.showUIError = showUIErrorModule;

