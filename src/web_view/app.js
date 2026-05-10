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

async function renderFileInto(book, name, containerId) {
  try {
    const container = document.getElementById(containerId);
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
    const container = document.getElementById(containerId);
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
  const container = document.getElementById('filesContainer');
  container.innerHTML = '';
  FILE_KEYS.forEach(name => {
    const present = files.includes(name);
    const id = makeId(book, name);
    const desc = FILE_DESCRIPTIONS[name] || 'Файл результата';
    const box = document.createElement('div');
    box.style.border = '1px solid #ddd'; box.style.padding = '8px'; box.style.marginBottom = '8px';
    const h = document.createElement('h4'); h.innerText = name + (present ? '' : ' (not generated)'); box.appendChild(h);
    const d = document.createElement('div'); d.style.color = '#666'; d.style.marginBottom = '6px'; d.innerText = desc; box.appendChild(d);
    const content = document.createElement('div'); content.id = id; box.appendChild(content);
    if (present) {
      const dl = document.createElement('button'); dl.innerText = 'Скачать'; dl.style.marginRight = '8px';
      dl.onclick = () => { window.location = '/api/file_download?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(name); };
      box.insertBefore(dl, content);
    }
    container.appendChild(box);
    if (present) renderFileInto(book, name, id);
    else document.getElementById(id).innerHTML = '<i>File not generated</i>';
  });
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

