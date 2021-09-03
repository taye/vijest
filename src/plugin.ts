import { resolve, join } from 'path'
import fs from 'fs/promises'
import { readFileSync } from 'fs'
import connect from 'connect'
import JasmineConsoleReporter from 'jasmine-console-reporter'
import { Plugin, ViteDevServer } from 'vite'
import queryString from 'query-string'

import type { ViteJasmineOptions } from '../index.d'
import { getDepUrls, getSpecs, streamPromise } from './utils'
import { INTERNAL, PLUGIN_NAME, URL_RE } from './constants'
import { Server } from 'http'
import { AddressInfo } from 'net'

const MANIFEST_PATH = resolve(__dirname, './dist/manifest.json')

interface InternalOptions extends ViteJasmineOptions {
  [INTERNAL]?: boolean
}

export interface ViteJasminePlugin extends Plugin {
  [INTERNAL]: Internals
}

interface Internals {
  options: ViteJasmineOptions
  config: ViteDevServer['config']
  app: connect.Server
  httpServer: Server
  getServerUrl: () => string
  hooks: Set<Record<string | symbol, (arg: any) => Promise<void> | void>>
}

export default function viteJasmine(options: InternalOptions = {}): ViteJasminePlugin {
  const isDev = options[INTERNAL]
  const app = connect()

  const getServerUrl = () => {
    const { baseUrl } = internals.options

    if (baseUrl) return baseUrl

    const addressInfo = internals.httpServer?.address() as AddressInfo | null

    if (!addressInfo) return ''

    const protocol = internals.config.server.https ? 'https' : 'http'
    const address = /:/.test(addressInfo.address) ? `[${addressInfo.address}]` : addressInfo.address

    return `${protocol}://${address}:${addressInfo.port}`
  }

  const internals: ViteJasminePlugin[typeof INTERNAL] = {
    options,
    app,
    getServerUrl,
    httpServer: null as any,
    config: null as any,
    hooks: new Set(),
  }

  const manifest = isDev ? null : JSON.parse(readFileSync(MANIFEST_PATH).toString())

  const customResolve = (id: string) => {
    id = join('src', id)
    const chunkFile = manifest[id]?.file

    return chunkFile ? resolve(__dirname, 'dist', chunkFile) : join('.', id)
  }

  let depUrlsPromise: Promise<Record<string, string>>

  return {
    name: PLUGIN_NAME,

    [INTERNAL]: internals,

    config() {
      return { server: { middlewareMode: 'html', fs: { allow: [__dirname] } } }
    },

    configResolved(config) {
      internals.config = config
    },

    async transformIndexHtml(html, { path, server }) {
      if (!server) return

      const [_, subpath, search] = path.match(URL_RE) || []

      const isHost = subpath === ''
      const isClient = subpath === 'client'

      if (!isHost && !isClient) {
        return
      }

      const query = queryString.parse(search)

      const depUrls = await (depUrlsPromise = depUrlsPromise || getDepUrls({ server, customResolve }))

      const tags = isHost
        ? [
            { tag: 'script', children: 'alert("TODO: interactive test runs etc.")' },
            { tag: 'script', attrs: { type: 'module', src: depUrls.host } },
          ]
        : [
            {
              tag: 'script',
              children: await getSpecs({ server, cwd: internals.config.root, filenames: query.spec || [] }),
            },
            { tag: 'script', children: 'window.global = window' },
            { tag: 'script', attrs: { type: 'module', src: depUrls.client } },
          ]

      return { html, tags }
    },

    async configureServer(server) {
      const jasmineReporter = new JasmineConsoleReporter()

      const templates = Object.fromEntries(
        (['host', 'client'] as const).map((subpath) => [
          subpath,
          fs.readFile(resolve(__dirname, 'src', subpath, 'index.html')).then((b) => b.toString()),
        ]),
      )

      // TODO: accept only connections from host machine's IP?
      app.use(async (req, res, next) => {
        const urlMatch = req.url!.match(URL_RE)

        if (!urlMatch) return next()

        const [url, subpath] = urlMatch
        const template = await templates[subpath || 'host']

        if (template) {
          const html = await server.transformIndexHtml(url, template)
          return res.end(html)
        }

        if (subpath === 'report') {
          const body = await streamPromise(req)

          const { method, arg } = JSON.parse(body.toString() || '{}')

          jasmineReporter[method]?.(arg)
          res.end()

          await Promise.all([...internals.hooks].map((hook) => hook?.[method]?.(arg)))

          return
        }

        next()
      })

      app.use(server.middlewares)
      internals.httpServer = app.listen(0)
    },
  }
}
