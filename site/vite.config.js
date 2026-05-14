import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'

export default defineConfig({
  appType: 'mpa',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        preza: resolve(__dirname, 'preza.html'),
        linguistics: resolve(__dirname, 'lingvistics.html'),
        warAndPeaceCloud: resolve(__dirname, 'war-and-peace-cloud.html'),
        warAndPeaceMap: resolve(__dirname, 'war-and-peace-map.html'),
        warAndPeaceMovements: resolve(__dirname, 'war-and-peace-movements.html'),
        warAndPeaceCharacters: resolve(__dirname, 'war-and-peace-characters.html'),
        warAndPeaceTimeline: resolve(__dirname, 'war-and-peace-timeline.html'),
        warCharacters: resolve(__dirname, 'war-characters.html'),
        warTimeline: resolve(__dirname, 'war-timeline.html'),
      },
    },
  },
  plugins: [{
    name: 'copy-preza-assets',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist')
      if (!existsSync(outDir)) return
      // copy preza pdf/pptx if present
      for (const name of ['preza.pdf', 'preza.pptx']) {
        const src = resolve(__dirname, name)
        const dest = resolve(outDir, name)
        if (existsSync(src)) {
          mkdirSync(outDir, { recursive: true })
          copyFileSync(src, dest)
        }
      }

      // copy presentation assets directory so CSVs and images are available on gh-pages
      const presSrc = resolve(__dirname, 'presentation')
      const presDest = resolve(outDir, 'presentation')
      if (existsSync(presSrc)) {
        mkdirSync(presDest, { recursive: true })
        // copy files (flat copy) - preserve filenames
        const fs = require('node:fs')
        for (const entry of fs.readdirSync(presSrc)) {
          const s = resolve(presSrc, entry)
          const d = resolve(presDest, entry)
          try { fs.copyFileSync(s, d) } catch (e) { /* ignore directories */ }
        }
      }
    },
  }],
})
