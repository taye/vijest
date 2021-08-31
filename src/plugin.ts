import { resolve, join } from 'path'
import fs from 'fs/promises'
import { readFileSync } from 'fs'
import JasmineConsoleReporter from 'jasmine-console-reporter'
import { Plugin } from 'vite'

import type { ViteJasmineOptions } from '../index.d'
import { getDepUrls, getSpecs, streamPromise } from './utils'

const devModeKey = Symbol('vite-jasmine-dev-mode')

const NAME = 'vite-jasmine'
const MANIFEST_PATH = resolve(__dirname, './dist/manifest.json')

export default function viteJasmine(options: ViteJasmineOptions = {}): Plugin {
  const isDev: boolean = (options as any)[devModeKey]

  if (!isDev && process.env.NODE_ENV === 'production') {
    return { name: NAME + ' [disabled with NODE_ENV === "production"' }
  }

  const { specs: pattern = '**/*.spec.{t,j}s{,x}' } = options

  const manifest = isDev ? null : JSON.parse(readFileSync(MANIFEST_PATH).toString())

  const customResolve = (id: string) => {
    id = join('src', id)
    const chunkFile = manifest[id]?.file

    return chunkFile ? resolve(__dirname, 'dist', chunkFile) : join('.', id)
  }

  let depUrlsPromise: Promise<Record<string, string>>

  return {
    name: NAME,

    async transformIndexHtml(html, { path, server }) {
      if (!server || (server.config.mode === 'production' && !isDev)) return

      const isHost = path === '/@jasmine'
      const isClient = path === '/@jasmine/client'

      if (!isHost && !isClient) {
        return
      }

      const depUrls = await (depUrlsPromise = depUrlsPromise || getDepUrls({ server, customResolve }))

      const tags = isHost
        ? [
            { tag: 'script', children: await getSpecs({ server, cwd: server.config.root, pattern }) },
            { tag: 'script', attrs: { type: 'module', src: depUrls.host } },
          ]
        : [
            { tag: 'script', children: 'window.global = window' },
            { tag: 'script', attrs: { type: 'module', src: depUrls.client } },
          ]

      return { html, tags }
    },

    configureServer(server) {
      const jasmineReporter = new JasmineConsoleReporter()

      const templates = Object.fromEntries(
        (['host', 'client'] as const).map((subpath) => [
          subpath,
          fs.readFile(resolve(__dirname, 'src', subpath, 'index.html')).then((b) => b.toString()),
        ]),
      )

      // TODO: accept only connections from host machine's IP?
      server.middlewares.use(async (req, res, next) => {
        const urlMatch = req.url?.match(/^\/@jasmine[/]?([^?]*)/)

        if (!urlMatch) return next()

        const [url, subpath] = urlMatch
        const template = await templates[subpath || 'host']

        if (template) {
          const html = await server.transformIndexHtml(url, template)
          return res.end(html)
        }

        if (subpath === 'report') {
          const body = await streamPromise(req)

          const { method, arg } = JSON.parse(body.toString())

          jasmineReporter[method](arg)

          return res.end()
        }

        next()
      })
    },
  }
}

/** @internal */
viteJasmine._dev = devModeKey
