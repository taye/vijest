import { defineConfig } from 'vite'
import { resolve } from 'path'
import viteJasmine from './src/plugin'
import { INTERNAL } from './src/constants'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [viteJasmine({ [INTERNAL]: true })],
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
      external: ['sinon'],
      output: {
        format: 'es',
        sourcemap: !isProd,
      },
    },
    minify: isProd,
    terserOptions: {
      format: {
        comments: /@vite/,
      },
    },
  },
})
