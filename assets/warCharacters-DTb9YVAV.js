import"./wordCloud-BzR7R2DZ.js";/* empty css              */import{m as W,b as _,c as q,f,p as y}from"./shared-OVnd4z5a.js";W(_({title:"Война и мир — Персонажи (связи)",subtitle:"Семейные и брачные связи (force graph + таблица)",controls:`
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
      <div id="chart" class="viz tall"></div>
      <div id="hint" class="muted" style="padding-top:10px">Клик по узлу: подсветка соседей, справа список и таблица.</div>
    </article>
    <article class="panel">
      <h2>Персонажи</h2>
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
`;const v=q(document.getElementById("chart")),M=document.getElementById("q"),T=document.getElementById("gender"),x=document.getElementById("rel"),k=document.getElementById("rows"),E=document.getElementById("picked"),w={nodes:"./data/war-and-peace/wp_characters_nodes.csv",edges:"./data/war-and-peace/wp_character_edges.csv",fallbackEdges:"./data/outputs/tolstoj_lew_nikolaewich-text_1/cooccurrence_edges.csv"};function $(r){const a=String(r||"").toLowerCase();return a.startsWith("rostov")||a.startsWith("rostova")?"Ростовы":a.startsWith("bolkonsky")||a.startsWith("bolkonskaya")?"Болконские":a.startsWith("bezukhov")?"Безуховы":a.startsWith("kuragin")||a.startsWith("kuragina")?"Курагины":a.startsWith("drubetskoy")||a.startsWith("drubetskaya")?"Друбецкие":a.startsWith("karagina")?"Карагины":"Прочие"}function C(r){return String(r||"").trim().replace(/\s*#.*$/,"").trim().split(/\s+/)[0]}function c(r){return String(r||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function I(r,a){const o=new Map(r.map(e=>[e.id,e])),s=new Map;for(const e of a)s.set(e.source,(s.get(e.source)||0)+1),s.set(e.target,(s.get(e.target)||0)+1);return{byId:o,deg:s}}function z({nodes:r,edges:a},{q:o,gender:s,rel:e}){const i=String(o||"").trim().toLowerCase();let l=r;s&&(l=l.filter(t=>(t.gender||"").trim()===s)),i&&(l=l.filter(t=>(t.name||"").toLowerCase().includes(i)||(t.id||"").toLowerCase().includes(i)));const d=new Set(l.map(t=>t.id));let n=a.filter(t=>d.has(t.source)&&d.has(t.target));e&&(n=n.filter(t=>t.type===e));const u=new Set;for(const t of n)u.add(t.source),u.add(t.target);return l=l.filter(t=>u.has(t.id)||l.length<=30&&d.has(t.id)),{nodes:l,edges:n}}function B(r,a,o){const s=r.slice().sort((e,i)=>(a.get(i.id)||0)-(a.get(e.id)||0)||String(e.name).localeCompare(String(i.name),"ru"));k.innerHTML=s.map(e=>`
        <tr data-id="${c(e.id)}" style="cursor:pointer">
          <td>${c(e.name)}</td>
          <td>${c(e.gender)}</td>
          <td>${c(e.group)}</td>
          <td class="muted">${c(e.remark)}</td>
          <td>${a.get(e.id)||0}</td>
        </tr>
      `).join(""),k.querySelectorAll("tr[data-id]").forEach(e=>{e.addEventListener("click",()=>o(e.getAttribute("data-id")))})}function H({nodes:r,edges:a},{deg:o,pickedId:s}){const e=Array.from(new Set(r.map(n=>n.group))),i=new Map(e.map((n,u)=>[n,u])),l=r.map(n=>{const u=o.get(n.id)||0,t=Math.max(10,Math.min(44,10+u*4));return{id:n.id,name:n.name,value:u,category:i.get(n.group)??0,symbolSize:t,itemStyle:s&&n.id===s?{borderColor:"#7a4fd7",borderWidth:3}:void 0}}),d=a.map(n=>({source:n.source,target:n.target,value:1,lineStyle:{color:n.type==="married"?"#7a4fd7":"#3558a6",width:n.type==="married"?2.5:1.5,opacity:.7}}));return{tooltip:{formatter:n=>n.dataType==="node"?`<b>${c(n.data.name)}</b><br/>deg: ${c(n.data.value)}`:""},legend:[{data:e,top:6}],series:[{type:"graph",layout:"force",roam:!0,data:l,links:d,categories:e.map(n=>({name:n})),label:{show:!0,position:"right"},force:{repulsion:160,edgeLength:90},emphasis:{focus:"adjacency"}}]}}function j(r,{byId:a},o){if(!r){E.innerHTML="";return}const s=a.get(r);if(!s)return;const e=o.filter(i=>i.source===r||i.target===r).map(i=>{const l=i.source===r?i.target:i.source,d=a.get(l),n=d?d.name:l;return`${i.type}: ${n}`});E.innerHTML=`<b>${c(s.name)}</b> <span class="muted">(${c(s.group)}, ${c(s.gender)})</span><br/><span class="muted">${c(s.remark)}</span>${e.length?"<br/>"+c(e.join(" | ")):""}`}function b(r="Нет данных"){L.innerHTML=`<div class="panel"><div class="muted" style="padding:12px">${c(r)}</div></div>`}let p=null,m=null,g="";async function F(){let r=[],a=[];try{const[e,i]=await Promise.all([f(w.nodes),f(w.edges)]);r=y(e),a=y(i)}catch{r=[],a=[]}let o=[],s=[];if(r.length&&a.length)o=r.map(e=>({id:String(e.id||"").trim(),name:String(e.name||"").trim(),gender:String(e.gender||"").trim(),remark:String(e.remark||"").trim()})).filter(e=>e.id&&e.name).map(e=>({...e,group:$(e.id)})),s=a.map(e=>({source:String(e.source||"").trim(),target:String(e.target||"").trim(),type:C(e.type)})).filter(e=>e.source&&e.target&&e.type);else try{const e=await f(w.fallbackEdges),l=y(e).map(t=>({source:String(t.source||t.source_lower||"").trim(),target:String(t.target||t.target_lower||"").trim(),weight:Number(t.weight||0)})).filter(t=>t.source&&t.target&&t.weight>0).slice(0,220),d=new Map;for(const t of l)d.set(t.source,(d.get(t.source)||0)+t.weight),d.set(t.target,(d.get(t.target)||0)+t.weight);const n=Array.from(d.entries()).sort((t,A)=>A[1]-t[1]).slice(0,70).map(([t])=>t),u=new Set(n);o=n.map(t=>({id:t,name:t,gender:"",remark:"",group:$(t)})),s=l.filter(t=>u.has(t.source)&&u.has(t.target)).map(t=>({source:t.source,target:t.target,type:"cooccur"}))}catch(e){b((e==null?void 0:e.message)||"Нет данных");return}if(!o.length||!s.length){b();return}p={nodes:o,edges:s},m=I(o,s),h()}function h(){if(!p||!m)return;const r=z(p,{q:M.value,gender:T.value,rel:x.value}),{deg:a,byId:o}=m,s=new Set(r.nodes.map(e=>e.id));g&&!s.has(g)&&(g=""),v.setOption(H(r,{deg:a,pickedId:g}),!0),B(r.nodes,a,e=>{g=e,h()}),j(g,{byId:o},r.edges)}v.on("click",r=>{var o;if(!m||!p||r.dataType!=="node")return;const a=(o=r.data)==null?void 0:o.id;a&&(g=a,h())});[M,T,x].forEach(r=>r.addEventListener("input",h));window.addEventListener("resize",()=>v.resize());F().catch(r=>b((r==null?void 0:r.message)||"Ошибка загрузки"));
