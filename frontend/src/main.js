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
  `
  renderTopbar(document.getElementById('topbar'))
  initRouter()
}

mount()
