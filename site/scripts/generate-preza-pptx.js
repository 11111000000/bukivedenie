#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import PPTX from 'pptxgenjs'

const prezaPath = path.resolve(new URL('.', import.meta.url).pathname, '..', 'preza.html')
const outPptx = path.resolve(new URL('.', import.meta.url).pathname, '..', 'preza.pptx')

function extractSlides(html) {
  const slides = []
  const re = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi
  const clean = (value) => value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  let m
  while ((m = re.exec(html))) {
    const attrs = m[1] || ''
    if (!/\bclass\s*=\s*["'][^"']*\bslide\b[^"']*["']/i.test(attrs)) continue
    const raw = m[0]
    const body = m[2] || ''
    // Title: prefer h1 then h2 then h3
    const h1m = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const h2m = raw.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
    const h3m = raw.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)
    const title = (h1m || h2m || h3m) ? clean((h1m || h2m || h3m)[1]) : ''
    // Image (if any)
    const imgm = raw.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i)
    const img = imgm ? imgm[1].trim() : null
    // Caption: prefer <figcaption>, then p.caption, then p.muted
    const figm = body.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)
    const pcm = body.match(/<p[^>]*class=["']caption["'][^>]*>([\s\S]*?)<\/p>/i)
    const pmuted = body.match(/<p[^>]*class=["']muted["'][^>]*>([\s\S]*?)<\/p>/i)
    const caption = (figm && figm[1]) ? clean(figm[1]) : (pcm ? clean(pcm[1]) : (pmuted ? clean(pmuted[1]) : ''))
    // Extract visible paragraph and list text (excluding caption/muted).
    const blocks = []
    const pRe = /<p([^>]*)>([\s\S]*?)<\/p>/gi
    let pmAll
    while ((pmAll = pRe.exec(body))) {
      const attrsText = pmAll[1] || ''
      const inner = pmAll[2] || ''
      if (/class\s*=\s*["'][^"']*\b(caption|muted)\b[^"']*["']/i.test(attrsText)) continue
      const text = clean(inner)
      if (text) blocks.push(text)
    }
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let liAll
    while ((liAll = liRe.exec(body))) {
      const text = clean(liAll[1])
      if (text) blocks.push(`• ${text}`)
    }
    const bodyText = blocks.join('\n\n')
    const classes = (attrs.match(/class\s*=\s*["']([^"']+)["']/i)?.[1] || '').split(/\s+/).filter(Boolean)
    slides.push({ title, img, caption, bodyText, raw, classes })
  }
  return slides
}

function layoutForSlide(s, index) {
  const isCover = index === 0
  const isIntro = s.classes.includes('intro-slide')
  const isVisual = s.classes.includes('visual-slide') || (s.img && !isCover && !isIntro)
  const isFinal = s.classes.includes('final-slide') || /спасибо/i.test(s.title || '')
  return { isCover, isIntro, isVisual, isFinal }
}

function addCover(slide, s) {
  slide.background = { color: '0B3D91' }
  slide.addText(s.title || '', { x:0.6, y:1.15, w:8.9, h:1.2, fontFace:'Aptos', fontSize:28, bold:true, color:'FFFFFF', align:'center' })
  if (s.caption) slide.addText(s.caption, { x:1.0, y:2.6, w:8.0, h:0.7, fontSize:11, color:'DDE7FF', align:'center' })
}

function addIntro(slide, s) {
  slide.addText(s.title || '', { x:0.55, y:0.35, w:4.0, h:0.5, fontSize:24, bold:true, color:'17324D' })
  if (s.caption) slide.addText(s.caption, { x:0.55, y:0.95, w:4.0, h:0.7, fontSize:11.5, color:'52606D' })
  if (s.img) {
    const imgPath = path.resolve(path.dirname(prezaPath), s.img)
    if (fs.existsSync(imgPath)) slide.addImage({ path: imgPath, x:4.75, y:0.55, w:4.2, h:2.9 })
  }
  if (s.bodyText) slide.addText(s.bodyText, { x:0.55, y:1.7, w:4.0, h:3.5, fontSize:11.0, color:'17324D' })
}

function addVisual(slide, s) {
  slide.addText(s.title || '', { x:0.55, y:0.35, w:8.5, h:0.45, fontSize:22, bold:true, color:'1C2833' })
  if (s.img) {
    const imgPath = path.resolve(path.dirname(prezaPath), s.img)
    if (fs.existsSync(imgPath)) slide.addImage({ path: imgPath, x:0.55, y:0.95, w:8.9, h:4.65 })
  }
  if (s.caption) slide.addText(s.caption, { x:0.55, y:5.75, w:8.9, h:0.55, fontSize:11, color:'566573' })
  if (s.bodyText) slide.addText(s.bodyText, { x:0.55, y:6.35, w:8.9, h:0.9, fontSize:10.5, color:'566573' })
}

function addContent(slide, s) {
  slide.addText(s.title || '', { x:0.55, y:0.35, w:8.5, h:0.45, fontSize:22, bold:true, color:'1C2833' })
  if (s.img) {
    const imgPath = path.resolve(path.dirname(prezaPath), s.img)
    if (fs.existsSync(imgPath)) slide.addImage({ path: imgPath, x:4.95, y:1.0, w:4.1, h:3.4 })
  }
  if (s.caption) slide.addText(s.caption, { x:0.55, y:4.85, w:8.6, h:0.55, fontSize:11, color:'566573' })
  if (s.bodyText) slide.addText(s.bodyText, { x:0.55, y:4.0, w:4.25, h:2.75, fontSize:11, color:'1C2833' })
}

function addFinal(slide, s) {
  slide.background = { color: 'F6F8FC' }
  slide.addText(s.title || '', { x:1.0, y:1.5, w:7.6, h:0.6, fontSize:26, bold:true, color:'0F2742', align:'center' })
  if (s.caption) slide.addText(s.caption, { x:1.0, y:2.25, w:7.6, h:0.7, fontSize:12, color:'52606D', align:'center' })
}

async function main(){
  const html = fs.readFileSync(prezaPath, 'utf8')
  const slides = extractSlides(html)
  const pres = new PPTX()
  pres.layout = 'LAYOUT_WIDE'
  pres.author = 'bukivedenie'
  pres.subject = 'Presentation export'
  pres.title = 'Bukivedenie presentation'
  pres.company = 'bukivedenie'

  for (const s of slides) {
    const slide = pres.addSlide()
    const index = slides.indexOf(s)
    const t = layoutForSlide(s, index)
    if (t.isCover) {
      addCover(slide, s)
    } else if (t.isIntro) {
      addIntro(slide, s)
    } else if (t.isFinal) {
      addFinal(slide, s)
    } else if (t.isVisual) {
      addVisual(slide, s)
    } else {
      addContent(slide, s)
    }
  }

  await pres.writeFile({ fileName: outPptx })
  console.log('Wrote PPTX to', outPptx)
  console.log(`PPTX slides: ${slides.length}`)
}

main().catch(err => { console.error(err); process.exit(2) })
