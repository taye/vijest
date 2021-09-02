import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  input: {
    index: 'src/plugin.ts',
    runner: 'src/runner.ts',
  },
  output: {
    format: 'commonjs',
    sourcemap: !isProd,
    exports: 'auto',
    dir: __dirname,
    chunkFileNames: '[name].js',
  },
  plugins: [esbuild()],
})
