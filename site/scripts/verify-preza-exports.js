#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const root = path.resolve(new URL('.', import.meta.url).pathname, '..')
const htmlPath = path.join(root, 'preza.html')
const pdfPath = path.join(root, 'preza.pdf')
const pptxPath = path.join(root, 'preza.pptx')

const html = fs.readFileSync(htmlPath, 'utf8')
const slideCount = (html.match(/<section\b[^>]*class=["'][^"']*\bslide\b[^"']*["'][^>]*>/gi) || []).length
const imgRefs = [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1])
const missing = imgRefs.filter(ref => !fs.existsSync(path.join(root, ref)))

const pdfExists = fs.existsSync(pdfPath)
const pptxExists = fs.existsSync(pptxPath)
const pdfSize = pdfExists ? fs.statSync(pdfPath).size : 0
const pptxSize = pptxExists ? fs.statSync(pptxPath).size : 0

function countPptxSlides(pptxFile) {
  if (!fs.existsSync(pptxFile)) return 0
  const out = execFileSync('unzip', ['-l', pptxFile], { encoding: 'utf8' })
  return (out.match(/ppt\/slides\/slide\d+\.xml/g) || []).length
}

const pptxSlides = countPptxSlides(pptxPath)

console.log(`HTML slides: ${slideCount}`)
console.log(`Image refs: ${imgRefs.length}`)
console.log(`Missing images: ${missing.length}`)
if (missing.length) missing.forEach(m => console.log(`- ${m}`))
console.log(`PDF exists: ${pdfExists} size=${pdfSize}`)
console.log(`PPTX exists: ${pptxExists} size=${pptxSize}`)
console.log(`PPTX slide XML entries: ${pptxSlides}`)

if (!pdfExists || !pptxExists || missing.length || pptxSlides !== slideCount) process.exit(2)
