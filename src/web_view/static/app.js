// Non-module fallback app that uses the static renderer (window.renderFileInto)

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

const FILE_KEYS = [
  'tokens.csv','hapax.csv','punctuation_counts.csv','characters.csv','character_freq_by_chapter.csv','cooccurrence_edges.csv','sentiment_by_chapter.csv','complexity_metrics.json','chapters_summary.json','run_metadata.json'
];
const FILE_DESCRIPTIONS = {
  'tokens.csv':'Частоты токенов (token, count, rank, per_1k)',
  'surface_tokens.csv':'Surface tokens (case-preserving) - вспомогательная таблица для NER',
  'sentences.jsonl':'Sentences JSONL (tokenized sentences) - вспомагательная для NER',
  'characters.csv':'Список обнаруженных персонажей (name, occurrences, context)'
};

function renderFilesList(book, files) {
  const menu = document.getElementById('fileMenuList');
  const headers = document.getElementById('tabHeaders');
  const content = document.getElementById('tabContent');
  menu.innerHTML = ''; headers.innerHTML = ''; content.innerHTML = '';

  const available = FILE_KEYS.concat(Object.keys(FILE_DESCRIPTIONS)).filter((v,i,a)=>a.indexOf(v)===i);

  available.forEach(name => {
    const lowerName = name.toLowerCase();
    const actual = files.find(f => {
      const lf = f.toLowerCase();
      return lf === lowerName || lf.endsWith('_' + lowerName) || lf.endsWith('/' + lowerName) || lf.endsWith(lowerName);
    }) || null;
    const present = !!actual;

    const btn = document.createElement('div');
    btn.className = 'file-menu-button' + (present ? '' : ' missing');
    btn.textContent = name + (present ? (' — ' + actual) : ' (not)');
    btn.onclick = () => openTab(book, actual || name, present);
    menu.appendChild(btn);
  });

  // add cloud quick link
  const cloudBtn = document.createElement('div');
  cloudBtn.className = 'file-menu-button';
  cloudBtn.textContent = 'Cloud Preview — показывать последнее облако';
  cloudBtn.onclick = () => loadCloudPreview(book);
  menu.appendChild(cloudBtn);

  // open first generated file if any, otherwise open logical first to show placeholder
  const firstActual = files.find(f => available.some(a => f.toLowerCase().endsWith(a.toLowerCase())) ) || null;
  if (firstActual) openTab(book, firstActual, true);
  else if (available.length) openTab(book, available[0], false);
}

function openTab(book, name, present) {
  const headers = document.getElementById('tabHeaders');
  const content = document.getElementById('tabContent');
  const id = makeId(book, name);
  if (document.getElementById('tab_' + id)) {
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

  // If this is an image from figures/wordclouds, render via figure_download endpoint
  const isImage = typeof name === 'string' && (name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.svg'));
  if (isImage) {
    panel.innerHTML = '';
    const toolbar = document.createElement('div'); toolbar.style.display='flex'; toolbar.style.justifyContent='space-between'; toolbar.style.marginBottom='8px';
    const title = document.createElement('div'); title.textContent = name; title.style.fontWeight='600';
    const actions = document.createElement('div');
    const dl = document.createElement('button'); dl.textContent='Скачать'; dl.onclick = () => { window.location = '/api/figure_download?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(name); };
    actions.appendChild(dl);
    toolbar.appendChild(title); toolbar.appendChild(actions);
    panel.appendChild(toolbar);

    const img = document.createElement('img');
    img.src = '/api/figure_download?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(name);
    img.style.maxWidth = '100%'; img.style.height = 'auto'; img.alt = name;
    panel.appendChild(img);
    return;
  }

  if (present && window.renderFileInto) {
    // use the static renderer which exposes renderFileInto globally
    try {
      const bookId = book || name.split('_').slice(0, -1).join('_') || '';
      window.renderFileInto(bookId, name, panel);
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
  renderFilesList(book, files);
  // also try to load cloud preview
  try { await loadCloudPreview(book); } catch(e) { /* ignore */ }
}

// Load latest cloud PNG for a book
async function loadCloudPreview(book) {
  if (!book) return;
  const resp = await api('/api/figures?book=' + encodeURIComponent(book));
  if (resp.error) return;
  const list = resp.files || [];
  if (!list.length) {
    // create a cloud preview panel with message and generate button
    const name = 'cloud_preview';
    const id = makeId(book, name);
    const headers = document.getElementById('tabHeaders');
    const content = document.getElementById('tabContent');
    if (!document.getElementById('tab_' + id)) {
      const hbtn = document.createElement('button'); hbtn.id = 'tab_' + id; hbtn.textContent = 'Cloud Preview'; hbtn.style.marginRight='8px'; hbtn.onclick = ()=>{
        Array.from(headers.children).forEach(h=>h.classList.remove('active'));
        hbtn.classList.add('active');
        Array.from(content.children).forEach(c=>c.style.display='none');
        document.getElementById('panel_' + id).style.display = 'block';
      };
      headers.appendChild(hbtn);

      const panel = document.createElement('div'); panel.id = 'panel_' + id; panel.style.display='block'; panel.style.padding='8px';
      panel.innerHTML = '';
      const toolbar = document.createElement('div'); toolbar.style.display='flex'; toolbar.style.justifyContent='space-between'; toolbar.style.marginBottom='8px';
      const title = document.createElement('div'); title.textContent = 'Cloud Preview'; title.style.fontWeight='600';
      const actions = document.createElement('div');
      const gen = document.createElement('button'); gen.textContent='Сгенерировать облако'; gen.onclick = async ()=>{
        gen.disabled = true; gen.textContent = 'Генерация...';
        try {
          const res = await api('/api/cloud_generate', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({book: book}) });
          if (res && res.error) {
            alert('Ошибка генерации: ' + (res.error || JSON.stringify(res)));
          } else {
            // refresh file list and open latest
            await loadBookFiles(book);
            await new Promise(r => setTimeout(r, 500));
            await loadCloudPreview(book);
          }
        } catch (e) { alert('Ошибка: ' + e); }
        finally { gen.disabled = false; gen.textContent = 'Сгенерировать облако'; }
      };
      actions.appendChild(gen);
      toolbar.appendChild(title); toolbar.appendChild(actions);
      panel.appendChild(toolbar);

      const msg = document.createElement('div'); msg.textContent = 'Облако ещё не сгенерировано для этой книги.'; panel.appendChild(msg);
      content.appendChild(panel);
    }
    // activate the panel
    Array.from(document.getElementById('tabHeaders').children).forEach(h=>h.classList.remove('active'));
    const tabBtn = document.getElementById('tab_' + id); if (tabBtn) tabBtn.classList.add('active');
    Array.from(document.getElementById('tabContent').children).forEach(c=>c.style.display='none');
    const panelEl = document.getElementById('panel_' + id); if (panelEl) panelEl.style.display = 'block';
    return;
  }
  // find latest png in figures/wordclouds/<book>/
  const pngs = list.filter(n => n.toLowerCase().endsWith('.png'));
  if (!pngs.length) return;
  const latest = pngs[pngs.length-1];
  // open in a new tab panel
  openTab(book, latest, true);
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
  // mount token-by-chapter widget if available (static fallback)
  try {
    const book = (document.getElementById('currentFile').innerText || '').replace(/\.txt$/i,'');
    if (window.mountTokenByChapter && typeof window.mountTokenByChapter === 'function') {
      window.mountTokenByChapter('tokenByChapterWidget', book);
    }
  } catch(e) { /* ignore */ }

  // cloud buttons
  try {
    const showCloudBtn = document.getElementById('showCloudBtn');
    const genCloudBtn = document.getElementById('genCloudBtn');
    showCloudBtn && showCloudBtn.addEventListener('click', async ()=>{
      const book = document.getElementById('currentFile').innerText.replace(/\.txt$/i, '') || '';
      if (!book) { alert('Выберите файл/книгу сначала'); return; }
      await loadCloudPreview(book);
    });
    genCloudBtn && genCloudBtn.addEventListener('click', async ()=>{
      const book = document.getElementById('currentFile').innerText.replace(/\.txt$/i, '') || '';
      if (!book) { alert('Выберите файл/книгу сначала'); return; }
      try {
        const resp = await api('/api/cloud_generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({book: book}) });
        if (resp && resp.error) { alert('Ошибка генерации: ' + resp.error); return; }
        alert('Генерация запущена (или завершена). Обновите список файлов.');
        await loadBookFiles(book);
      } catch (e) { alert('Ошибка: ' + e); }
    });
  } catch(e) { /* ignore */ }
});

// expose for non-module fallback
window.loadBookFiles = loadBookFiles;
window.loadRawIntoEditor = loadRawIntoEditor;
window.populateRawSelect = populateRawSelect;
window.runAnalysisAction = runAnalysisAction;