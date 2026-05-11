(function(){
  // Simple fallback to populate select and files list if module fails
  async function fetchJson(u){ try{ const r=await fetch(u); return await r.json(); } catch(e){ return null; } }
  const sel = document.getElementById('rawSelect');
  if (!sel) return;
  fetchJson('/api/raw_files').then(j=>{
    const raws = (j && j.files) || [];
    sel.innerHTML = '';
    raws.forEach(n=>{ const o=document.createElement('option'); o.value=n; o.innerText=n; sel.appendChild(o); });
    sel.addEventListener('change', async ()=>{
      const v = sel.value; if(!v) return;
      try{
        const r = await fetch('/api/raw?name='+encodeURIComponent(v));
        const j2 = await r.json(); document.getElementById('rawEditor').value = j2.content || '';
        document.getElementById('currentFile').innerText = v;
      }catch(e){ console.warn(e); }
      try{
        const f = await fetch('/api/files?book='+encodeURIComponent(v.replace(/\.txt$/i,'')));
        const fj = await f.json(); const files = fj.files || [];
        const cont = document.getElementById('filesContainer'); cont.innerHTML = '';
        files.forEach(fn=>{ const d=document.createElement('div'); d.style.margin='6px 0'; const a=document.createElement('a'); a.href='/api/file?book='+encodeURIComponent(v.replace(/\.txt$/i,''))+'&name='+encodeURIComponent(fn); a.textContent=fn; a.target='_blank'; d.appendChild(a); cont.appendChild(d); });
      }catch(e){ console.warn('files load failed', e); }
    });
    if(raws.length>0){ sel.value = raws[0]; sel.dispatchEvent(new Event('change')); }
  }).catch(e=>console.warn('raw_files fetch failed', e));
})();
