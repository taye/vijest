import { readFileSync } from 'fs'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import { resolve } from 'path'

import connect from 'connect'
import type { Plugin, ViteDevServer } from 'vite'
import type WebSocket from 'ws'

import type { VitestOptions } from '../../index.d'
import { INTERNAL, PLUGIN_NAME } from '../constants'
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
  viteServer?: ViteDevServer
  getBaseUrl: () => string
  close: () => Promise<void>
  isDev: boolean
  rootDir: string
  resolveWeb: (specifier: string) => string
  wsClients: Map<string, WebSocket & { filename?: string }>
}

export default function vitest (options: InternalOptions = {}): VitestPlugin {
  const isDev = !!options[INTERNAL]
  const rootDir = isDev ? resolve(__dirname, '..', '..') : __dirname

  const manifestPath = resolve(rootDir, 'dist', 'manifest.json')
  const manifest = isDev ? null : JSON.parse(readFileSync(manifestPath).toString())
  const resolveWeb = (id: string) => {
    id = 'src/web/' + id
    const chunkFile = manifest?.[id]?.file

    return chunkFile ? resolve(rootDir, 'dist', chunkFile) : resolve(rootDir, id)
  }

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
    isDev,
    resolveWeb,
    rootDir,
    options,
    app,
    getBaseUrl,
    httpServer: undefined,
    config: undefined,
    viteServer: undefined,
    wsClients: new Map<string, WebSocket & { filename?: string }>(),
    close: () =>
      Promise.all([internals.httpServer?.close(), internals.viteServer?.close()]).then(() => undefined),
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
