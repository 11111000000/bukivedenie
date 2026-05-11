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

function renderFilesList(book, files) {
  const menu = document.getElementById('fileMenuList');
  const headers = document.getElementById('tabHeaders');
  const content = document.getElementById('tabContent');
  menu.innerHTML = ''; headers.innerHTML = ''; content.innerHTML = '';

  const available = FILE_KEYS.concat(Object.keys(FILE_DESCRIPTIONS)).filter((v,i,a)=>a.indexOf(v)===i);

  // For each logical name, try to find the actual generated filename in `files` (may be prefixed by book id)
  available.forEach(name => {
    const lowerName = name.toLowerCase();
    const actual = files.find(f => {
      const lf = f.toLowerCase();
      return lf === lowerName || lf.endsWith('_' + lowerName) || lf.endsWith('/' + lowerName) || lf.endsWith(lowerName) || lf.includes(lowerName);
    }) || null;
    const present = !!actual;

    const btn = document.createElement('div');
    btn.className = 'file-menu-button' + (present ? '' : ' missing');
    btn.textContent = name + (present ? (' — ' + actual) : ' (not)');
    btn.onclick = () => openTab(book, actual || name, present);
    menu.appendChild(btn);
  });

  // open first generated file if any, otherwise open logical first to show placeholder
  const firstActual = files.find(f => available.some(a => f.toLowerCase().endsWith(a.toLowerCase())) ) || null;
  if (firstActual) openTab(book, firstActual, true);
  else if (available.length) openTab(book, available[0], false);
}

function openTab(book, name, present) {
  const headers = document.getElementById('tabHeaders');
  const content = document.getElementById('tabContent');
  // create header button
  const id = makeId(book, name);
  // avoid duplicate tab
  if (document.getElementById('tab_' + id)) {
    // activate
    Array.from(headers.children).forEach(h=>h.classList.remove('active'));
    document.getElementById('tab_' + id).classList.add('active');
    Array.from(content.children).forEach(c=>c.style.display='none');
    document.getElementById('panel_' + id).style.display = 'block';
    return;
  }
  const hbtn = document.createElement('button'); hbtn.id = 'tab_' + id; hbtn.textContent = name; hbtn.style.marginRight='8px'; hbtn.onclick = ()=>{
    Array.from(headers.children).forEach(h=>h.classList.remove('active'));
    hbtn.classList.add('active');
    Array.from(content.children).forEach(c=>c.style.display='none');
    document.getElementById('panel_' + id).style.display = 'block';
  };
  headers.appendChild(hbtn);

  const panel = document.createElement('div'); panel.id = 'panel_' + id; panel.style.display='block'; panel.style.padding='8px';
  panel.textContent = 'Loading...';
  content.appendChild(panel);

  // render file into panel using safe renderer
  if (present) {
    renderFileInto(book, name, panel);
  } else {
    panel.textContent = 'File not generated for this book';
  }
}


async function loadBookFiles(book) {
  const resp = await api('/api/files?book=' + encodeURIComponent(book));
  const files = resp.files || [];
  renderFilesList(book, files);
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

// init
document.addEventListener('DOMContentLoaded', async ()=>{
  document.getElementById('runAnalysis').addEventListener('click', runAnalysisAction);
  await populateRawSelect();
});

// expose for non-module fallback
window.loadBookFiles = loadBookFiles;
window.loadRawIntoEditor = loadRawIntoEditor;
window.populateRawSelect = populateRawSelect;
window.runAnalysisAction = runAnalysisAction;

