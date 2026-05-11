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

function showUIError(title, message, details){
  try{
    // log to console as well so eruda/devtools capture it
    try { console.error('[UI ERROR]', title, message, details); } catch (e) {}

    const panel = document.getElementById('errorPanel');
    const titleEl = document.getElementById('errorTitle');
    const msgEl = document.getElementById('errorMessage');
    const detailsEl = document.getElementById('errorDetails');
    if (!panel || !titleEl || !msgEl || !detailsEl) {
      console.error('UI Error panel missing:', title, message, details);
      return;
    }
    titleEl.innerText = title || 'Ошибка';
    // message can be string or object
    msgEl.innerText = (typeof message === 'string') ? message : JSON.stringify(message, null, 2);
    if (details) {
      detailsEl.style.display = 'none';
      detailsEl.innerText = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    } else {
      detailsEl.style.display = 'none';
      detailsEl.innerText = '';
    }
    panel.style.display = 'block';
  }catch(e){ console.error('showUIError failed', e, title, message, details); }
}

function hideUIError(){
  try{
    const panel = document.getElementById('errorPanel');
    const detailsEl = document.getElementById('errorDetails');
    if (detailsEl) detailsEl.style.display = 'none';
    if (panel) panel.style.display = 'none';
  }catch(e){ console.error('hideUIError failed', e); }
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
  if (resp.error) {
    console.warn('figures error', resp.error);
    showUIError('Ошибка получения списка фигур', resp.error || 'unknown', { endpoint: '/api/figures', book });
    return;
  }
  const list = resp.files || [];
  // find latest png in figures/wordclouds/<book>/
  const pngs = list.filter(n => n.toLowerCase().endsWith('.png'));
  if (!pngs.length) {
    // fallback: show cloud panel saying not found
    await showCloudInline(book, null);
    return;
  }
  const latest = pngs[pngs.length-1];
  // open inline
  await showCloudInline(book, latest);
}


async function showCloudInline(book, filename=null){
  const headers = document.getElementById('tabHeaders');
  const content = document.getElementById('tabContent');
  const name = filename || 'cloud_preview';
  const id = makeId(book, name);

  // create header button if missing
  if (!document.getElementById('tab_' + id)){
    const hbtn = document.createElement('button'); hbtn.id = 'tab_' + id; hbtn.textContent = filename? 'Cloud' : 'Cloud Preview'; hbtn.style.marginRight='8px';
    hbtn.onclick = ()=>{
      Array.from(headers.children).forEach(h=>h.classList.remove('active'));
      hbtn.classList.add('active');
      Array.from(content.children).forEach(c=>c.style.display='none');
      document.getElementById('panel_' + id).style.display = 'block';
    };
    headers.appendChild(hbtn);

    const panel = document.createElement('div'); panel.id = 'panel_' + id; panel.style.display='block'; panel.style.padding='8px';
    panel.innerHTML = '';
    const toolbar = document.createElement('div'); toolbar.style.display='flex'; toolbar.style.justifyContent='space-between'; toolbar.style.marginBottom='8px';
    const title = document.createElement('div'); title.textContent = filename? name : 'Cloud Preview'; title.style.fontWeight='600';
    const actions = document.createElement('div');
    const dl = document.createElement('button'); dl.textContent = 'Скачать'; dl.style.marginRight='8px';
    dl.onclick = ()=>{ if (filename) window.location = '/api/figure_download?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(filename); };
    const gen = document.createElement('button'); gen.textContent='Сгенерировать облако'; gen.onclick = async ()=>{
      gen.disabled = true; gen.textContent = 'Генерация...';
      try {
        const res = await api('/api/cloud_generate', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({book: book}) });
        if (res && res.error) {
          showUIError('Ошибка генерации облака', res.error || JSON.stringify(res), { endpoint: '/api/cloud_generate', book });
        } else {
          // refresh
          await loadBookFiles(book);
          setTimeout(()=>loadCloudPreview(book), 5000);
        }
      } catch(e){ showUIError('Исключение при генерации облака', String(e), { endpoint: '/api/cloud_generate', book }); }
      finally { gen.disabled = false; gen.textContent = 'Сгенерировать облако'; }
    };
    actions.appendChild(dl); actions.appendChild(gen);
    toolbar.appendChild(title); toolbar.appendChild(actions);
    panel.appendChild(toolbar);

    const body = document.createElement('div'); body.id = id + '_body'; panel.appendChild(body);
    content.appendChild(panel);
  }

  // activate
  Array.from(headers.children).forEach(h=>h.classList.remove('active'));
  const btn = document.getElementById('tab_' + id); if (btn) btn.classList.add('active');
  Array.from(content.children).forEach(c=>c.style.display='none');
  const panelEl = document.getElementById('panel_' + id); if (panelEl) panelEl.style.display = 'block';

  // render body
  const bodyEl = document.getElementById(id + '_body'); if (!bodyEl) return;
  bodyEl.innerHTML = '';

  // If a pre-generated image filename is provided, show it
  if (filename){
    const img = document.createElement('img'); img.src = '/api/figure_download?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent(filename);
    img.style.maxWidth = '100%'; img.style.height = 'auto';
    bodyEl.appendChild(img);
    return;
  }

  // Otherwise build a simple token-based cloud from tokens.csv
  const cloudWrap = document.createElement('div'); cloudWrap.style.padding = '8px';
  const loading = document.createElement('div'); loading.textContent = 'Загрузка tokens.csv и генерация облака...'; cloudWrap.appendChild(loading);
  bodyEl.appendChild(cloudWrap);

  (async () => {
    try {
      // Use file_parsed to get a safe preview of tokens.csv
      const parsed = await api('/api/file_parsed?book=' + encodeURIComponent(book) + '&name=' + encodeURIComponent('tokens.csv'));
      if (!parsed || parsed.error) {
        console.error('tokens.csv load error', parsed);
        showUIError('Не удалось загрузить tokens.csv', parsed && parsed.error ? parsed.error : 'unknown', { book });
        loading.textContent = 'Ошибка: ' + (parsed && parsed.error ? parsed.error : 'cannot load tokens.csv');
        return;
      }
      if (parsed.type !== 'csv') {
        loading.textContent = 'tokens.csv имеет неверный формат: ' + parsed.type;
        return;
      }
      const headersCsv = parsed.headers || [];
      const rows = parsed.rows || [];
      if (rows.length === 0) { loading.textContent = 'tokens.csv пустой'; return; }

      // find token/count columns
      let tokenIdx = headersCsv.indexOf('token');
      if (tokenIdx === -1) tokenIdx = headersCsv.indexOf('word');
      let countIdx = headersCsv.indexOf('count');
      if (countIdx === -1) countIdx = headersCsv.indexOf('frequency');
      if (tokenIdx === -1) { loading.textContent = 'tokens.csv не содержит столбца token'; return; }

      const items = [];
      for (const r of rows) {
        const tok = r[tokenIdx];
        if (!tok) continue;
        let c = 1;
        if (countIdx !== -1) {
          const v = r[countIdx];
          const n = Number(v);
          if (!isNaN(n)) c = n;
        }
        items.push({ token: String(tok), count: c });
      }
      if (items.length === 0) { loading.textContent = 'Нет токенов для отображения'; return; }

      items.sort((a,b)=>b.count - a.count);
      const TOP = 200;
      const topItems = items.slice(0, TOP);
      const counts = topItems.map(x=>x.count);
      const maxC = Math.max(...counts);
      const minC = Math.min(...counts);

      cloudWrap.innerHTML = '';
      const cloudBox = document.createElement('div');
      cloudBox.style.border = '1px solid #ddd';
      cloudBox.style.padding = '12px';
      cloudBox.style.minHeight = '180px';
      cloudBox.style.background = '#fff';
      cloudBox.style.lineHeight = '1.1';

      // palette is defined later when needed (avoid duplicate declarations)

      // Use d3-cloud for layout (compact, non-overlapping)
      cloudBox.style.position = 'relative';
      cloudBox.style.width = '100%';
      cloudBox.style.height = '520px';
      cloudBox.style.overflow = 'hidden';

      const minFont = 12, maxFont = 72;
      // linear mapping of count->font size
      function mapSize(count){ if (minC === maxC) return Math.round((minFont+maxFont)/2); return Math.round(minFont + (count - minC) / (maxC - minC) * (maxFont - minFont)); }

      const words = topItems.map(it => ({ text: it.token, size: mapSize(it.count), raw: it }));

      // create svg container
      cloudBox.innerHTML = '';
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.style.display = 'block'; svg.style.background = '#fff';
      cloudBox.appendChild(svg);
      const boxRect = cloudBox.getBoundingClientRect();
      const width = Math.max(200, boxRect.width);
      const height = Math.max(200, boxRect.height);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

      if (!window.d3 || !window.d3.layout || !window.d3.layout.cloud) {
        // d3-cloud not available; fallback to simple rendering without layout
        for (let i=0;i<words.length;i++){
          const w = words[i]; const t = document.createElement('div'); t.style.fontSize = w.size + 'px'; t.style.display='inline-block'; t.style.margin='6px'; t.textContent = w.text; cloudBox.appendChild(t);
        }
        return;
      }

      // run layout
      const layout = window.d3.layout.cloud()
        .size([width, height])
        .words(words)
        .padding(2)
        .rotate(() => (Math.random() > 0.5 ? 0 : (Math.random()*2-1)*90))
        .font('Impact')
        .fontSize(d => d.size)
        .spiral('archimedean')
        .on('end', draw);

      layout.start();

      function draw(wordsPlaced){
        // clear svg children
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const g = document.createElementNS(svgNS, 'g');
        g.setAttribute('transform', `translate(${width/2},${height/2})`);
        svg.appendChild(g);
        wordsPlaced.forEach((w, idx) => {
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
              if (!resp || resp.error) { console.error('token_by_chapter error', resp); showUIError('Ошибка получения частоты по главам', resp && resp.error ? resp.error : 'unknown', { token: w.text, book }); return; }
              const existing = bodyEl.querySelector('.token-detail-panel'); if (existing) existing.remove(); const panel = document.createElement('div'); panel.className = 'token-detail-panel'; panel.style.marginTop='10px'; panel.style.padding='8px'; panel.style.border='1px solid #eee'; panel.style.background='#fafafa'; const h = document.createElement('div'); h.textContent = 'Частота по главам для: ' + w.text; h.style.fontWeight='600'; h.style.marginBottom='6px'; panel.appendChild(h);
              const tbl = document.createElement('table'); tbl.style.width='100%'; tbl.style.borderCollapse='collapse'; const thead = document.createElement('thead'); const tr = document.createElement('tr'); ['idx','title','count'].forEach(cn=>{ const th=document.createElement('th'); th.textContent=cn; th.style.textAlign='left'; th.style.padding='4px'; tr.appendChild(th); }); thead.appendChild(tr); tbl.appendChild(thead); const tbody = document.createElement('tbody'); (resp.counts||[]).forEach(r=>{ const tr2=document.createElement('tr'); ['chapter_idx','title','count'].forEach(k=>{ const td=document.createElement('td'); td.textContent = r[k]; td.style.padding='4px'; tr2.appendChild(td); }); tbody.appendChild(tr2); }); tbl.appendChild(tbody); panel.appendChild(tbl); bodyEl.appendChild(panel);
            } catch(err) { console.error('token_by_chapter exception', err); showUIError('Ошибка при запросе token_by_chapter', String(err), { token: w.text, book }); }
          });
          g.appendChild(textEl);
        });
      }
    } catch (e) {
      console.error('cloud generation exception', e);
      showUIError('Ошибка при генерации облака', String(e), { book });
      cloudWrap.innerHTML = 'Ошибка: ' + String(e);
    }
  })();
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
      // prefer currentFile, fallback to rawSelect, else try to select first available raw via api
      let book = '';
      try { book = (document.getElementById('currentFile').innerText || '').replace(/\.txt$/i, ''); } catch(e){}
      if (!book) {
        try { const sel = document.getElementById('rawSelect'); if (sel && sel.value) book = sel.value.replace(/\.txt$/i,''); } catch(e){}
      }
      if (!book) {
        try {
          const rf = await api('/api/raw_files');
          const files = (rf && rf.files) || [];
          if (files.length) { book = files[0].replace(/\.txt$/i,'');
            // set UI selection
            try { const sel = document.getElementById('rawSelect'); if (sel) { sel.value = files[0]; sel.dispatchEvent(new Event('change')); } } catch(e){}
          }
        } catch(e) { console.error('raw_files fetch failed', e); }
      }
      if (!book) {
        showUIError('Книга не выбрана', 'Не удалось определить книгу (выберите файл слева в селекте)');
        return;
      }
      try {
        // open the cloud tab right away; cloud generation will populate it
        await showCloudInline(book);
      } catch (e) { console.error(e); showUIError('Ошибка при показе облака', String(e)); }
    });
    genCloudBtn && genCloudBtn.addEventListener('click', async ()=>{
      const book = document.getElementById('currentFile').innerText.replace(/\.txt$/i, '') || '';
      if (!book) { alert('Выберите файл/книгу сначала'); return; }
      try {
        const res = await api('/api/cloud_generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({book: book}) });
        if (res && res.error) { showUIError('Ошибка генерации облака', res.error || JSON.stringify(res), { endpoint: '/api/cloud_generate', book }); return; }
        // poll for output
        const statusMsg = document.getElementById('content');
        if (statusMsg) { statusMsg.innerHTML = 'Генерация облака запущена, ожидаю результата...'; }
        const start = Date.now();
        const timeout = 120000; // 2 min
        let shown = false;
        while (Date.now() - start < timeout) {
          await new Promise(r => setTimeout(r, 2000));
          const figs = await api('/api/figures?book=' + encodeURIComponent(book));
          if (figs && !figs.error) {
            const pngs = (figs.files||[]).filter(n=>n.toLowerCase().endsWith('.png'));
            if (pngs.length) { await showCloudInline(book); shown = true; break; }
          } else if (figs && figs.error) {
            showUIError('Ошибка при опросе списка фигур', figs.error, { endpoint: '/api/figures', book });
            break;
          }
        }
        if (!shown) showUIError('Таймаут генерации облака', 'Генерация не завершилась за 2 минуты. Проверьте outputs/' + book + '/cloud_generation.log', { book });
      } catch (e) { showUIError('Исключение при генерации облака', String(e), { endpoint: '/api/cloud_generate', book }); }
    });
  } catch(e) { /* ignore */ }
});

// expose for non-module fallback
window.loadBookFiles = loadBookFiles;
window.loadRawIntoEditor = loadRawIntoEditor;
window.populateRawSelect = populateRawSelect;
window.runAnalysisAction = runAnalysisAction;
// expose cloud helpers for inline usage and eruda console
try { window.showCloudInline = showCloudInline; window.showUIError = showUIError; } catch (e) { /* ignore */ }