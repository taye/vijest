import assert from 'assert'
import fs from 'fs/promises'
import { resolve } from 'path'

import type { Plugin } from 'vite'

import { HOST_BASE_PATH, URL_RE } from '../constants'
import { streamPromise, timeout } from '../utils'

import type { Internals } from '.'

const configureServer =
  (internals: Internals): Plugin['configureServer'] =>
  async (viteServer) => {
    const { isDev, rootDir, wsClients } = internals

    const template = await fs.readFile(resolve(rootDir, 'html', 'index.html')).then((b) => b.toString())

    const app = isDev ? viteServer.middlewares : internals.app

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
      let requestCounter = 0

      try {
        const body = await streamPromise(req)
        const arg = JSON.parse(body.toString() || '{}')
        const requestId = ++requestCounter
        const message = JSON.stringify({ method, arg, requestId })
        const client = wsClients.get(arg.id)

        assert(client)

        const response = await timeout(
          new Promise((resolve) => {
            const onMessage = (data: Buffer) => {
              const json = JSON.parse(data.toString())

              if (json.requestId !== requestId) return

              res.statusCode = json.statusCode || res.statusCode
              resolve(JSON.stringify(json.response || null))
              client.off('message', onMessage)
            }

            client.on('message', onMessage)
            client.send(message)
          }),
          3000,
        )
        return res.end(response)
      } catch (error) {
        console.error(error)
        res.statusCode = 400
        res.end()
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

      httpServer.on('connection', (socket) => {
        internals.sockets.add(socket)
        socket.on('close', () => internals.sockets.delete(socket))
      })
    }

    Object.assign(internals, { httpServer, viteServer })
  }

export default configureServer
