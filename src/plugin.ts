import assert from 'assert'
import { readFileSync } from 'fs'
import fs from 'fs/promises'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import { resolve, join } from 'path'

import connect from 'connect'
import queryString from 'query-string'
import type { Plugin, ViteDevServer } from 'vite'
// @ts-expect-error
import { WebSocketServer } from 'ws'

import type { VitestOptions } from '../index.d'

import { HOST_BASE_PATH, INTERNAL, INTERNAL_SYMBOL_NAME, PLUGIN_NAME, URL_RE } from './constants'
import type { CustomReporter } from './jest/reporter'
import { addressToUrl, getDepUrls, getSpecs, streamPromise } from './utils'

const MANIFEST_PATH = resolve(__dirname, './dist/manifest.json')

interface InternalOptions extends VitestOptions {
  [INTERNAL]?: boolean
}

export interface VitestPlugin extends Plugin {
  [INTERNAL]: Internals
}

interface Internals {
  options: VitestOptions
  config?: ViteDevServer['config']
  app: connect.Server
  httpServer?: Server
  wss: WebSocketServer
  viteServer?: ViteDevServer
  getBaseUrl: () => string
  /** @deprecated */
  hooks: Set<Partial<CustomReporter>>
  close: () => Promise<void>
}

export default function vitest (options: InternalOptions = {}): VitestPlugin {
  const isDev = options[INTERNAL]
  const app = connect()

  const getBaseUrl = () => {
    const base = internals.config?.base

    if (/^http[s]?:/.test(base || '')) {
      const url = new URL(base!)
      return url.href
    }

    const address = internals.httpServer?.address() as AddressInfo | null
    const protocol = internals.config!.server.https ? 'https' : 'http'

    return addressToUrl(address, protocol)
  }

  const internals: VitestPlugin[typeof INTERNAL] = {
    options,
    app,
    getBaseUrl,
    wss: undefined,
    httpServer: undefined,
    config: undefined,
    viteServer: undefined,
    hooks: new Set(),
    close: () =>
      Promise.all([internals.httpServer?.close(), internals.wss.close(), internals.viteServer?.close()]).then(
        () => undefined,
      ),
  }

  const manifest = isDev ? null : JSON.parse(readFileSync(MANIFEST_PATH).toString())

  const resolveWeb = (id: string) => {
    id = 'src/web/' + id
    const chunkFile = manifest[id]?.file

    return chunkFile ? resolve(__dirname, 'dist', chunkFile) : join('.', id)
  }

  let depUrlsPromise: Promise<ReturnType<typeof getDepUrls>>

  return {
    name: PLUGIN_NAME,

    [INTERNAL]: internals,

    config () {
      return {
        server: {
          middlewareMode: 'html',
          fs: { allow: [__dirname, process.cwd()] },
          open: false,
          hmr: false,
        },
      }
    },

    configResolved (config) {
      internals.config = config
    },

    async load (id) {
      if (/supports-color/.test(id)) {
        const { default: supportsColor } = await import(/* @vite-ignore */ 'supports-color')

        return { code: `export default ${JSON.stringify(supportsColor)}`, map: null }
      }

      if (id.includes('jest-util/build/isInteractive')) {
        return { code: 'export default false', map: undefined }
      }

      return null
    },

    async transformIndexHtml (html, { path, server }) {
      if (isDev) return undefined

      assert(server)

      const [_, subpath, search] = path.match(URL_RE) || []

      const isJasmine = subpath === 'jasmine'
      const isSpec = subpath === 'spec'

      if (!isJasmine && !isSpec) return

      const query = queryString.parse(search)
      const depUrls = await (depUrlsPromise = depUrlsPromise || getDepUrls({ server, resolveWeb }))

      const tags = isJasmine
        ? [
            {
              tag: 'script',
              children: `Object.assign(window, {
                global: window,
                [Symbol.for("${INTERNAL_SYMBOL_NAME}")]: { filename: ${JSON.stringify(query.spec)} }
              })`,
            },
            {
              tag: 'script',
              children: await getSpecs({ server, filenames: query.spec || [] }),
            },
            { tag: 'script', attrs: { type: 'module', src: depUrls.jasmine } },
          ]
        : [{ tag: 'script', attrs: { type: 'module', src: depUrls.spec } }]

      return { html, tags }
    },

    async configureServer (viteServer) {
      if (isDev) return

      const template = await fs
        .readFile(resolve(__dirname, 'src', 'web', 'index.html'))
        .then((b) => b.toString())

      app.use(async (req, res, next) => {
        if (req.method !== 'GET') return next()

        const urlMatch = req.url!.match(URL_RE)
        const [url, subpath] = urlMatch || []

        if (!url || (subpath !== 'jasmine' && subpath !== 'spec')) return next()

        const html = await viteServer.transformIndexHtml(url, template)

        return res.end(html)
      })

      app.use(HOST_BASE_PATH, async (req, res, next) => {
        if (req.method !== 'POST') return next()

        const method = req.url!.substr(1)

        try {
          const body = await streamPromise(req)
          const arg = JSON.parse(body.toString() || '{}')

          for (const hook of [...internals.hooks]) {
            if (hook.filename && hook.filename !== arg.filename) continue

            // @ts-expect-error
            await hook?.[method]?.(arg)
          }

          const message = JSON.stringify({ method, arg })

          // send event to every ws client
          for (const client of internals.wss.clients) {
            await client.send(message)
          }

          return res.end('{}')
        } catch (error) {
          console.error(error)
          res.end(400)
        }

        res.end()
      })

      app.use(viteServer.middlewares)

      const { strictPort, host } = viteServer.config.server
      const port = strictPort ? viteServer.config.server.port : 0
      const hostname = typeof host === 'boolean' ? (host ? '0.0.0.0' : '127.0.0.1') : host

      const httpServer = app.listen(port as number, hostname)

      const wss = new WebSocketServer({ port: 0 })

      Object.assign(internals, { httpServer, wss, viteServer })
    },
  }
}
