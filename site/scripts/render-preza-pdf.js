#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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

const executablePath = resolveBrowser()
if (!executablePath) {
  console.error('Chromium not found. Set CHROME_PATH or CHROMIUM_PATH to a chromium binary.')
  process.exit(1)
}

const prezaPath = resolve(__dirname, '..', 'preza.html')
const outPdf = resolve(__dirname, '..', 'preza.pdf')

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage()
  const url = 'file://' + prezaPath
  await page.goto(url, { waitUntil: 'networkidle0' })
  // give some time for any charts to render
  await new Promise((r) => setTimeout(r, 1000))
  // render as 16:9 at 1280x720
  await page.pdf({ path: outPdf, width: '1280px', height: '720px', printBackground: true })
  console.log('Wrote PDF to', outPdf)
} finally {
  await browser.close()
}

process.exit(0)
