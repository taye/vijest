import { readFileSync } from 'fs'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import { resolve } from 'path'

import connect from 'connect'
import type { Plugin, ViteDevServer } from 'vite'
// @ts-expect-error
import { WebSocketServer } from 'ws'

import type { VitestOptions } from '../../index.d'
import { INTERNAL, PLUGIN_NAME } from '../constants'
import type { CustomReporter } from '../jest/reporter'
import { addressToUrl } from '../utils'

import config from './config'
import configureServer from './configureServer'
import transformIndexHtml from './transformIndexHtml'

interface InternalOptions extends VitestOptions {
  [INTERNAL]?: boolean
}

export interface VitestPlugin extends Plugin {
  [INTERNAL]: Internals
}

export interface Internals {
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
  isDev: boolean
  rootDir: string
  resolveWeb: (specifier: string) => string
}

export default function vitest (options: InternalOptions = {}): VitestPlugin {
  const isDev = !!options[INTERNAL]
  const rootDir = isDev ? resolve(__dirname, '..', '..') : __dirname

  const manifestPath = resolve(rootDir, 'dist', 'manifest.json')
  const manifest = isDev ? null : JSON.parse(readFileSync(manifestPath).toString())
  const resolveWeb = (id: string) => {
    id = 'src/web/' + id
    const chunkFile = manifest?.[id]?.file

    return chunkFile ? resolve(rootDir, 'dist', chunkFile) : './' + id
  }

  const app = connect()
  const wss = new WebSocketServer({ port: 0 })

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
    isDev,
    resolveWeb,
    rootDir,
    options,
    app,
    getBaseUrl,
    wss,
    httpServer: undefined,
    config: undefined,
    viteServer: undefined,
    hooks: new Set(),
    close: () =>
      Promise.all([internals.httpServer?.close(), internals.wss.close(), internals.viteServer?.close()]).then(
        () => undefined,
      ),
  }

  return {
    name: PLUGIN_NAME,

    [INTERNAL]: internals,

    config: config(internals),

    configResolved (config) {
      internals.config = config
    },

    transformIndexHtml: transformIndexHtml(internals),

    configureServer: configureServer(internals),
  }
}
