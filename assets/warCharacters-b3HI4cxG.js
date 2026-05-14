import{m as _,b as x,a as q,f,p as y}from"./shared-D2wSthDd.js";/* empty css              */_(x({title:"Война и мир — Персонажи (связи)",subtitle:"Сеть показывает, кто с кем чаще связан в тексте. Узлы крупнее у более заметных персонажей, а линии помогают увидеть силу пересечений и группировки.",controls:`
      <label>Поиск
        <input id="q" type="search" placeholder="Напр. Наташа" />
      </label>
      <label>Пол
        <select id="gender">
          <option value="">Все</option>
          <option value="F">F</option>
          <option value="M">M</option>
        </select>
      </label>
      <label>Связи
        <select id="rel">
          <option value="">Все</option>
          <option value="parent">parent</option>
          <option value="married">married</option>
        </select>
      </label>
    `}));const S=document.querySelector(".site-nav");S&&S.remove();const L=document.querySelector("#app-main");L.innerHTML=`
  <section class="grid">
    <article class="panel">
      <h2>Граф</h2>
      <p class="panel-desc">Сеть показывает, кто с кем чаще связан в тексте. Узлы крупнее у более заметных персонажей, а линии помогают увидеть силу пересечений и группировки.</p>
      <div id="chart" class="viz tall"></div>
      <div id="hint" class="panel-desc">Клик по узлу подсвечивает соседей и обновляет список справа.</div>
    </article>
    <article class="panel">
      <h2>Персонажи</h2>
      <p class="panel-desc">Таблица перечисляет персонажей, их пол, группу и заметки, а также помогает быстро найти самых связанных героев.</p>
      <div id="picked" class="muted" style="padding:0 0 10px"></div>
      <div class="scroll-panel">
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Пол</th>
              <th>Группа</th>
              <th class="muted">Примечание</th>
              <th>deg</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </article>
  </section>
`;const v=q(document.getElementById("chart")),M=document.getElementById("q"),T=document.getElementById("gender"),A=document.getElementById("rel"),k=document.getElementById("rows"),E=document.getElementById("picked"),w={nodes:"./data/war-and-peace/wp_characters_nodes.csv",edges:"./data/war-and-peace/wp_character_edges.csv",fallbackEdges:"./data/outputs/tolstoj_lew_nikolaewich-text_1/cooccurrence_edges.csv"};function $(r){const a=String(r||"").toLowerCase();return a.startsWith("rostov")||a.startsWith("rostova")?"Ростовы":a.startsWith("bolkonsky")||a.startsWith("bolkonskaya")?"Болконские":a.startsWith("bezukhov")?"Безуховы":a.startsWith("kuragin")||a.startsWith("kuragina")?"Курагины":a.startsWith("drubetskoy")||a.startsWith("drubetskaya")?"Друбецкие":a.startsWith("karagina")?"Карагины":"Прочие"}function C(r){return String(r||"").trim().replace(/\s*#.*$/,"").trim().split(/\s+/)[0]}function d(r){return String(r||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function I(r,a){const o=new Map(r.map(e=>[e.id,e])),s=new Map;for(const e of a)s.set(e.source,(s.get(e.source)||0)+1),s.set(e.target,(s.get(e.target)||0)+1);return{byId:o,deg:s}}function z({nodes:r,edges:a},{q:o,gender:s,rel:e}){const i=String(o||"").trim().toLowerCase();let l=r;s&&(l=l.filter(t=>(t.gender||"").trim()===s)),i&&(l=l.filter(t=>(t.name||"").toLowerCase().includes(i)||(t.id||"").toLowerCase().includes(i)));const c=new Set(l.map(t=>t.id));let n=a.filter(t=>c.has(t.source)&&c.has(t.target));e&&(n=n.filter(t=>t.type===e));const u=new Set;for(const t of n)u.add(t.source),u.add(t.target);return l=l.filter(t=>u.has(t.id)||l.length<=30&&c.has(t.id)),{nodes:l,edges:n}}function B(r,a,o){const s=r.slice().sort((e,i)=>(a.get(i.id)||0)-(a.get(e.id)||0)||String(e.name).localeCompare(String(i.name),"ru"));k.innerHTML=s.map(e=>`
        <tr data-id="${d(e.id)}" style="cursor:pointer">
          <td>${d(e.name)}</td>
          <td>${d(e.gender)}</td>
          <td>${d(e.group)}</td>
          <td class="muted">${d(e.remark)}</td>
          <td>${a.get(e.id)||0}</td>
        </tr>
      `).join(""),k.querySelectorAll("tr[data-id]").forEach(e=>{e.addEventListener("click",()=>o(e.getAttribute("data-id")))})}function H({nodes:r,edges:a},{deg:o,pickedId:s}){const e=Array.from(new Set(r.map(n=>n.group))),i=new Map(e.map((n,u)=>[n,u])),l=r.map(n=>{const u=o.get(n.id)||0,t=Math.max(10,Math.min(44,10+u*4));return{id:n.id,name:n.name,value:u,category:i.get(n.group)??0,symbolSize:t,itemStyle:s&&n.id===s?{borderColor:"#7a4fd7",borderWidth:3}:void 0}}),c=a.map(n=>({source:n.source,target:n.target,value:1,lineStyle:{color:n.type==="married"?"#7a4fd7":"#3558a6",width:n.type==="married"?2.5:1.5,opacity:.7}}));return{tooltip:{formatter:n=>n.dataType==="node"?`<b>${d(n.data.name)}</b><br/>deg: ${d(n.data.value)}`:""},legend:[{data:e,top:6}],series:[{type:"graph",layout:"force",roam:!0,data:l,links:c,categories:e.map(n=>({name:n})),label:{show:!0,position:"right"},force:{repulsion:160,edgeLength:90},emphasis:{focus:"adjacency"}}]}}function j(r,{byId:a},o){if(!r){E.innerHTML="";return}const s=a.get(r);if(!s)return;const e=o.filter(i=>i.source===r||i.target===r).map(i=>{const l=i.source===r?i.target:i.source,c=a.get(l),n=c?c.name:l;return`${i.type}: ${n}`});E.innerHTML=`<b>${d(s.name)}</b> <span class="muted">(${d(s.group)}, ${d(s.gender)})</span><br/><span class="muted">${d(s.remark)}</span>${e.length?"<br/>"+d(e.join(" | ")):""}`}function b(r="Нет данных"){L.innerHTML=`<div class="panel"><div class="panel-desc">${d(r)}</div></div>`}let g=null,m=null,p="";async function F(){let r=[],a=[];try{const[e,i]=await Promise.all([f(w.nodes),f(w.edges)]);r=y(e),a=y(i)}catch{r=[],a=[]}let o=[],s=[];if(r.length&&a.length)o=r.map(e=>({id:String(e.id||"").trim(),name:String(e.name||"").trim(),gender:String(e.gender||"").trim(),remark:String(e.remark||"").trim()})).filter(e=>e.id&&e.name).map(e=>({...e,group:$(e.id)})),s=a.map(e=>({source:String(e.source||"").trim(),target:String(e.target||"").trim(),type:C(e.type)})).filter(e=>e.source&&e.target&&e.type);else try{const e=await f(w.fallbackEdges),l=y(e).map(t=>({source:String(t.source||t.source_lower||"").trim(),target:String(t.target||t.target_lower||"").trim(),weight:Number(t.weight||0)})).filter(t=>t.source&&t.target&&t.weight>0).slice(0,220),c=new Map;for(const t of l)c.set(t.source,(c.get(t.source)||0)+t.weight),c.set(t.target,(c.get(t.target)||0)+t.weight);const n=Array.from(c.entries()).sort((t,W)=>W[1]-t[1]).slice(0,70).map(([t])=>t),u=new Set(n);o=n.map(t=>({id:t,name:t,gender:"",remark:"",group:$(t)})),s=l.filter(t=>u.has(t.source)&&u.has(t.target)).map(t=>({source:t.source,target:t.target,type:"cooccur"}))}catch(e){b((e==null?void 0:e.message)||"Нет данных");return}if(!o.length||!s.length){b();return}g={nodes:o,edges:s},m=I(o,s),h()}function h(){if(!g||!m)return;const r=z(g,{q:M.value,gender:T.value,rel:A.value}),{deg:a,byId:o}=m,s=new Set(r.nodes.map(e=>e.id));p&&!s.has(p)&&(p=""),v.setOption(H(r,{deg:a,pickedId:p}),!0),B(r.nodes,a,e=>{p=e,h()}),j(p,{byId:o},r.edges)}v.on("click",r=>{var o;if(!m||!g||r.dataType!=="node")return;const a=(o=r.data)==null?void 0:o.id;a&&(p=a,h())});[M,T,A].forEach(r=>r.addEventListener("input",h));window.addEventListener("resize",()=>v.resize());F().catch(r=>b((r==null?void 0:r.message)||"Ошибка загрузки"));
