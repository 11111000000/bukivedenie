import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';

const dev = process.env.ROLLUP_WATCH === 'true' || !!process.env.ROLLUP_WATCH;

export default {
  input: 'src/main.js',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: dev,
    entryFileNames: '[name].js',
    chunkFileNames: 'chunks/[name]-[hash].js',
    // Inline dynamic imports to avoid multi-chunk error when a single-bundle behavior is desired
    inlineDynamicImports: true,
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    dev && serve({
      open: false,
      contentBase: ['dist', 'public'],
      host: '0.0.0.0',
      port: 5173,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    }),
    dev && livereload({ watch: 'dist' }),
    !dev && terser()
  ],
  // avoid preserving module signatures which can cause issues when inlining dynamic imports
  preserveEntrySignatures: false,
};
