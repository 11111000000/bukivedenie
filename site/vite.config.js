import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  appType: 'mpa',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        linguistics: resolve(__dirname, 'lingvistics.html'),
        warAndPeaceCloud: resolve(__dirname, 'war-and-peace-cloud.html'),
        warAndPeaceMap: resolve(__dirname, 'war-and-peace-map.html'),
        warAndPeaceCharacters: resolve(__dirname, 'war-and-peace-characters.html'),
        warAndPeaceTimeline: resolve(__dirname, 'war-and-peace-timeline.html'),
        warCharacters: resolve(__dirname, 'war-characters.html'),
        warTimeline: resolve(__dirname, 'war-timeline.html'),
      },
    },
  },
})
