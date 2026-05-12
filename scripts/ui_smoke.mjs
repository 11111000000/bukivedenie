#!/usr/bin/env node
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import fsSync from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const DEFAULT_OUT_DIR = 'artifacts/ui-smoke'

export const ROUTES = [
  { name: 'dashboard', hash: '#/books', kind: 'dashboard', ready: '#view .dashboard-shell, #view .dashboard-atlas-panel' },
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

export const BROWSER_PATH_CANDIDATES = [
  process.env.SMOKE_BROWSER_PATH,
  process.env.BROWSER_PATH,
  process.env.CHROME_PATH,
  process.env.CHROMIUM_PATH,
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  process.env.PREFIX ? path.join(process.env.PREFIX, 'bin', 'chromium') : null,
  process.env.PREFIX ? path.join(process.env.PREFIX, 'bin', 'chromium-browser') : null,
  '/data/data/com.termux/files/usr/bin/chromium',
  '/data/data/com.termux/files/usr/bin/chromium-browser',
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

export function slugify(value){
  return String(value || 'route')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'route'
}

export function routeUrl(baseUrl, route, book, fileName){
  const hash = route.hash
    .replace('{book}', encodeURIComponent(book || ''))
    .replace('{file}', encodeURIComponent(fileName || ''))
  const cleanBase = String(baseUrl || '').replace(/\/$/, '')
  return `${cleanBase}/${hash}`
}

export function artifactPaths(outDir, routeName, book){
  const routeSlug = slugify(routeName)
  const bookSlug = slugify(book)
  const fileSlug = bookSlug && bookSlug !== 'route' ? `${bookSlug}__${routeSlug}` : routeSlug
  return {
    htmlPath: path.join(outDir, 'html', `${fileSlug}.html`),
    screenshotPath: path.join(outDir, 'screens', `${fileSlug}.png`),
  }
}

export function browserLaunchArgs(browserPath, headful){
  return {
    headless: !headful,
    executablePath: browserPath,
    args: [process.getuid && process.getuid() === 0 ? '--no-sandbox' : '', '--disable-dev-shm-usage', '--window-size=1440,1200'].filter(Boolean),
  }
}

export async function launchBrowser(chromium, browserPath, headful){
  try{
    return await chromium.launch(browserLaunchArgs(browserPath, headful))
  }catch{
    return null
  }
}

export function isDashboardRoute(route){
  return route?.kind === 'dashboard' || route?.name === 'dashboard'
}

export function resolveBrowserPath(){
  for(const candidate of BROWSER_PATH_CANDIDATES){
    if(path.isAbsolute(candidate)){
      if(awaitExists(candidate)) return candidate
      continue
    }
    const probe = spawnSync('sh', ['-lc', `command -v ${candidate}`], { encoding: 'utf8' })
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

export async function preflight(apiBase, bookHint){
  const report = { ok: true, books: [], files: [], bookSummary: null, selectedBook: null, errors: [] }
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
    const summaryResp = await fetch(`${apiBase.replace(/\/$/, '')}/api/book_summary?book=${encodeURIComponent(report.selectedBook)}`)
    report.bookSummary = await summaryResp.json().catch(() => null)
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
  const outDir = path.resolve(args.out || process.env.SMOKE_OUT || DEFAULT_OUT_DIR)
  let browserPath = resolveBrowserPath()
  const selected = await preflight(apiBase, args.book || process.env.SMOKE_BOOK)
  await ensureDir(outDir)
  await ensureDir(path.join(outDir, 'html'))
  await ensureDir(path.join(outDir, 'screens'))

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

  const staticServer = await startStaticServer(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend'))
  const baseUrl = uiHint || staticServer.url

  let chromium
  if(browserPath){
    try{
      const scriptDir = path.dirname(fileURLToPath(import.meta.url))
      const playwrightPath = path.resolve(scriptDir, '../frontend/node_modules/playwright-core/index.js')
      const mod = await import(pathToFileURL(playwrightPath).href)
      chromium = mod.chromium || mod.default?.chromium || mod.default
    }catch(error){
      browserPath = null
      report.browserAvailable = false
      report.browserPath = null
      report.console.push({ type: 'warning', text: `playwright-core unavailable: ${String(error?.message || error)}` })
    }
  }

  const browser = browserPath && chromium ? await launchBrowser(chromium, browserPath, args.headful) : null
  if(browserPath && chromium && !browser){
    report.console.push({ type: 'warning', text: `browser launch failed for ${browserPath}, continuing browserless` })
    browserPath = null
    report.browserAvailable = false
    report.browserPath = null
  }

  try{
    const book = selected.selectedBook || 'unknown'
    const files = selected.files || []
    const fileName = files[0] || 'tokens.csv'

    const routeJobs = ROUTES.map(route => {
      if(route.kind === 'network' && !files.includes('cooccurrence_edges.csv')) return { route, skip: 'missing cooccurrence_edges.csv' }
      if(route.kind === 'chart' && route.name === 'sentiment' && !files.includes('sentiment_by_chapter.csv')) return { route, skip: 'missing sentiment_by_chapter.csv' }
      if(route.name === 'tokens' && !files.some(f => f.includes('tokens.csv'))) return { route, skip: 'missing tokens.csv' }
      if(route.name === 'wordcloud' && !files.some(f => f.includes('tokens.csv'))) return { route, skip: 'missing tokens.csv' }
      if(route.name === 'heatmap' && !files.some(f => f.includes('token_freq_by_chapter.csv') || f.includes('tokens.csv'))) return { route, skip: 'missing token frequency data' }
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
      const { htmlPath, screenshotPath: pngPath } = artifactPaths(outDir, name, book)
      try{
        if(browser){
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
              if(url.includes('/api/token_by_chapter') && response.status() === 404) return
              report.responseFailures.push({ url, status: response.status() })
            }
          })

          await page.addInitScript(({ apiBaseValue }) => {
            window.__API_BASE__ = apiBaseValue
            window.__SMOKE__ = true
          }, { apiBaseValue: apiBase })

          // disable animations/transitions for deterministic screenshots
          await page.addInitScript(() => {
            try{
              const style = document.createElement('style')
              style.id = '__smoke_disable_animations'
              style.innerHTML = `* { transition: none !important; animation: none !important; caret-color: transparent !important; } html, body { scroll-behavior: auto !important; }`
              document.head && document.head.appendChild(style)
            }catch(e){}
          })

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForFunction(() => !!document.getElementById('app'), null, { timeout: 30000 })
          await page.waitForFunction(() => !!document.getElementById('view'), null, { timeout: 30000 })
          await page.waitForFunction(() => window.__APP_READY__ === true, null, { timeout: 30000 }).catch(() => {})
          await page.waitForFunction((selector) => !!document.querySelector(selector), job.route.ready, { timeout: 30000 }).catch(() => {})
          const html = await page.content()
          await writeText(htmlPath, html)
           await page.screenshot({ path: pngPath, fullPage: true })
           result.html = path.relative(outDir, htmlPath)
           result.screenshot = path.relative(outDir, pngPath)

           // compare with baseline if available
           try{
              const fileSlug = path.basename(pngPath, path.extname(pngPath))
              const baselinePath = path.join(process.cwd(), 'tests', 'baselines', 'books', `${fileSlug}.png`)
              let diffPath = null
              let diffPct = 0
              let pageStatus = 'ok'
              let pixelmatchLocal = null
              let PNGLocal = null

               if(fsSync.existsSync(baselinePath)){
                // dynamically load pixelmatch/pngjs from frontend node_modules to avoid top-level resolution issues
                try{
              const scriptDir = path.dirname(fileURLToPath(import.meta.url))
              const pmPath = path.resolve(scriptDir, '../frontend/node_modules/pixelmatch/index.js')
              const pngjsPath = path.resolve(scriptDir, '../frontend/node_modules/pngjs/lib/png.js')
              const pmMod = await import(pathToFileURL(pmPath).href)
              const pngMod = await import(pathToFileURL(pngjsPath).href)
              pixelmatchLocal = pmMod.default || pmMod
              PNGLocal = pngMod.PNG || pngMod.default || pngMod
                }catch(e){
                  throw new Error('pixelmatch/pngjs not available: ' + String(e?.message || e))
                }
                
                if(!pixelmatchLocal || !PNGLocal){
                  throw new Error('pixelmatch/pngjs not loaded')
                }
                const baseBuf = fsSync.readFileSync(baselinePath)
                const curBuf = fsSync.readFileSync(pngPath)
               const img1 = PNGLocal.sync.read(baseBuf)
               const img2 = PNGLocal.sync.read(curBuf)
               if(img1.width !== img2.width || img1.height !== img2.height){
                 // size mismatch — mark as fail
                 diffPct = 100
                 pageStatus = 'fail'
               }else{
                 const { width, height } = img1
                 const diff = new PNGLocal({ width, height })
                 const diffPixels = pixelmatchLocal(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 })
                 const total = width * height
                 diffPct = (diffPixels / total) * 100
                 if(diffPixels > 0){
                   diffPath = path.join(outDir, 'diff', `${fileSlug}.png`)
                   await ensureDir(path.dirname(diffPath))
                   fsSync.writeFileSync(diffPath, PNGLocal.sync.write(diff))
                 }
                 pageStatus = diffPct > 0.3 ? 'fail' : 'ok'
               }
             }else{
               pageStatus = 'baseline_missing'
             }

             result.baseline = fsSync.existsSync(path.join(process.cwd(), 'tests', 'baselines', 'books', `${path.basename(pngPath, path.extname(pngPath))}.png`)) ? path.relative(outDir, path.join(process.cwd(), 'tests', 'baselines', 'books', `${path.basename(pngPath, path.extname(pngPath))}.png`)) : null
             result.diff = diffPath ? path.relative(outDir, diffPath) : null
             result.diff_pct = Number((diffPct).toFixed(3))
             result.status = pageStatus
           }catch(err){
             result.notes.push(`compare error: ${String(err?.message || err)}`)
             result.status = 'failed'
           }
          await page.close().catch(() => {})
        }else{
          const response = await fetch(url)
          const html = await response.text()
          await writeText(htmlPath, html)
          result.status = response.ok ? 'passed' : 'failed'
          result.html = path.relative(outDir, htmlPath)
          if(!response.ok){
            result.notes.push(`fetch status ${response.status}`)
          }
          if(isDashboardRoute(job.route) && !response.ok){
            result.notes.push('dashboard route unavailable in browserless mode')
          }
        }
      }catch(error){
        result.status = 'failed'
        result.notes.push(String(error?.message || error))
        if(browser){
          try{
            const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
            const html = await page.content()
            await writeText(htmlPath, html)
            result.html = path.relative(outDir, htmlPath)
          }catch{}
          try{
            const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
            await page.screenshot({ path: pngPath, fullPage: true })
            result.screenshot = path.relative(outDir, pngPath)
          }catch{}
        }
      }
      report.routes.push(result)
    }

    await writeText(path.join(outDir, 'console.log'), report.console.map(entry => `${entry.type}: ${entry.text}`).join('\n') + '\n')

    // normalize report to minimal machine-friendly schema
    const results = report.routes.map(r => ({
      name: r.name,
      url: r.url,
      screenshot: r.screenshot || null,
      html: r.html || null,
      baseline: r.baseline || null,
      diff: r.diff || null,
      diff_pct: typeof r.diff_pct === 'number' ? r.diff_pct : 0,
      status: r.status || 'unknown',
      notes: r.notes || [],
    }))
    const anyFail = results.some(r => r.status === 'fail' || r.status === 'failed' || r.status === 'baseline_missing')
    const anyErrors = report.pageErrors.length || report.requestFailures.length || report.responseFailures.length
    // Route statuses are the machine contract; auxiliary browser noise stays in logs.
    const finalStatus = !anyFail ? 'ready' : 'not_ready'
    const minimal = {
      status: finalStatus,
      commit: (process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || null),
      timestamp: new Date().toISOString(),
      results,
    }
    await writeJson(path.join(outDir, 'report.json'), minimal)
    process.exitCode = finalStatus === 'ready' && !anyErrors ? 0 : 1
    return report
  } finally {
    await new Promise(resolve => staticServer?.server?.close?.(() => resolve())).catch(() => {})
    await browser.close().catch(() => {})
  }
}

if(import.meta.url === `file://${process.argv[1]}`){
  run().catch(async error => {
     const outDir = path.resolve(process.env.SMOKE_OUT || DEFAULT_OUT_DIR)
    await ensureDir(outDir).catch(() => {})
    await writeJson(path.join(outDir, 'report.json'), { ok: false, error: String(error?.message || error) }).catch(() => {})
    console.error(error)
    process.exit(1)
  })
}
