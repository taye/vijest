import { resolve } from 'path'

import { defineConfig } from 'vite'

import { dynamicImportViteIgnore } from './rollup.config'
import { INTERNAL } from './src/constants'
import vitest from './src/plugin'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [vitest({ [INTERNAL]: true }), dynamicImportViteIgnore()],
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        jasmine: resolve(__dirname, 'src/web/jasmine.ts'),
        spec: resolve(__dirname, 'src/web/spec.ts'),
        stub: resolve(__dirname, 'src/web/stub.ts'),
      },
      external: ['expect', 'jest-environment-node', 'jest-mock', 'supports-color'],
      output: {
        format: 'es',
        sourcemap: !isProd,
      },
      plugins: [dynamicImportViteIgnore()],
    },
    minify: isProd,
    terserOptions: {
      format: {
        comments: /@vite/,
      },
    },
  },
})
