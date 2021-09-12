import assert from 'assert'
import type { AddressInfo } from 'net'
import { relative, sep } from 'path'
import type { Readable } from 'stream'

import type { ResolvedConfig, UserConfig, ViteDevServer } from 'vite'

import { INTERNAL, PLUGIN_NAME } from './constants'
import type { VitestPlugin } from './plugin'

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

export async function getSpec ({ filename, server }: { filename: string; server: ViteDevServer }) {
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
  const plugins = (config?.plugins || []).flat() as unknown as VitestPlugin[]

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
