#!/usr/bin/env node
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const url = process.argv[2] || 'http://127.0.0.1:4173'
const headful = process.env.SITE_HEADFUL === '1'
const candidates = [
  process.env.CHROME_PATH,
  process.env.CHROMIUM_PATH,
  '/run/current-system/sw/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

function resolveBrowser() {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

const executablePath = resolveBrowser()
if (!executablePath) {
  console.error('Chromium not found. Set CHROME_PATH or CHROMIUM_PATH.')
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath,
  headless: headful ? false : 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
page.on('console', (message) => {
  const text = message.text()
  const prefix = `[browser:${message.type()}]`
  if (message.type() === 'error') {
    console.error(prefix, text)
  } else {
    console.log(prefix, text)
  }
})
page.on('pageerror', (error) => {
  console.error('[pageerror]', error.message)
})
page.on('requestfailed', (request) => {
  console.error('[requestfailed]', request.url(), request.failure()?.errorText || 'failed')
})

await page.goto(url, { waitUntil: 'networkidle2' })
await new Promise((resolve) => setTimeout(resolve, 1500))
await browser.close()
