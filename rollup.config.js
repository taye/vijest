const { resolve } = require( 'path')
const { defineConfig } = require('rollup')
const esbuild = require('rollup-plugin-esbuild')

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
    input: resolve(__dirname, 'index.ts'),
    output: {
      file: 'index.js',
      format: 'commonjs',
      sourcemap: !isProd,
      exports: 'auto',
    },
    plugins: [esbuild()],
  })
