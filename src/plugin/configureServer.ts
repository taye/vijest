import fs from 'fs/promises'
import { resolve } from 'path'

import type { Plugin } from 'vite'

import { HOST_BASE_PATH, URL_RE } from '../constants'
import { streamPromise } from '../utils'

import type { Internals } from '.'

const configureServer =
  (internals: Internals): Plugin['configureServer'] =>
  async (viteServer) => {
    const { isDev, rootDir, hooks, wss } = internals

    const template = await fs.readFile(resolve(rootDir, 'src', 'web', 'index.html')).then((b) => b.toString())

    const app = isDev ? viteServer.middlewares : internals.app

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

    let httpServer

    if (!isDev) {
      app.use(viteServer.middlewares)

      const { strictPort, host } = viteServer.config.server
      const port = strictPort ? viteServer.config.server.port : 0
      const hostname = typeof host === 'boolean' ? (host ? '0.0.0.0' : '127.0.0.1') : host

      httpServer = app.listen(port as number, hostname)
    }

    Object.assign(internals, { httpServer, wss, viteServer })
  }

export default configureServer
