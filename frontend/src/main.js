// Minimal vanilla entry: hash router + topbar + initial view
import { initRouter } from './router.js'
import { renderTopbar } from './ui/topbar.js'

function mount() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <header class="container">
      <div id="topbar"></div>
    </header>
    <main class="container" id="view"></main>
    <aside id="logs" style="position:fixed; left:8px; bottom:8px; width:320px; max-height:40vh; overflow:auto; background:rgba(255,255,255,0.95); border:1px solid rgba(0,0,0,0.06); box-shadow:0 6px 18px rgba(0,0,0,0.06); padding:8px; display:none; z-index:99998; font-size:13px;"></aside>
  `
  renderTopbar(document.getElementById('topbar'))
  initRouter()
}

mount()
