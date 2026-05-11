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
});

// expose for non-module fallback
window.loadBookFiles = loadBookFiles;
window.loadRawIntoEditor = loadRawIntoEditor;
window.populateRawSelect = populateRawSelect;
window.runAnalysisAction = runAnalysisAction;

