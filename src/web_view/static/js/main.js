import { renderTopbar } from './ui/topbar.js'
import { initRouter } from './router.js'

function mount(){
  renderTopbar(document.getElementById('topbar'))
  initRouter()
}

mount()
