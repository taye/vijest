import type { Plugin } from 'vite'

export interface ViteJasmineOptions {
  specs?: string
}

declare const viteJasmine: (options: ViteJasmineOptions) => Plugin
export default viteJasmine
