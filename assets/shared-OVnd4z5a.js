import{i as f}from"./wordCloud-BzR7R2DZ.js";const u="Bukivedenie",h=[{href:"./index.html",label:"Лингвистика"},{href:"./war-and-peace.html",label:"Война и мир"}];function p({title:t,subtitle:e,controls:n="",aside:i=""}){return`
    <div class="site-shell">
      <header class="site-header">
        <div class="brand-row">
          <div>
            <div class="eyebrow">${u}</div>
            <h1>${t}</h1>
            <p>${e}</p>
          </div>
          <div class="header-aside">${i}</div>
        </div>
        <nav class="site-nav" aria-label="Основная навигация">
          ${h.map(r=>`<a class="nav-link" href="${r.href}">${r.label}</a>`).join("")}
        </nav>
        ${n?`<div class="site-controls">${n}</div>`:""}
      </header>
      <main class="site-main">
        <div id="app-main"></div>
      </main>
    </div>
  `}function m(t){const e=document.querySelector("#app");return e.innerHTML=t,document.querySelector("#app-main")}function v(t){const e=[];let n=[],i="",r=!1;for(let s=0;s<t.length;s+=1){const a=t[s],o=t[s+1];if(r){a==='"'&&o==='"'?(i+='"',s+=1):a==='"'?r=!1:i+=a;continue}if(a==='"'){r=!0;continue}if(a===","){n.push(i),i="";continue}if(a===`
`){n.push(i),n.some(l=>String(l).trim()!=="")&&e.push(n),n=[],i="";continue}a!=="\r"&&(i+=a)}if((i.length||n.length)&&(n.push(i),n.some(s=>String(s).trim()!=="")&&e.push(n)),!e.length)return[];const c=e.shift().map(s=>String(s).trim());return e.map(s=>Object.fromEntries(c.map((a,o)=>[a,s[o]??""])))}async function $(t){const e=await fetch(t);if(!e.ok)throw new Error(`Не удалось загрузить ${t}: ${e.status}`);return e.text()}async function w(t){const e=await fetch(t);if(!e.ok)throw new Error(`Не удалось загрузить ${t}: ${e.status}`);const n=await e.text();return JSON.parse(n)}function S(t){return f(t)}export{w as a,p as b,S as c,$ as f,m,v as p};
