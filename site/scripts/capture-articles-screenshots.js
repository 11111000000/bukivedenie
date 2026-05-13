#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const argv = process.argv.slice(2)
const base = argv.find(a => a.startsWith('--base='))?.split('=')[1] || 'http://127.0.0.1:4173'
const outDir = argv.find(a => a.startsWith('--out='))?.split('=')[1] || 'presentation/screens'
const headful = process.env.SITE_HEADFUL === '1'

const candidates = [
  process.env.CHROME_PATH,
  process.env.CHROMIUM_PATH,
  '/run/current-system/sw/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

function resolveBrowser() {
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

function sanitize(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 80)
    .replace(/-+/g, '-') || 'article'
}

function titleFromText(text) {
  if (!text) return null
  const s = text.trim().replace(/\s+/g, ' ')
  return s.length > 0 ? s.slice(0, 60) : null
}

const executablePath = resolveBrowser()
if (!executablePath) {
  console.error('Chromium not found. Set CHROME_PATH or CHROMIUM_PATH to a chromium binary.')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath,
  headless: headful ? false : 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage()
  page.on('console', (m) => console.log('[browser]', m.text()))
  await page.goto(base, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 800))

  const articles = await page.$$('article')
  console.log('Found', articles.length, 'article elements')

  const items = []
  for (let i = 0; i < articles.length; i++) {
    const el = articles[i]
    // compute candidate title inside the element
    const title = await page.evaluate((node) => {
      const h = node.querySelector('h1,h2,h3')
      if (h && h.textContent) return h.textContent
      if (node.getAttribute && node.getAttribute('data-title')) return node.getAttribute('data-title')
      if (node.getAttribute && node.getAttribute('aria-label')) return node.getAttribute('aria-label')
      // look for first paragraph text
      const p = node.querySelector('p')
      if (p && p.textContent) return p.textContent
      return null
    }, el)

    let name = titleFromText(title) || `article-${String(i+1).padStart(2,'0')}`
    const fileBase = sanitize(name) + '-' + String(i+1).padStart(2,'0')
    const filePath = join(outDir, `${fileBase}.png`)
    try {
      await el.screenshot({ path: filePath })
      console.log('Saved', filePath)
      items.push({ file: filePath, title: name })
    } catch (err) {
      console.error('Failed to screenshot element', i, err.message || err)
    }
  }

  // build a simple presentation HTML in the output dir's parent
  const htmlPath = join(outDir, '..', 'index.html')
  const slides = items.map((it, idx) => `
    <section class="slide">
      <h2>${idx+1}. ${escapeHtml(it.title)}</h2>
      <img src="screens/${it.file.split('/').pop()}" alt="${escapeHtml(it.title)}"/>
      <p class="caption">Краткое описание (здесь добавить содержательный текст).</p>
    </section>
  `).join('\n')

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Презентация — Bukivedenie</title>
  <style>
    body{font-family: Arial, Helvetica, sans-serif; margin:0; padding:20px; background:#fff}
    .slide{page-break-after:always; margin-bottom:40px}
    img{max-width:100%; height:auto; border:1px solid #ddd}
    h2{margin:8px 0 6px}
    .caption{color:#444}
  </style>
</head>
<body>
  <h1>Презентация: результаты анализа</h1>
  ${slides}
</body>
</html>`

  writeFileSync(htmlPath, html, { encoding: 'utf8' })
  console.log('Wrote presentation HTML to', htmlPath)

} finally {
  await browser.close()
}

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

process.exit(0)
