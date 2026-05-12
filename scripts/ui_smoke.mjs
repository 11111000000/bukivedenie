#!/usr/bin/env node
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROUTES = [
  { name: 'books', hash: '#/books', kind: 'books', ready: '#view a[href^="#/book/"]' },
  { name: 'overview', hash: '#/book/{book}', kind: 'overview', ready: '#view details' },
  { name: 'tokens', hash: '#/book/{book}/viz/tokens', kind: 'chart', ready: '#chart canvas, #chart svg' },
  { name: 'wordcloud', hash: '#/book/{book}/viz/wordcloud', kind: 'cloud', ready: '#cloud canvas' },
  { name: 'network', hash: '#/book/{book}/viz/network', kind: 'network', ready: '#net canvas' },
  { name: 'sentiment', hash: '#/book/{book}/viz/sentiment', kind: 'chart', ready: '#sent canvas, #sent svg' },
  { name: 'heatmap', hash: '#/book/{book}/viz/heatmap', kind: 'chart', ready: '#hm canvas, #hm svg' },
  { name: 'files', hash: '#/book/{book}/files', kind: 'files', ready: '#view a[href*="/file/"]' },
  { name: 'file', hash: '#/book/{book}/file/{file}', kind: 'file', ready: '#view table, #view pre' },
]

export function slugify(value){
  return String(value || 'route')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'route'
}

export function routeUrl(baseUrl, route, book, fileName){
  const hash = route.hash
    .replace('{book}', encodeURIComponent(book || ''))
    .replace('{file}', encodeURIComponent(fileName || ''))
  const cleanBase = String(baseUrl || '').replace(/\/$/, '')
  return `${cleanBase}/${hash}`
}

export function resolveBrowserPath(){
  const candidates = [
    process.env.SMOKE_BROWSER_PATH,
    process.env.BROWSER_PATH,
    '/run/current-system/sw/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    'chromium',
    'chromium-browser',
    'google-chrome',
    'google-chrome-stable',
    'chrome',
  ].filter(Boolean)
  for(const candidate of candidates){
    if(path.isAbsolute(candidate)){
      try{
        if(awaitExists(candidate)) return candidate
      }catch{}
      continue
    }
    const probe = spawnSync('node', ['-e', `const {spawnSync}=require('node:child_process'); const p=spawnSync('sh',['-lc','command -v ${candidate}'],{encoding:'utf8'}); process.stdout.write((p.stdout||'').trim())`], { encoding: 'utf8' })
    const resolved = probe?.stdout?.trim()
    if(resolved && existsSync(resolved)) return resolved
  }
  return null
}

function awaitExists(p){
  try{
    return existsSync(p)
  }catch{
    return false
  }
}

async function ensureDir(dir){
  await fs.mkdir(dir, { recursive: true })
}

async function writeText(file, text){
  await ensureDir(path.dirname(file))
  await fs.writeFile(file, text, 'utf8')
}

async function writeJson(file, value){
  await writeText(file, `${JSON.stringify(value, null, 2)}\n`)
}

async function startStaticServer(rootDir){
  const server = http.createServer(async (req, res) => {
    try{
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      let rel = decodeURIComponent(url.pathname)
      if(rel === '/' || rel === '') rel = '/index.html'
      let filePath = path.join(rootDir, rel)
      if(!existsSync(filePath) || !path.extname(filePath)){
        filePath = path.join(rootDir, 'index.html')
      }
      const data = await fs.readFile(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const type = ext === '.html' ? 'text/html; charset=utf-8'
        : ext === '.js' ? 'application/javascript; charset=utf-8'
        : ext === '.css' ? 'text/css; charset=utf-8'
        : ext === '.json' ? 'application/json; charset=utf-8'
        : 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': type })
      res.end(data)
    }catch(error){
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(String(error?.message || error))
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return { server, url: `http://127.0.0.1:${port}` }
}

function parseArgs(argv){
  const out = {}
  for(let i=0; i<argv.length; i++){
    const cur = argv[i]
    const next = argv[i+1]
    if(cur === '--url' || cur === '-u'){ out.url = next; i++ }
    else if(cur === '--api-base'){ out.apiBase = next; i++ }
    else if(cur === '--book'){ out.book = next; i++ }
    else if(cur === '--out'){ out.out = next; i++ }
    else if(cur === '--headful'){ out.headful = true }
    else if(cur === '--strict'){ out.strict = true }
  }
  return out
}

async function preflight(apiBase, bookHint){
  const report = { ok: true, books: [], files: [], selectedBook: null, errors: [] }
  try{
    const booksResp = await fetch(`${apiBase.replace(/\/$/, '')}/api/books`)
    const booksJson = await booksResp.json()
    report.books = Array.isArray(booksJson?.books) ? booksJson.books : []
    if(!report.books.length){
      report.errors.push('no books available')
      report.ok = false
      return report
    }
    report.selectedBook = bookHint || report.books[0]
    const filesResp = await fetch(`${apiBase.replace(/\/$/, '')}/api/files?book=${encodeURIComponent(report.selectedBook)}`)
    const filesJson = await filesResp.json()
    report.files = Array.isArray(filesJson?.files) ? filesJson.files : []
  }catch(error){
    report.ok = false
    report.errors.push(String(error?.message || error))
  }
  return report
}

async function run(){
  const args = parseArgs(process.argv.slice(2))
  const apiBase = args.apiBase || process.env.SMOKE_API_BASE || 'http://127.0.0.1:8000'
  const uiHint = args.url || process.env.SMOKE_URL || ''
  const outDir = path.resolve(args.out || process.env.SMOKE_OUT || 'artifacts/ui-smoke')
  const browserPath = resolveBrowserPath()
  const selected = await preflight(apiBase, args.book || process.env.SMOKE_BOOK)
  await ensureDir(outDir)

  const report = {
    baseUrl: uiHint || apiBase,
    apiBase,
    outDir,
    browserPath,
    browserAvailable: !!browserPath,
    selectedBook: selected.selectedBook,
    preflight: selected,
    routes: [],
    console: [],
    requestFailures: [],
    pageErrors: [],
    responseFailures: [],
  }

  await writeJson(path.join(outDir, 'api.json'), selected)

  if(!browserPath){
    await writeJson(path.join(outDir, 'report.json'), report)
    await writeText(path.join(outDir, 'console.log'), 'browser unavailable, saved API preflight only\n')
    return report
  }

  const staticServer = await startStaticServer(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend'))
  const baseUrl = uiHint || staticServer.url

  let chromium
  try{
    const scriptDir = path.dirname(fileURLToPath(import.meta.url))
    const playwrightPath = path.resolve(scriptDir, '../frontend/node_modules/playwright-core/index.js')
    const mod = await import(pathToFileURL(playwrightPath).href)
    chromium = mod.chromium || mod.default?.chromium || mod.default
  }catch(error){
    report.browserAvailable = false
    report.browserPath = null
    await writeJson(path.join(outDir, 'report.json'), { ...report, error: `playwright-core unavailable: ${String(error?.message || error)}` })
    await writeText(path.join(outDir, 'console.log'), 'playwright-core unavailable, saved API preflight only\n')
    return report
  }

  const browser = await chromium.launch({
    headless: !args.headful,
    executablePath: browserPath,
    args: [process.getuid && process.getuid() === 0 ? '--no-sandbox' : '', '--disable-dev-shm-usage'].filter(Boolean),
  })

  try{
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
    page.on('console', msg => {
      report.console.push({ type: msg.type(), text: msg.text() })
    })
    page.on('pageerror', error => {
      report.pageErrors.push(String(error?.message || error))
    })
    page.on('requestfailed', request => {
      report.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText || 'failed' })
    })
      page.on('response', response => {
        const url = response.url()
        if((url.startsWith(baseUrl) || url.startsWith(apiBase)) && !response.ok()){
          report.responseFailures.push({ url, status: response.status() })
        }
      })

    await page.addInitScript(({ apiBaseValue }) => {
      window.__API_BASE__ = apiBaseValue
      window.__SMOKE__ = true
    }, { apiBaseValue: apiBase })

    const book = selected.selectedBook || 'unknown'
    const files = selected.files || []
    const fileName = files[0] || 'tokens.csv'

    const routeJobs = ROUTES.map(route => {
      if(route.kind === 'network' && !files.includes('cooccurrence_edges.csv')) return { route, skip: 'missing cooccurrence_edges.csv' }
      if(route.kind === 'chart' && route.name === 'sentiment' && !files.includes('sentiment_by_chapter.csv')) return { route, skip: 'missing sentiment_by_chapter.csv' }
      if(route.name === 'tokens' && !files.some(f => f.includes('tokens.csv'))) return { route, skip: 'missing tokens.csv' }
      if(route.name === 'wordcloud' && !files.some(f => f.includes('tokens.csv'))) return { route, skip: 'missing tokens.csv' }
      if(route.name === 'heatmap' && !files.some(f => f.includes('tokens.csv'))) return { route, skip: 'missing tokens.csv' }
      if(route.name === 'files' && !files.length) return { route, skip: 'no files' }
      if(route.name === 'file' && !files.length) return { route, skip: 'no files' }
      return { route }
    })

    for(const job of routeJobs){
      const name = job.route.name
      const result = { name, status: 'pending', url: '', html: '', screenshot: '', notes: [] }
      if(job.skip){
        result.status = 'skipped'
        result.notes.push(job.skip)
        report.routes.push(result)
        continue
      }

      const target = routeUrl(baseUrl, job.route, book, fileName)
      const [beforeHash, afterHash = ''] = target.split('#')
      const url = `${beforeHash}${beforeHash.includes('?') ? '&' : '?'}smoke=1${afterHash ? `#${afterHash}` : ''}`
      result.url = url
      const htmlPath = path.join(outDir, 'html', `${slugify(name)}.html`)
      const pngPath = path.join(outDir, 'screens', `${slugify(name)}.png`)
      try{
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForFunction(() => !!document.getElementById('app'), null, { timeout: 30000 })
        await page.waitForFunction(() => !!document.getElementById('view'), null, { timeout: 30000 })
        await page.waitForFunction(() => window.__APP_READY__ === true, null, { timeout: 30000 }).catch(() => {})
        await page.waitForFunction((selector) => !!document.querySelector(selector), job.route.ready, { timeout: 30000 }).catch(() => {})
        const html = await page.content()
        await writeText(htmlPath, html)
        await page.screenshot({ path: pngPath, fullPage: true })
        result.status = 'passed'
        result.html = path.relative(outDir, htmlPath)
        result.screenshot = path.relative(outDir, pngPath)
      }catch(error){
        result.status = 'failed'
        result.notes.push(String(error?.message || error))
        try{
          const html = await page.content()
          await writeText(htmlPath, html)
          result.html = path.relative(outDir, htmlPath)
        }catch{}
        try{
          await page.screenshot({ path: pngPath, fullPage: true })
          result.screenshot = path.relative(outDir, pngPath)
        }catch{}
      }
      report.routes.push(result)
    }

    await writeText(path.join(outDir, 'console.log'), report.console.map(entry => `${entry.type}: ${entry.text}`).join('\n') + '\n')
    await writeJson(path.join(outDir, 'report.json'), report)

    const failed = report.pageErrors.length || report.requestFailures.length || report.responseFailures.length || report.routes.some(r => r.status === 'failed')
    process.exitCode = failed ? 1 : 0
    return report
  } finally {
    await new Promise(resolve => staticServer?.server?.close?.(() => resolve())).catch(() => {})
    await browser.close().catch(() => {})
  }
}

if(import.meta.url === `file://${process.argv[1]}`){
  run().catch(async error => {
    const outDir = path.resolve(process.env.SMOKE_OUT || 'artifacts/ui-smoke')
    await ensureDir(outDir).catch(() => {})
    await writeJson(path.join(outDir, 'report.json'), { ok: false, error: String(error?.message || error) }).catch(() => {})
    console.error(error)
    process.exit(1)
  })
}
