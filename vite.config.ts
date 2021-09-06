import { defineConfig } from 'vite'
import { resolve } from 'path'
import vitest from './src/plugin'
import { INTERNAL } from './src/constants'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [vitest({ [INTERNAL]: true })],
  resolve: {
    alias: {
      'graceful-fs': resolve(__dirname, 'src', 'stub'),
    },
  },
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        jasmine: resolve(__dirname, 'src/web/jasmine.ts'),
        spec: resolve(__dirname, 'src/web/spec.ts'),
      },
      external: ['supports-color'],
      output: {
        format: 'es',
        sourcemap: !isProd,
      },
    },
    minify: isProd,
  },
})
