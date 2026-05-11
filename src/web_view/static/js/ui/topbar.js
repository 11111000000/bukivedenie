export function renderTopbar(el){
  el.innerHTML = `
    <nav style="display:flex; gap:8px; align-items:center; padding:8px 0;">
      <a href="#/books" style="text-decoration:none; font-weight:600;">Книги</a>
      <span style="opacity:.6;">/</span>
      <a href="#/" style="text-decoration:none;">Главная</a>
      <span style="flex:1 1 auto;"></span>
      <a href="#/about" style="text-decoration:none; opacity:.8;">О проекте</a>
    </nav>
  `
}
