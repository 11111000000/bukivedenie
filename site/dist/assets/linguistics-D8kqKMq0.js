import{i as C}from"./wordCloud-BzR7R2DZ.js";/* empty css              */const S="./data",M=["tolstoj_lew_nikolaewich-text_1","tolstoj_lew_nikolaewich-text_2","tolstoj_lew_nikolaewich-text_3","tolstoj_lew_nikolaewich-text_4","чехов-письмо"],$=document.querySelector("#app");$.innerHTML=`
  <div class="shell">
    <header class="topbar">
      <div class="title-row">
        <div>
          <h1>Лингвистический атлас книг</h1>
          <p>Статическая витрина outputs без backend, с локальными данными и graceful degradation.</p>
        </div>
        <div class="status" id="status">Загрузка каталога...</div>
      </div>
      <div class="controls">
        <label>
          Книга
          <select id="book-select"></select>
        </label>
        <label>
          Top-N токенов
          <input id="top-n" type="range" min="10" max="40" step="5" value="20" />
        </label>
        <div class="status" id="book-meta"></div>
      </div>
      <div class="cards" id="summary-cards"></div>
    </header>

    <section class="grid">
      <article class="panel full">
        <h2>Частотное ядро</h2>
        <div id="wordcloud" class="viz tall"></div>
      </article>
      <article class="panel">
        <h2>Top tokens</h2>
        <div id="tokens" class="viz"></div>
      </article>
      <article class="panel">
        <h2>Ритм по главам</h2>
        <div id="chapters" class="viz"></div>
      </article>
      <article class="panel">
        <h2>Тональность по главам</h2>
        <div id="sentiment" class="viz"></div>
      </article>
      <article class="panel full">
        <h2>Персонажи и связи</h2>
        <div id="network" class="viz tall"></div>
      </article>
      <article class="panel">
        <h2>Персонажи</h2>
        <div class="scroll-panel" id="characters-table"></div>
      </article>
      <article class="panel">
        <h2>Hapax</h2>
        <div class="scroll-panel" id="hapax-table"></div>
      </article>
      <article class="panel">
        <h2>Метаданные прогона</h2>
        <div class="scroll-panel" id="metadata-table"></div>
      </article>
      <article class="panel">
        <h2>Пунктуация</h2>
        <div id="punctuation" class="viz"></div>
      </article>
      <article class="panel">
        <h2>Стиль: radar</h2>
        <div id="style-radar" class="viz"></div>
      </article>
      <article class="panel full">
        <h2>Главы: words × sentences</h2>
        <div id="chapter-scatter" class="viz"></div>
      </article>
      <article class="panel full">
        <h2>Персонажи × главы</h2>
        <div id="character-heatmap" class="viz tall"></div>
      </article>
      <article class="panel full">
        <h2>Токены × главы</h2>
        <div id="token-heatmap" class="viz tall"></div>
      </article>
      <article class="panel full">
        <h2>Zipf: rank × frequency</h2>
        <div id="zipf" class="viz"></div>
      </article>
    </section>
  </div>
`;const x=document.querySelector("#status"),b=document.querySelector("#book-select"),N=document.querySelector("#top-n"),j=document.querySelector("#book-meta"),z=document.querySelector("#summary-cards"),O=["wordcloud","tokens","chapters","sentiment","network","punctuation","style-radar","chapter-scatter","character-heatmap","token-heatmap","zipf"],h=Object.fromEntries(O.map(e=>[e,C(document.getElementById(e))]));let v=null;const k=new Map;function T(e){const t=[];let a=[],r="",s=!1;for(let o=0;o<e.length;o+=1){const c=e[o],i=e[o+1];if(s){c==='"'&&i==='"'?(r+='"',o+=1):c==='"'?s=!1:r+=c;continue}if(c==='"'){s=!0;continue}if(c===","){a.push(r),r="";continue}if(c===`
`){a.push(r),a.some(d=>String(d).trim()!=="")&&t.push(a),a=[],r="";continue}c!=="\r"&&(r+=c)}if((r.length||a.length)&&(a.push(r),a.some(o=>String(o).trim()!=="")&&t.push(a)),!t.length)return[];const l=t.shift().map(o=>String(o).trim());return t.map(o=>Object.fromEntries(l.map((c,i)=>[c,o[i]??""])))}async function E(e){const t=await fetch(e);if(!t.ok)throw new Error(`Не удалось загрузить ${e}: ${t.status}`);return t.text()}async function q(e){const t=await fetch(e);if(!t.ok)throw new Error(`Не удалось загрузить ${e}: ${t.status}`);const a=await t.text();try{return JSON.parse(a)}catch{const s=a.slice(0,80).replace(/\s+/g," ");throw new Error(`Некорректный JSON в ${e}: ${s}`)}}async function L(e){var l;if(k.has(e))return k.get(e);const t=`${S}/outputs/${encodeURIComponent(e)}`,a={},r=[["tokens",`${t}/tokens.csv`,"csv"],["chapters",`${t}/chapters_summary.json`,"json"],["complexity",`${t}/complexity_metrics.json`,"json"],["sentiment",`${t}/sentiment_by_chapter.csv`,"csv"],["cooccurrence",`${t}/cooccurrence_edges.csv`,"csv"],["characters",`${t}/characters.csv`,"csv"],["hapax",`${t}/hapax.csv`,"csv"],["charFreq",`${t}/character_freq_by_chapter.csv`,"csv"],["tokenFreq",`${t}/token_freq_by_chapter.csv`,"csv"],["punctuation",`${t}/punctuation_counts.csv`,"csv"],["metadata",`${t}/run_metadata.json`,"json"]];for(const[o,c,i]of r)try{a[o]=i==="json"?await q(c):T(await E(c))}catch(d){a[o]=null,a[`${o}Error`]=d}const s={tokens:Array.isArray(a.tokens)?a.tokens:[],chapters:Array.isArray((l=a.chapters)==null?void 0:l.chapters)?a.chapters.chapters:Array.isArray(a.chapters)?a.chapters:[],complexity:a.complexity&&typeof a.complexity=="object"?a.complexity:{},sentiment:Array.isArray(a.sentiment)?a.sentiment:[],cooccurrence:Array.isArray(a.cooccurrence)?a.cooccurrence:[],characters:Array.isArray(a.characters)?a.characters:[],hapax:Array.isArray(a.hapax)?a.hapax:[],charFreq:Array.isArray(a.charFreq)?a.charFreq:[],tokenFreq:Array.isArray(a.tokenFreq)?a.tokenFreq:[],punctuation:Array.isArray(a.punctuation)?a.punctuation:[],metadata:a.metadata&&typeof a.metadata=="object"?a.metadata:{}};return k.set(e,s),s}function g(e,t){return Array.isArray(e)?e.slice(0,t).filter(Boolean):[]}function m(e){return Array.isArray(e)?e:e&&Array.isArray(e.chapters)?e.chapters:e&&Array.isArray(e.rows)?e.rows:e&&typeof e=="object"?Object.values(e):[]}function B(e){return[["total_words","Слов"],["unique_words","Уникальных"],["hapax_count","Hapax"],["dis_legomena","Dis legomena"],["lexical_density","Плотность"],["avg_sentence_length","Длина предложения"]].map(([a,r])=>({label:r,value:(e==null?void 0:e[a])??"—"}))}function F(e,t){z.innerHTML=B(e).map(({label:a,value:r})=>`<div class="card"><div class="label">${a}</div><div class="value">${r}</div></div>`).join(""),j.textContent=t}function w(e,t,a){const r=m(t);if(!r.length){e.innerHTML='<div class="muted" style="padding:12px">Нет данных</div>';return}e.innerHTML=`
    <table>
      <thead><tr>${a.map(s=>`<th>${s}</th>`).join("")}</tr></thead>
      <tbody>
        ${r.map(s=>`<tr>${a.map(l=>`<td>${String(s[l]??"")}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `}function H(e){const t=g(m(e),80).map(a=>({name:a.token,value:Number(a.count||a.frequency||0)}));h.wordcloud.setOption({tooltip:{},series:[{type:"wordCloud",shape:"circle",gridSize:10,sizeRange:[14,60],rotationRange:[-45,45],textStyle:{color:()=>`hsl(${Math.floor(Math.random()*360)}, 50%, 38%)`},data:t}]})}function R(e,t){const a=g(m(e),t);h.tokens.setOption({tooltip:{trigger:"axis",axisPointer:{type:"shadow"}},grid:{left:120,right:16,top:10,bottom:24},xAxis:{type:"value"},yAxis:{type:"category",data:a.map(r=>r.token),inverse:!0},series:[{type:"bar",data:a.map(r=>Number(r.count||0)),itemStyle:{color:"#3558a6"}}]})}function I(e){const t=m(e),a=t.map(r=>`Г${r.chapter_idx??r.chapter??""}`);h.chapters.setOption({tooltip:{trigger:"axis"},legend:{data:["Слова","Sentences","Dialogue %"]},grid:{left:50,right:24,top:32,bottom:24},xAxis:{type:"category",data:a},yAxis:[{type:"value",name:"count"},{type:"value",name:"%",max:100}],series:[{name:"Слова",type:"bar",data:t.map(r=>Number(r.total_words||0)),itemStyle:{color:"#3558a6"}},{name:"Sentences",type:"line",data:t.map(r=>Number(r.total_sentences||0)),smooth:!0,yAxisIndex:0,color:"#7a4fd7"},{name:"Dialogue %",type:"line",data:t.map(r=>Number((r.dialog_ratio||0)*100)),smooth:!0,yAxisIndex:1,color:"#0c8f6a"}]})}function D(e){const t=m(e);h.sentiment.setOption({tooltip:{trigger:"axis"},grid:{left:50,right:16,top:18,bottom:24},xAxis:{type:"category",data:t.map(a=>`Г${a.chapter_idx??""}`)},yAxis:{type:"value"},series:[{type:"line",data:t.map(a=>Number(a.avg_score||a.total_score||0)),smooth:!0,areaStyle:{opacity:.12},lineStyle:{width:3,color:"#7a4fd7"},itemStyle:{color:"#7a4fd7"}}]})}function J(e){const t=g(m(e),20);h.punctuation.setOption({tooltip:{trigger:"axis",axisPointer:{type:"shadow"}},grid:{left:60,right:18,top:10,bottom:24},xAxis:{type:"category",data:t.map(a=>a.punct)},yAxis:{type:"value"},series:[{type:"bar",data:t.map(a=>Number(a.count||0)),itemStyle:{color:"#0c8f6a"}}]})}function P(e){h["style-radar"].setOption({tooltip:{},radar:{indicator:[{name:"Yule",max:1e3},{name:"Honore",max:500},{name:"Density",max:1},{name:"Sentence",max:40}]},series:[{type:"radar",data:[{value:[Number((e==null?void 0:e.yules_k)||0),Number((e==null?void 0:e.honores_r)||0),Number((e==null?void 0:e.lexical_density)||0),Number((e==null?void 0:e.avg_sentence_length)||0)],name:"Стиль"}],areaStyle:{opacity:.15},lineStyle:{color:"#3558a6"}}]})}function K(e){const t=m(e);h["chapter-scatter"].setOption({tooltip:{trigger:"item"},grid:{left:48,right:24,top:18,bottom:32},xAxis:{type:"value",name:"words"},yAxis:{type:"value",name:"sentences"},series:[{type:"scatter",symbolSize:a=>Math.max(6,Math.min(22,a[2]/5)),data:t.map(a=>[Number(a.total_words||0),Number(a.total_sentences||0),Number(a.dialog_ratio||0)*100]),itemStyle:{color:"#7a4fd7"}}]})}function Z(e,t){var d;const a=m(e),r=m(t),l=g(a.slice().sort((n,p)=>Number(p.occurrences||0)-Number(n.occurrences||0)),12).map(n=>n.name||n.name_lower).filter(Boolean),o=r.map(n=>`Г${n.chapter_idx??""}`),c=new Map(l.map((n,p)=>[String(n).toLowerCase(),p])),i=[];for(const n of a){const p=n.name||n.name_lower,f=c.get(String(p||"").toLowerCase());if(f===void 0)continue;const y=Number(n.chapter_idx||0),u=r.length&&((d=r[0])==null?void 0:d.chapter_idx)===0?y:y-1;o[u]&&i.push([u,f,Number(n.count||0)])}h["character-heatmap"].setOption({tooltip:{position:"top"},grid:{left:110,right:18,top:16,bottom:34},xAxis:{type:"category",data:o,splitArea:{show:!0}},yAxis:{type:"category",data:l,splitArea:{show:!0}},visualMap:{min:0,max:Math.max(1,...i.map(n=>n[2])),calculable:!0,orient:"horizontal",left:"center",bottom:0},series:[{type:"heatmap",data:i,label:{show:!1},emphasis:{itemStyle:{shadowBlur:10,shadowColor:"rgba(0, 0, 0, 0.2)"}}}]})}function U(e,t){var d;const a=m(e),r=m(t),l=g(a.slice().sort((n,p)=>Number(p.count||0)-Number(n.count||0)),14).map(n=>n.token||n.name).filter(Boolean),o=r.map(n=>`Г${n.chapter_idx??""}`),c=new Map(l.map((n,p)=>[String(n).toLowerCase(),p])),i=[];for(const n of a){const p=n.token||n.name,f=c.get(String(p||"").toLowerCase());if(f===void 0)continue;const y=Number(n.chapter_idx||0),u=r.length&&((d=r[0])==null?void 0:d.chapter_idx)===0?y:y-1;o[u]&&i.push([u,f,Number(n.count||0)])}h["token-heatmap"].setOption({tooltip:{position:"top"},grid:{left:110,right:18,top:16,bottom:34},xAxis:{type:"category",data:o,splitArea:{show:!0}},yAxis:{type:"category",data:l,splitArea:{show:!0}},visualMap:{min:0,max:Math.max(1,...i.map(n=>n[2])),calculable:!0,orient:"horizontal",left:"center",bottom:0},series:[{type:"heatmap",data:i,label:{show:!1},emphasis:{itemStyle:{shadowBlur:10,shadowColor:"rgba(0, 0, 0, 0.2)"}}}]})}function V(e){const a=m(e).map(r=>({token:r.token||r.name,count:Number(r.count||r.frequency||0),rank:Number(r.rank||0)})).filter(r=>r.token&&r.count>0).slice().sort((r,s)=>s.count-r.count).map((r,s)=>({...r,rank:r.rank||s+1}));h.zipf.setOption({tooltip:{trigger:"axis"},grid:{left:60,right:18,top:18,bottom:40},xAxis:{type:"log",name:"rank",minorTick:{show:!0}},yAxis:{type:"log",name:"frequency",minorTick:{show:!0}},series:[{type:"scatter",symbolSize:6,data:a.map(r=>[Math.max(1,r.rank),Math.max(1,r.count),r.token]),itemStyle:{color:"#3558a6"},encode:{x:0,y:1,tooltip:[2,0,1]}}]})}function W(e,t){const a=m(e),r=m(t),s=new Map;for(const i of r.slice(0,30)){const d=i.name||i.name_lower;d&&s.set(String(d).toLowerCase(),{name:d,value:Number(i.occurrences||1)})}const l=[],o=new Map,c=[];for(const i of a.slice(0,140)){const d=i.source||i.source_lower,n=i.target||i.target_lower,p=Number(i.weight||0);if(!(!d||!n||!p)){for(const f of[d,n]){const y=String(f).toLowerCase();if(!o.has(y)){const u=s.get(y),A={name:(u==null?void 0:u.name)||f,value:(u==null?void 0:u.value)||1,symbolSize:Math.max(10,Math.min(40,(u==null?void 0:u.value)||p)),itemStyle:{color:"#3558a6"}};o.set(y,A),l.push(A)}}c.push({source:d,target:n,value:p,lineStyle:{width:Math.max(1,Math.min(8,p/2))}})}}h.network.setOption({tooltip:{},series:[{type:"graph",layout:"force",roam:!0,data:l,links:c,force:{repulsion:120,edgeLength:80},label:{show:!0,position:"right"},emphasis:{focus:"adjacency"}}]})}async function _(e){var l,o,c;x.textContent=`Загружаю ${e}...`;const t=await L(e),a=t.complexity||{},r=Number(N.value||20);F(a,e),H(t.tokens||[]),R(t.tokens||[],r),I(t.chapters||[]),D(t.sentiment||[]),W(t.cooccurrence||[],t.characters||[]),J(t.punctuation||[]),P(a),K(t.chapters||[]),Z(t.charFreq||[],t.chapters||[]),U(t.tokenFreq||[],t.chapters||[]),V(t.tokens||[]),w(document.querySelector("#characters-table"),g(t.characters||[],80),["name","occurrences","num_chapters","context_sample"]),w(document.querySelector("#hapax-table"),g(t.hapax||[],120),["token","count"]),w(document.querySelector("#metadata-table"),t.metadata?[{key:"book_id",value:t.metadata.book_id},{key:"start_time",value:t.metadata.start_time},{key:"end_time",value:t.metadata.end_time},{key:"duration_seconds",value:t.metadata.duration_seconds},{key:"lang",value:(l=t.metadata.config)==null?void 0:l.lang},{key:"ner_mode",value:(o=t.metadata.config)==null?void 0:o.ner_mode},{key:"sentiment_mode",value:(c=t.metadata.config)==null?void 0:c.sentiment_mode}]:[],["key","value"]);const s=[t.tokensError,t.chaptersError,t.complexityError,t.punctuationError,t.charFreqError,t.metadataError].filter(Boolean);x.textContent=s.length?`Загружено с пропусками: ${s.length}`:"Готово"}async function Y(){try{try{v=await q(`${S}/index.json`)}catch{v=null,x.textContent="Каталог не прочитан, использую запасной список"}const e=Array.isArray(v==null?void 0:v.books)&&v.books.length?v.books:M.map(t=>({id:t,title:t}));b.innerHTML=e.map(t=>`<option value="${t.id}">${t.title||t.id}</option>`).join(""),b.addEventListener("change",()=>_(b.value)),N.addEventListener("input",()=>{b.value&&_(b.value)}),await _(e[0].id)}catch(e){x.textContent="Ошибка запуска витрины",$.insertAdjacentHTML("afterbegin",`<div class="error">${e.message}</div>`)}}window.addEventListener("resize",()=>{Object.values(h).forEach(e=>e.resize())});Y();
