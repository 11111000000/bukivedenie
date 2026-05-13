#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import PPTX from 'pptxgenjs'

const prezaPath = path.resolve(new URL('.', import.meta.url).pathname, '..', 'preza.html')
const outPptx = path.resolve(new URL('.', import.meta.url).pathname, '..', 'preza.pptx')

function extractSlides(html) {
  // crude extraction: split by <section class="slide"> ... </section>
  const parts = html.split(/<section[^>]*class="slide"[^>]*>/i).slice(1)
  const slides = parts.map(part => {
    const h2m = part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
    const title = h2m ? h2m[1].replace(/<[^>]+>/g,'').trim() : ''
    const imgm = part.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i)
    const img = imgm ? imgm[1].trim() : null
    const pm = part.match(/<p[^>]*class="caption"[^>]*>([\s\S]*?)<\/p>/i)
    const caption = pm ? pm[1].replace(/<[^>]+>/g,'').trim() : ''
    return { title, img, caption }
  })
  return slides
}

async function main(){
  const html = fs.readFileSync(prezaPath, 'utf8')
  const slides = extractSlides(html)
  const pres = new PPTX()
  pres.layout = 'LAYOUT_WIDE'

  for (const s of slides) {
    const slide = pres.addSlide()
    // title
    slide.addText(s.title || '', { x:0.5, y:0.25, w:9, h:0.6, fontSize:24, bold:true })
    // image if exists
    if (s.img) {
      // resolve relative path
      const imgPath = path.resolve(path.dirname(prezaPath), s.img)
      if (fs.existsSync(imgPath)) {
        slide.addImage({ path: imgPath, x:0.5, y:1.1, w:9, h:4.5 })
      }
    }
    // caption
    if (s.caption) {
      slide.addText(s.caption, { x:0.5, y:5.8, w:9, h:1.2, fontSize:12 })
    }
  }

  await pres.writeFile({ fileName: outPptx })
  console.log('Wrote PPTX to', outPptx)
}

main().catch(err => { console.error(err); process.exit(2) })
