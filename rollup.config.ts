import nodeResolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  input: {
    plugin: 'src/plugin.ts',
    'jest-preset': 'src/jest/preset.ts',
    setup: 'src/jest/setup.ts',
    teardown: 'src/jest/teardown.ts',
    runner: 'src/jest/runner.ts',
    environment: 'src/jest/environment.ts',
  },
  external: [/\/node_modules\//, 'fs/promises'],
  output: {
    format: 'commonjs',
    sourcemap: !isProd,
    exports: 'auto',
    dir: __dirname,
    chunkFileNames: '[name].js',
  },
  plugins: [esbuild(), nodeResolve(), dynamicImport()],
})

function dynamicImport () {
  return {
    name: 'vitest-internal/dynamic-import',
    renderDynamicImport: () => ({ left: 'import(', right: ')' }),
  }
}
