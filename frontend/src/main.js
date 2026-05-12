// Minimal vanilla entry: hash router + topbar + initial view
import { initRouter } from './router.js'
import { renderTopbar } from './ui/topbar.js'

function mount() {
  let app = document.getElementById('app')
  if(!app){
    // If #app missing (different index.html or server), create it to avoid crashing
    console.warn('No #app element found — creating one dynamically')
    app = document.createElement('div')
    app.id = 'app'
    // Prefer to prepend so it's before any overlay buttons
    document.body && document.body.prepend ? document.body.prepend(app) : document.documentElement.appendChild(app)
  }

  try{
    app.innerHTML = `
      <header class="container">
        <div id="topbar"></div>
      </header>
      <main class="container" id="view"></main>
      <aside id="logs" style="position:fixed; left:8px; bottom:8px; width:320px; max-height:40vh; overflow:auto; background:rgba(255,255,255,0.95); border:1px solid rgba(0,0,0,0.06); box-shadow:0 6px 18px rgba(0,0,0,0.06); padding:8px; display:none; z-index:99998; font-size:13px;"></aside>
    `
  }catch(e){
    console.error('Failed to set app.innerHTML', e)
  }

  try{
    const topbarEl = document.getElementById('topbar')
    if(topbarEl){
      renderTopbar(topbarEl)
    }else{
      console.warn('topbar element not found')
    }
  }catch(e){
    console.error('renderTopbar failed', e)
  }

  try{
    initRouter()
  }catch(e){
    console.error('initRouter failed', e)
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', mount)
}else{
  mount()
}
