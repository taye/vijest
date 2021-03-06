import nodeResolve from '@rollup/plugin-node-resolve'
import type { Plugin } from 'rollup'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  input: {
    plugin: 'src/plugin/index.ts',
    'jest-preset': 'src/jest/preset.ts',
    setup: 'src/jest/setup.ts',
    teardown: 'src/jest/teardown.ts',
    runner: 'src/jest/runner.ts',
    environment: 'src/jest/environment.ts',
  },
  external: [/\/node_modules\//, 'fs/promises', 'timers/promises'],
  output: {
    format: 'commonjs',
    sourcemap: true,
    exports: 'auto',
    dir: __dirname,
    chunkFileNames: '[name].js',
  },
  plugins: [esbuild(), nodeResolve(), dynamicImportViteIgnore()],
})

export function dynamicImportViteIgnore (): Plugin {
  return {
    name: 'vijest-internal/dynamic-import',
    renderDynamicImport: () => ({ left: 'import(/* @vite-ignore */ ', right: ')' }),
  }
}
