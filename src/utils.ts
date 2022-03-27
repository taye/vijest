import assert from 'assert'
import type { AddressInfo } from 'net'
import { relative, sep } from 'path'
import type { Readable } from 'stream'
import timers from 'timers/promises'

import type { ShouldInstrumentOptions } from '@jest/transform'
import { shouldInstrument } from '@jest/transform'
import type { Config } from '@jest/types'
import type { CoverageEntry } from 'puppeteer'
import puppeteerToV8 from 'puppeteer-to-istanbul/lib/puppeteer-to-v8'
import type { ResolvedConfig, UserConfig, ViteDevServer } from 'vite'

import type { LaunchConnection } from './connector'
import { INTERNAL, PLUGIN_NAME } from './constants'
import type { VijestPlugin } from './plugin'

export async function getDepUrls ({
  server,
  resolveWeb,
}: {
  server: ViteDevServer
  resolveWeb: (s: string) => string
}) {
  const htmlDeps = {
    jasmine: resolveWeb('jasmine.ts'),
    spec: resolveWeb('spec.ts'),
  }

  const entryPromises = Object.entries(htmlDeps).map(async ([name, filename]) => [
    name,
    await resolveToUrl({ server, filename }),
  ])
  const depIdEntries = await Promise.all(entryPromises)

  return Object.fromEntries(depIdEntries) as { [k in keyof typeof htmlDeps]: string }
}

export function streamPromise (stream: Readable) {
  return new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []

    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

export async function getSpecJson ({ filename, server }: { filename: string; server: ViteDevServer }) {
  const spec = {
    filename,
    url: await resolveToUrl({ server, filename: filename }),
  }

  return JSON.stringify(spec)
}

export async function resolveToUrl ({ server, filename }: { server: ViteDevServer; filename: string }) {
  let relativePath = relative(server.config.root, filename)

  if (relativePath[0] !== '.') {
    relativePath = '.' + sep + relativePath
  }

  const id = (await server.pluginContainer.resolveId(relativePath))?.id

  assert(id, message(`couldn't resolve "${filename}"`))

  // resolve, load and dransform
  await server.transformRequest(id)

  // get dep url from vite server moduleGraph
  return server.moduleGraph.getModuleById(id)!.url
}

export function findPlugin (config: UserConfig | ResolvedConfig) {
  const plugins = (config?.plugins || []).flat() as unknown as VijestPlugin[]

  return plugins.find((p) => p && p[INTERNAL])
}

export function message (s: string) {
  return `[${PLUGIN_NAME}] ${s}`
}

export function addressToUrl (addressInfo: AddressInfo | null, protocol: string) {
  if (!addressInfo) return ''

  const address = /:/.test(addressInfo.address) ? `[${addressInfo.address}]` : addressInfo.address

  return `${protocol}://${address}:${addressInfo.port}`
}

export async function timeout<T> (valuePromise: Promise<T>, n: number) {
  let resolved = false
  const timeoutController = new AbortController()
  const timeoutPromise = timers
    .setTimeout<never>(n, undefined, { ref: false, signal: timeoutController.signal })
    .catch((error) => {
      if (resolved) return
      throw error
    })
  const value = await Promise.race([valuePromise, timeoutPromise])

  resolved = true
  timeoutController.abort()

  return value
}

export async function convertCoverage ({
  puppeteerCoverage,
  connection,
  coverageOptions,
  config,
}: {
  puppeteerCoverage: CoverageEntry[]
  connection: LaunchConnection
  coverageOptions: ShouldInstrumentOptions
  config: Config.ProjectConfig
}) {
  const correctedUrls = puppeteerCoverage
    .filter(({ url }) => url.startsWith(connection.baseUrl) && shouldInstrument(url, coverageOptions, config))
    .map((c) => {
      // urls to absolute file paths
      c.url = c.url.slice(connection.baseUrl.length)
      if (!c.url.startsWith(connection.rootDir)) c.url = connection.rootDir + c.url
      return c
    })

  return puppeteerToV8(correctedUrls).convertCoverage()
}

function ansiRegex ({ onlyFirst = false } = {}) {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  ].join('|')

  return new RegExp(pattern, onlyFirst ? undefined : 'g')
}

export function stripAnsi (string: string) {
  return string.replace(ansiRegex(), '')
}
