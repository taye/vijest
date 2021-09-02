import { resolve, join } from 'path'
import fs from 'fs/promises'
import { readFileSync } from 'fs'
import JasmineConsoleReporter from 'jasmine-console-reporter'
import { Plugin } from 'vite'

import type { ViteJasmineOptions } from '../index.d'
import { getDepUrls, getSpecs, streamPromise } from './utils'
import { DEFAULT_SPEC_PATTERN, HOST_BASE_PATH, INTERNAL, PLUGIN_NAME, URL_RE } from './constants'

const MANIFEST_PATH = resolve(__dirname, './dist/manifest.json')

interface ViteJasminePluginInternal {
  options: ViteJasmineOptions
  disabled: boolean
  hooks: Set<Record<string | symbol, (arg: any) => Promise<void> | void>>
}

interface InternalOptions extends ViteJasmineOptions {
  [INTERNAL]?: boolean
}

export interface ViteJasminePlugin extends Omit<Plugin, 'config'> {
  [INTERNAL]: ViteJasminePluginInternal
  config: (arg: typeof INTERNAL) => ViteJasminePluginInternal
}

export default function viteJasmine(options: InternalOptions = {}): ViteJasminePlugin {
  const isDev = options[INTERNAL]

  const internals: ViteJasminePlugin[typeof INTERNAL] = {
    disabled: false,
    options,
    hooks: new Set(),
  }

  if (!isDev && process.env.NODE_ENV === 'production') {
    return {
      name: PLUGIN_NAME + ' [disabled when NODE_ENV === "production"]',
    } as any
  }

  const { baseUrl: origin, specs: pattern = DEFAULT_SPEC_PATTERN } = options

  const manifest = isDev ? null : JSON.parse(readFileSync(MANIFEST_PATH).toString())

  const customResolve = (id: string) => {
    id = join('src', id)
    const chunkFile = manifest[id]?.file

    return chunkFile ? resolve(__dirname, 'dist', chunkFile) : join('.', id)
  }

  let depUrlsPromise: Promise<Record<string, string>>

  internals.options = { specs: pattern, baseUrl: origin }

  return {
    name: PLUGIN_NAME,

    [INTERNAL]: internals,

    config: (arg) => {
      // allow getting internal state
      return arg === INTERNAL ? internals : (undefined as any)
    },

    async transformIndexHtml(html, { path, server }) {
      if (!server || (server.config.mode === 'production' && !isDev)) return

      const isHost = path === HOST_BASE_PATH
      const isClient = path === `${HOST_BASE_PATH}/client`

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
        const urlMatch = req.url?.match(URL_RE)

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
          res.end()

          await Promise.all([...internals.hooks].map((hook) => hook?.[method]?.(arg)))

          return
        }

        next()
      })
    },
  }
}
