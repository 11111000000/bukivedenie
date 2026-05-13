#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Try to import puppeteer-core from local node_modules
let puppeteer
try{
  puppeteer = await import('puppeteer-core')
}catch(e){
  console.error('puppeteer-core not available:', e.message)
  process.exit(2)
}

const commonPaths = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/snap/bin/chromium',
  '/usr/bin/headless-chromium',
  '/run/current-system/sw/bin/chromium',
]

function findExecutable(){
  for(const p of commonPaths){
    if(fs.existsSync(p)) return p
  }
  return null
}

const executablePath = findExecutable()
if(!executablePath){
  console.error('No Chromium/Chrome binary found in common locations; puppeteer-core requires a browser.');
  process.exit(3)
}

async function run(){
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    executablePath,
  })

  const page = await browser.newPage()
  page.setDefaultTimeout(20000)

  const results = {
    pages: [],
    requestsFailed: [],
    errors: [],
  }

  // capture requests that failed or returned 404
  page.on('response', async resp=>{
    try{
      const status = resp.status()
      if(status===404){
        results.requestsFailed.push({url: resp.url(), status})
      }
    }catch(e){}
  })
  page.on('requestfailed', req=>{
    results.requestsFailed.push({url: req.url(), error: req.failure()?.errorText})
  })
  page.on('pageerror', err=>{
    results.errors.push({type:'pageerror', text: String(err)})
  })

  // Keep a rolling buffer of console messages grouped by navigation
  let currentConsole = []
  page.on('console', msg=>{
    try{
      const location = msg.location ? {url: msg.location().url, line: msg.location().lineNumber} : {}
      currentConsole.push({type: msg.type(), text: msg.text(), location})
    }catch(e){
      currentConsole.push({type: 'unknown', text: String(msg)})
    }
  })

  const url = 'http://127.0.0.1:5173/'
  // Puppeteer doesn't recognize 'networkidle' in some versions; use 'networkidle2' fallback
  await page.goto(url, {waitUntil: 'networkidle2'})

  // find menu items
  const menuHandles = await page.$$('nav.shell-menu a')
  for(let i=0;i<menuHandles.length;i++){
    currentConsole = []
    const handle = menuHandles[i]
    const label = await page.evaluate(el=>el.textContent, handle)
    // click and wait for iframe to update
    await handle.click()

    // wait for iframe to change src and load
    const frameHandle = await page.$('#content-frame')
    let frame = await frameHandle.contentFrame()
    // wait until iframe document readyState is 'complete'
    try{
      await page.waitForFunction(()=>{
        const f = document.getElementById('content-frame')
        if(!f) return false
        try{ const d = f.contentDocument; return !!d && d.readyState==='complete' }catch(e){return false}
      }, {timeout:15000})
    }catch(e){
      // continue, we will still try to collect console
    }

    frame = await frameHandle.contentFrame()
    // small wait for additional async loads
    await page.waitForTimeout(800)

    // collect console messages that appeared since click
    const consoleCopy = currentConsole.slice(-200)

    // check iframe content for chart presence (canvas/svg) or visible nodes
    let frameSummary = {label: label?.trim(), url: await page.evaluate(el=>el.getAttribute('src'), await page.$('nav.shell-menu a.active')), hasCanvas:false, hasSVG:false, bodyTextLength:0}
    if(frame){
      try{
        frameSummary.hasCanvas = await frame.$('canvas') !== null
        frameSummary.hasSVG = await frame.$('svg') !== null
        const bodyText = await frame.evaluate(()=>document.body ? document.body.innerText || '' : '')
        frameSummary.bodyTextLength = (bodyText||'').trim().length
      }catch(e){
        // ignore
      }
    }

    results.pages.push({label: frameSummary.label, src: frameSummary.url, console: consoleCopy.slice(0,200), frameSummary})
  }

  await browser.close()

  const outPath = path.join('/tmp','site_console_logs.json')
  fs.writeFileSync(outPath, JSON.stringify(results,null,2))
  console.log('WROTE', outPath)
  console.log(JSON.stringify({pages: results.pages.map(p=>({label:p.label, src:p.src, consoleCount: p.console.length}))}, null,2))
}

run().catch(err=>{console.error(err); process.exit(4)})
