import{i as f}from"./wordCloud-BzR7R2DZ.js";const h="Bukivedenie",u=[{href:"./index.html",label:"Лингвистика"},{href:"./prez.html",label:"Презентация"},{href:"./war-and-peace.html",label:"Война и мир"}];function p({title:t,subtitle:e,controls:n="",aside:i=""}){return`
    <div class="site-shell">
      <header class="site-header">
        <div class="brand-row">
          <div>
            <div class="eyebrow">${h}</div>
            <h1>${t}</h1>
            <p>${e}</p>
          </div>
          <div class="header-aside">${i}</div>
        </div>
        <nav class="site-nav" aria-label="Основная навигация">
          ${u.map(r=>`<a class="nav-link" href="${r.href}">${r.label}</a>`).join("")}
        </nav>
        ${n?`<div class="site-controls">${n}</div>`:""}
      </header>
      <main class="site-main">
        <div id="app-main"></div>
      </main>
    </div>
  `}function m(t){const e=document.querySelector("#app");return e.innerHTML=t,document.querySelector("#app-main")}function v(t){const e=[];let n=[],i="",r=!1;for(let s=0;s<t.length;s+=1){const a=t[s],l=t[s+1];if(r){a==='"'&&l==='"'?(i+='"',s+=1):a==='"'?r=!1:i+=a;continue}if(a==='"'){r=!0;continue}if(a===","){n.push(i),i="";continue}if(a===`
`){n.push(i),n.some(c=>String(c).trim()!=="")&&e.push(n),n=[],i="";continue}a!=="\r"&&(i+=a)}if((i.length||n.length)&&(n.push(i),n.some(s=>String(s).trim()!=="")&&e.push(n)),!e.length)return[];const o=e.shift().map(s=>String(s).trim());return e.map(s=>Object.fromEntries(o.map((a,l)=>[a,s[l]??""])))}async function $(t){const e=await fetch(t);if(!e.ok)throw new Error(`Не удалось загрузить ${t}: ${e.status}`);return e.text()}async function w(t){const e=await fetch(t);if(!e.ok)throw new Error(`Не удалось загрузить ${t}: ${e.status}`);const n=await e.text();return JSON.parse(n)}function S(t){return f(t)}export{w as a,p as b,S as c,$ as f,m,v as p};
