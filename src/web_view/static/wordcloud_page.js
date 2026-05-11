(async function(){
  // helpers
  async function api(path){
    try{ const r = await fetch(path); const ct = r.headers.get('content-type')||''; if (ct.includes('application/json')) return await r.json(); const txt = await r.text(); try{ return JSON.parse(txt); }catch(e){ return {error: txt}; } } catch(e){ return { error: String(e) }; }
  }

  const palette = window.WORDCLOUD_PALETTE || ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
  const container = document.getElementById('cloudContainer');
  const status = document.getElementById('status');
  const detail = document.getElementById('detail');

  function showDetail(title, counts){ detail.innerHTML = '<div class="token-detail"><strong>'+title+'</strong><pre>'+JSON.stringify(counts, null, 2)+'</pre></div>'; }

  status.innerText = 'Загрузка tokens.csv...';
  const parsed = await api('/api/file_parsed?book=test_book&name=tokens.csv');
  if (!parsed || parsed.error){ status.innerText = 'Не удалось загрузить tokens.csv: '+(parsed && parsed.error); return; }
  if (parsed.type !== 'csv'){ status.innerText = 'tokens.csv имеет неверный формат: '+parsed.type; return; }
  const headers = parsed.headers||[]; const rows = parsed.rows||[];
  let tokenIdx = headers.indexOf('token'); if (tokenIdx===-1) tokenIdx = headers.indexOf('word'); let countIdx = headers.indexOf('count'); if (countIdx===-1) countIdx = headers.indexOf('frequency');
  if (tokenIdx===-1){ status.innerText='tokens.csv не содержит столбца token'; return; }
  const items = [];
  for (const r of rows){ const tok = r[tokenIdx]; if (!tok) continue; let c = 1; if (countIdx!==-1){ const n = Number(r[countIdx]); if (!isNaN(n)) c = n; } items.push({text: String(tok), size: c}); }
  if (!items.length){ status.innerText='Нет токенов'; return; }
  items.sort((a,b)=>b.size - a.size);
  const top = items.slice(0,200);

  status.innerText = 'Генерация облака ('+top.length+' слов)...';

  // map count -> font size linearly
  const counts = top.map(x=>x.size); const maxC = Math.max(...counts); const minC = Math.min(...counts);
  const minFont = 12, maxFont = 72;
  function mapSize(v){ if (minC===maxC) return Math.round((minFont+maxFont)/2); return Math.round(minFont + (v-minC)/(maxC-minC)*(maxFont-minFont)); }

  const words = top.map((w,i)=>({text:w.text, size: mapSize(w.size), originalCount: w.size}));

  // prepare svg
  container.innerHTML = '';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('width','100%'); svg.setAttribute('height','100%'); svg.style.display='block'; svg.style.background='#fff'; svg.style.borderRadius='4px';
  container.appendChild(svg);
  const rect = container.getBoundingClientRect(); const width = Math.max(200, Math.floor(rect.width)); const height = Math.max(200, Math.floor(rect.height)); svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (!window.d3 || !window.d3.layout || !window.d3.layout.cloud){ status.innerText='d3-cloud не доступен, показываю простой список'; const div = document.createElement('div'); div.style.padding='8px'; words.forEach((w,i)=>{ const s = document.createElement('span'); s.textContent = w.text; s.style.fontSize = w.size+'px'; s.style.margin='6px'; s.style.color = palette[i%palette.length]; s.style.display='inline-block'; s.addEventListener('click', ()=>showDetail(w.text, [{count: w.originalCount}])); div.appendChild(s); }); container.appendChild(div); return; }

  const layout = window.d3.layout.cloud()
    .size([width, height])
    .words(words.map(w=>({text:w.text, size:w.size})))
    .padding(3)
    .rotate(()=>{ // variable rotation for chaos
      const r = Math.random(); if (r<0.2) return -90; if (r<0.5) return 0; if (r<0.8) return 90; return (Math.random()*40-20); })
    .font('Impact')
    .fontSize(d=>d.size)
    .spiral('archimedean')
    .on('end', draw);

  layout.start();

  function draw(placed){
    status.innerText = 'Облако готово';
    // clear
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const g = document.createElementNS(svgNS,'g'); g.setAttribute('transform', `translate(${width/2},${height/2})`);
    svg.appendChild(g);
    placed.forEach((w, idx)=>{
      const textEl = document.createElementNS(svgNS, 'text');
      textEl.setAttribute('text-anchor','middle');
      textEl.setAttribute('transform', `translate(${w.x},${w.y}) rotate(${w.rotate})`);
      textEl.setAttribute('font-size', String(w.size));
      textEl.setAttribute('font-family','Impact, Arial');
      textEl.setAttribute('fill', palette[idx % palette.length]);
      textEl.style.cursor = 'pointer';
      textEl.textContent = w.text;
      textEl.addEventListener('click', async ()=>{
        // try fetch token_by_chapter
        try{
          const resp = await api('/api/token_by_chapter?book=test_book&token='+encodeURIComponent(w.text));
          showDetail(w.text, resp && resp.counts ? resp.counts : [{count: 'n/a'}]);
        }catch(e){ showDetail(w.text, [{error: String(e)}]); }
      });
      g.appendChild(textEl);
    });
  }
})();
