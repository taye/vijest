import { resolve, join } from 'path'
import fs from 'fs/promises'
import { readFileSync } from 'fs'
import connect from 'connect'
import queryString from 'query-string'
// @ts-expect-error
import WebSocket, { WebSocketServer } from 'ws'

import type { ViteJasmineOptions } from '../index.d'
import { addressToUrl, getDepUrls, getSpecs, streamPromise } from './utils'
import { HOST_BASE_PATH, INTERNAL, INTERNAL_SYMBOL_NAME, PLUGIN_NAME, URL_RE } from './constants'
import { Server } from 'http'
import { AddressInfo } from 'net'
import { CustomReporter } from './jest/reporter'
import { Plugin, ViteDevServer } from 'vite'
import assert from 'assert'

const MANIFEST_PATH = resolve(__dirname, './dist/manifest.json')

interface InternalOptions extends ViteJasmineOptions {
  [INTERNAL]?: boolean
}

export interface ViteJasminePlugin extends Plugin {
  [INTERNAL]: Internals
}

interface Internals {
  options: ViteJasmineOptions
  config?: ViteDevServer['config']
  app: connect.Server
  httpServer?: Server
  wss: any
  viteServer?: ViteDevServer
  getServerUrl: () => string
  /** @deprecated */
  hooks: Set<Partial<CustomReporter>>
  close: () => Promise<void>
}

export default function viteJasmine(options: InternalOptions = {}): ViteJasminePlugin {
  const isDev = options[INTERNAL]
  const app = connect()
  const wss = new WebSocketServer({ port: 0 })

  const getServerUrl = () => {
    const { baseUrl } = internals.options

    if (baseUrl) return baseUrl

    const address = internals.httpServer?.address() as AddressInfo | null
    const protocol = internals.config!.server.https ? 'https' : 'http'

    return addressToUrl(address, protocol)
  }

  const internals: ViteJasminePlugin[typeof INTERNAL] = {
    options,
    app,
    wss,
    getServerUrl,
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
      return { server: { middlewareMode: 'html', fs: { allow: [__dirname, process.cwd()] } } }
    },

    configResolved(config) {
      internals.config = config
    },

    async transformIndexHtml(html, { path, server }) {
      assert(server)

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
              children: await getSpecs({ server, filenames: query.spec || [] }),
            },
            {
              tag: 'script',
              children: `Object.assign(window, {
                global: window,
                [Symbol.for("${INTERNAL_SYMBOL_NAME}")]: { filename: ${JSON.stringify(query.spec)} }
              })`,
            },
            { tag: 'script', attrs: { type: 'module', src: depUrls.client } },
          ]

      return { html, tags }
    },

    async configureServer(viteServer) {
      const templates = Object.fromEntries(
        (['host', 'client'] as const).map((subpath) => [
          subpath,
          fs.readFile(resolve(__dirname, 'src', subpath, 'index.html')).then((b) => b.toString()),
        ]),
      )

      app.use(async (req, res, next) => {
        if (req.method !== 'GET') return next()

        const urlMatch = req.url!.match(URL_RE)

        if (!urlMatch) return next()

        const [url, subpath] = urlMatch
        const template = await templates[subpath || 'host']

        if (template) {
          const html = await viteServer.transformIndexHtml(url, template)
          return res.end(html)
        }

        next()
      })

      app.use(HOST_BASE_PATH, async (req, res, next) => {
        if (req.method !== 'POST') return next()

        const method = req.url!.substr(1)

        try {
          const body = await streamPromise(req)
          const arg: any = JSON.parse(body.toString() || '{}')

          for (const hook of [...internals.hooks]) {
            if (hook.filename && hook.filename !== arg.filename) continue

            await (hook as any)?.[method]?.(arg)
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

      const httpServer = app.listen(0)

      httpServer.on('upgrade', (request, socket, head) => {
        if (request.url !== HOST_BASE_PATH) return

        wss.handleUpgrade(request, socket, head, (ws: any) => {
          wss.emit('connection', ws, request)
        })
      })

      Object.assign(internals, { httpServer, wss, viteServer })
    },
  }
}
