import { resolve } from 'path'

import { defineConfig } from 'vite'

import { dynamicImportViteIgnore } from './rollup.config'
import { INTERNAL } from './src/constants'
import vitest from './src/plugin'

const isProd = process.env.NODE_ENV === 'production'
const isDevTest = process.env.VITEST_DEV_TEST === '1'

export default defineConfig({
  plugins: [!isDevTest && vitest({ [INTERNAL]: true }), dynamicImportViteIgnore()].filter(Boolean),
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        jasmine: resolve(__dirname, 'src/web/jasmine.ts'),
        spec: resolve(__dirname, 'src/web/spec.ts'),
        'jest-snapshot': resolve(__dirname, 'src/web/jest-snapshot/index.ts'),
        'jest-util': resolve(__dirname, 'src/web/jest-util.ts'),
      },
      external: [
        'chalk',
        'expect',
        'jest-format',
        'jest-environment-node',
        'jest-mock',
        'jest-snapshot',
        'supports-color',
      ],
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
