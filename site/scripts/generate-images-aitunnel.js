#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'node:url'
import process from 'process'

const API_BASE = process.env.AITUNNEL_API || 'https://api.aitunnel.ru/v1'
const API_KEY = process.env.AITUNNEL_KEY || ''
const TASK_FILTER = new Set((process.env.AITUNNEL_TASKS || '').split(',').map((s) => s.trim()).filter(Boolean))

if (!API_KEY) {
  console.error('Set AITUNNEL_KEY environment variable to your API key')
  process.exit(2)
}

const rootDir = process.cwd()
const outDir = path.resolve(rootDir, 'presentation')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

let baseTasks = null
// try to load external prompts file (ESM default export)
const promptsJs = path.join(rootDir, 'scripts', 'aitunnel-prompts.js')
if (fs.existsSync(promptsJs)) {
  try {
    const mod = await import(pathToFileURL(promptsJs).href)
    baseTasks = mod.default || mod
    console.log('Loaded prompts from', promptsJs)
  } catch (e) {
    console.warn('Could not load external prompts file via import:', e && (e.message || e.toString()))
  }
}

if (!baseTasks) {
  baseTasks = [
    {
      name: 'title-slide',
      // improved prompt for conference slide: leave space for title text, high contrast, simple icons
      prompt: 'Conference slide background, flat vector illustration: center composition with an open book whose pages flow into stylized charts (bar, line), a small network graph and a word cloud above. Leave a clear empty area at top-left for slide title. Limited palette: deep navy #0b3d91, warm orange #ff7a3d, soft gray #f5f6f8. Minimalist, high legibility, vector shapes, subtle drop shadows, 16:9, 1920x1080',
      file: 'slide-01-title.png',
    },
    {
      name: 'intro-slide',
      prompt: 'Conference illustration, flat vector: a researcher silhouette on the left looking at a large display of charts and text snippets on the right; schematic book pages in the background. Maintain consistent palette (navy, warm orange, soft gray). Provide clear margin for subtitle text. Clean lines, modern educational style, 16:9, 1920x1080',
      file: 'slide-02-intro.png',
    }
  ]
}

const tasks = baseTasks.map((t) => ({
  ...t,
  file: path.join(outDir, t.file),
})).filter((t) => TASK_FILTER.size === 0 || TASK_FILTER.has(t.name))

console.log('Task count:', tasks.length)

// fallback: generate simple SVG placeholders and render to PNG via puppeteer
async function createPlaceholderPng(task) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">\n  <rect width="100%" height="100%" fill="#0b3d91"/>\n  <g fill="#fff" opacity="0.95">\n    <rect x="120" y="80" width="1280" height="140" rx="8" fill="#f5f6f8" opacity="0.9"/>\n    <text x="160" y="160" font-size="48" fill="#0b3d91" font-family="Arial, Helvetica, sans-serif">${escapeXml(task.name.replace(/-/g,' ')).toUpperCase()}</text>\n  </g>\n  <g transform="translate(160,260)">\n    <rect x="0" y="0" width="360" height="220" rx="8" fill="#ff7a3d" opacity="0.95"/>\n    <rect x="400" y="0" width="360" height="220" rx="8" fill="#f5f6f8"/>\n    <circle cx="1100" cy="160" r="120" fill="#ffe7d9"/>\n  </g>\n  <text x="160" y="980" font-size="18" fill="#ffffff" font-family="Arial, Helvetica, sans-serif">Placeholder generated locally — prompt: ${escapeXml(task.prompt.slice(0,120))}</text>\n</svg>`

  const tmpHtml = path.join(outDir, `${task.name}.svg`)
  fs.writeFileSync(tmpHtml, svg, 'utf8')
  // render SVG to PNG using puppeteer if available
  try {
    const puppeteer = await import('puppeteer-core')
    const candidates = [process.env.CHROME_PATH, process.env.CHROMIUM_PATH, '/run/current-system/sw/bin/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)
    let executablePath = candidates.find(p => fs.existsSync(p)) || null
    if (!executablePath) {
      console.warn('No chromium found for rendering SVG; writing raw SVG as PNG placeholder is skipped')
      // write SVG as fallback PNG by converting via sharp if available
      try {
        const sharp = await import('sharp')
        const outPngBuf = await sharp.default(Buffer.from(svg)).png().toBuffer()
        fs.writeFileSync(task.file, outPngBuf)
        console.log('Wrote (sharp) placeholder', task.file)
        return
      } catch (e) {
        fs.writeFileSync(task.file.replace('.png','.svg'), svg)
        console.log('Wrote placeholder SVG to', task.file.replace('.png','.svg'))
        return
      }
    }
    const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox'] })
    const page = await browser.newPage()
    const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    await page.goto(dataUrl)
    await page.screenshot({ path: task.file })
    await browser.close()
    console.log('Wrote (puppeteer) placeholder', task.file)
  } catch (e) {
    console.warn('Placeholder rendering failed, falling back to raw svg file:', e && e.message)
    fs.writeFileSync(task.file.replace('.png','.svg'), svg)
    console.log('Wrote placeholder SVG to', task.file.replace('.png','.svg'))
  }
}

function escapeXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

async function gen(task) {
  console.log('\n=== Generate', task.name, '===')
  const url = `${API_BASE}/images/generations`
  const body = {
    model: 'gpt-image-2',
    prompt: task.prompt,
    n: 1,
  }

  console.log('POST', url)
  console.log('Prompt (truncated):', task.prompt.slice(0,200).replace(/\n/g,' '))

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('Fetch failed:', err && (err.message || err.toString()))
    throw err
  }

  console.log('Response status:', res.status)
  const text = await res.text()
  console.log('Response body (truncated):', text.slice(0,2000))

  let j
  try {
    j = JSON.parse(text)
  } catch (e) {
    throw new Error('Response is not JSON: ' + e.message)
  }

  const dataUrl = j?.data?.[0]?.url
  const b64Json = j?.data?.[0]?.b64_json
  if (!dataUrl && !b64Json) {
    console.error('Full JSON response:', JSON.stringify(j, null, 2).slice(0,5000))
    throw new Error('No data[0].url or data[0].b64_json in response JSON')
  }
  const b64 = b64Json || dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)?.[2]
  if (!b64) throw new Error('Unexpected image payload format')
  const buf = Buffer.from(b64, 'base64')
  fs.writeFileSync(task.file, buf)
  console.log('Wrote', task.file)
}

async function main() {
  for (const t of tasks) {
    try {
      await gen(t)
    } catch (err) {
      console.error('Failed', t.name, err && (err.message || err.toString()))
      console.log('Falling back to local placeholder for', t.name)
      try {
        await createPlaceholderPng(t)
      } catch (e) {
        console.error('Placeholder generation also failed for', t.name, e && (e.message || e.toString()))
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
