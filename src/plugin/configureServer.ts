import assert from 'assert'
import fs from 'fs/promises'
import { resolve } from 'path'

import type { Plugin } from 'vite'
import type WebSocket from 'ws'

import { HOST_BASE_PATH, REPORTER_QUESTIONS, URL_RE } from '../constants'
import { streamPromise } from '../utils'

import type { Internals } from '.'

const configureServer =
  (internals: Internals): Plugin['configureServer'] =>
  async (viteServer) => {
    const { isDev, rootDir, wss } = internals

    const template = await fs.readFile(resolve(rootDir, 'src', 'web', 'index.html')).then((b) => b.toString())

    const app = isDev ? viteServer.middlewares : internals.app
    const wsClients = new Map<string, WebSocket & { filename?: string }>()

    app.use(async (req, res, next) => {
      if (req.method !== 'GET') return next()

      const urlMatch = req.url!.match(URL_RE)
      const [url, subpath] = urlMatch || []

      if (subpath !== 'jasmine' && subpath !== 'spec') return next()

      const html = await viteServer.transformIndexHtml(url, template)

      return res.end(html)
    })

    app.use(HOST_BASE_PATH, async (req, res, next) => {
      if (req.method !== 'POST') return next()

      const method = req.url!.substr(1)

      try {
        const body = await streamPromise(req)
        const arg = JSON.parse(body.toString() || '{}')
        const message = JSON.stringify({ method, arg })

        const client = wsClients.get(arg.filename)

        assert(client)

        if (REPORTER_QUESTIONS.has(method)) {
          const response = await Promise.race<any>([
            new Promise((resolve) => {
              client.once('message', resolve)
              client.send(message)
            }),
            new Promise((resolve) => setTimeout(resolve, 200)),
          ])

          return res.end(response)
        } else {
          client.send(message)
          return res.end('null')
        }
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

    wss.on('connection', (ws: WebSocket & { filename?: string }) => {
      ws.once('message', (filenameMessage) => {
        const filename = (ws.filename = filenameMessage.toString())
        wsClients.set(filename, ws)
      })
    })

    Object.assign(internals, { httpServer, wss, viteServer })
  }

export default configureServer
