#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import PPTX from 'pptxgenjs'

const prezaPath = path.resolve(new URL('.', import.meta.url).pathname, '..', 'preza.html')
const outPptx = path.resolve(new URL('.', import.meta.url).pathname, '..', 'preza.pptx')

function extractSlides(html) {
  // crude extraction: split by <section class="slide"> ... </section>
  // split by any <section ...> and include sections that have 'slide' in class name
  const parts = html.split(/<section[^>]*>/i).filter(p => /class=[\"''][^>]*\bslide\b[^>]*[\"']/.test(p) || p.includes('class="slide') ).map(p => p)
  const slides = parts.map(part => {
    const h2m = part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
    const title = h2m ? h2m[1].replace(/<[^>]+>/g,'').trim() : ''
    const imgm = part.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i)
    const img = imgm ? imgm[1].trim() : null
    const pm = part.match(/<p[^>]*class="caption"[^>]*>([\s\S]*?)<\/p>/i)
    const caption = pm ? pm[1].replace(/<[^>]+>/g,'').trim() : ''
    // preserve raw HTML fragment to detect class names
    return { title, img, caption, raw: part }
  })
  return slides
}

async function main(){
  const html = fs.readFileSync(prezaPath, 'utf8')
  const slides = extractSlides(html)
  const pres = new PPTX()
  pres.layout = 'LAYOUT_WIDE'

  for (const s of slides) {
    // choose template by presence of image and whether it's a cover
    const isCover = /cover-slide/.test(s.raw || '') || /class=["'][^>]*cover-slide/.test(s.raw || '')
    const slide = pres.addSlide()
    if (isCover) {
      // large centered title
      slide.addText(s.title || '', { x:0.5, y:1.2, w:9, h:1.6, fontSize:36, bold:true, align:'center', color:'363636' })
      if (s.caption) slide.addText(s.caption, { x:1, y:3.0, w:8, h:1.0, fontSize:14, color:'666666', align:'center' })
      continue
    }

    // content slide: title left, image right
    slide.addText(s.title || '', { x:0.5, y:0.2, w:8.5, h:0.8, fontSize:24, bold:true })
    if (s.img) {
      const imgPath = path.resolve(path.dirname(prezaPath), s.img)
      if (fs.existsSync(imgPath)) {
        // place image on right half
        slide.addImage({ path: imgPath, x:5.0, y:1.1, w:4.5, h:3.5 })
      }
    }
    if (s.caption) {
      slide.addText(s.caption, { x:0.5, y:4.9, w:8.5, h:0.6, fontSize:12, color:'666666' })
    }
  }

  await pres.writeFile({ fileName: outPptx })
  console.log('Wrote PPTX to', outPptx)
}

main().catch(err => { console.error(err); process.exit(2) })
