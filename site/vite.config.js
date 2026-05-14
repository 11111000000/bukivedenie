import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'

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

      const copyTree = (srcDir, destDir) => {
        if (!existsSync(srcDir)) return
        mkdirSync(destDir, { recursive: true })
        for (const entry of readdirSync(srcDir)) {
          const s = resolve(srcDir, entry)
          const d = resolve(destDir, entry)
          if (statSync(s).isDirectory()) {
            copyTree(s, d)
          } else {
            copyFileSync(s, d)
          }
        }
      }

      // copy presentation assets directory so CSVs and images are available on gh-pages
      copyTree(resolve(__dirname, 'presentation'), resolve(outDir, 'presentation'))

      // copy vendor assets (ol, papaparse) into dist/vendor so pages can reference them directly
      copyTree(resolve(__dirname, 'vendor'), resolve(outDir, 'vendor'))
    },
  }],
})
