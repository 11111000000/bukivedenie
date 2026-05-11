import { viewBooks } from './views/booksList.js'
import { viewBookOverview } from './views/bookOverview.js'
import { viewFiles } from './views/filesList.js'
import { viewFile } from './views/fileViewer.js'
import { viewTokens } from './views/tokensChart.js'
import { viewWordCloud } from './views/wordCloud.js'
import { viewNetwork } from './views/networkGraph.js'
import { viewSentiment } from './views/sentimentChart.js'
import { viewHeatmap } from './views/heatmap.js'

function parseHash(){
  const h = location.hash || '#/books'
  const parts = h.slice(2).split('/')
  return parts
}

export function initRouter(){
  window.addEventListener('hashchange', render)
  render()
}

export function setView(html){
  const v = document.getElementById('view')
  v.innerHTML = html
}

async function render(){
  const p = parseHash()
  try{
    if(p[0] === '' || p[0] === 'books'){
      return viewBooks()
    }
    if(p[0] === 'book' && p[1]){
      const book = decodeURIComponent(p[1])
      if(p[2] === 'files') return viewFiles(book)
      if(p[2] === 'file' && p[3]) return viewFile(book, decodeURIComponent(p[3]))
      if(p[2] === 'viz' && p[3] === 'tokens') return viewTokens(book)
      if(p[2] === 'viz' && p[3] === 'wordcloud') return viewWordCloud(book)
      if(p[2] === 'viz' && p[3] === 'network') return viewNetwork(book)
      if(p[2] === 'viz' && p[3] === 'sentiment') return viewSentiment(book)
      if(p[2] === 'viz' && p[3] === 'heatmap') return viewHeatmap(book)
      return viewBookOverview(book)
    }
    setView('<div>Not found</div>')
  }catch(e){
    console.error(e)
    setView(`<pre style="white-space:pre-wrap;color:#c00;">${e?.message||e}</pre>`)
  }
}
