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
        client: resolve(__dirname, 'src/client/index.ts'),
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
