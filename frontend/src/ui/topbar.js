export function renderTopbar(el){
  el.innerHTML = `
    <nav style="display:flex; gap:8px; align-items:center; padding:8px 0;">
      <a href="#/books" style="text-decoration:none; font-weight:600;">Книги</a>
      <span style="opacity:.6;">/</span>
      <a href="#/" style="text-decoration:none;">Главная</a>
      <span style="flex:1 1 auto;"></span>
      <a href="#/about" style="text-decoration:none; opacity:.8;">О проекте</a>
      <button id="dev-toggle" style="margin-left:8px; font-size:0.9rem; padding:4px 8px;">Dev</button>
    </nav>
  `

  const btn = el.querySelector('#dev-toggle')
  if(btn){
    btn.addEventListener('click', ()=>{
      const cur = localStorage.getItem('devtools') === '1'
      if(cur){
        localStorage.removeItem('devtools')
        btn.textContent = 'Dev'
        alert('Dev tools отключены; перезагрузите страницу')
      }else{
        localStorage.setItem('devtools','1')
        btn.textContent = 'Dev (on)'
        alert('Dev tools включены; перезагрузите страницу или откройте ?dev')
      }
    })
  } else {
    console.warn('Dev toggle button not found in topbar')
  }
}
