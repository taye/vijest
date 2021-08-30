import { Readable } from 'stream'
import _glob from 'glob'
import { promisify } from 'util'
import { ViteDevServer } from 'vite'
import {join} from 'path'

const glob = promisify<(p: string, o: any) => Promise<string[]>>(_glob as any)

export async function getDepUrls ({ server, customResolve }: {
  server: import('vite').ViteDevServer
  customResolve: (s: string) => string
}) {
  const htmlDeps = {
    host: customResolve('host/index.ts'),
    client: customResolve('client/index.ts'),
  }

  const entryPromises = Object.entries(htmlDeps).map(async ([name, filename]) => [
    name, await resolveToUrl({ server, filename })
  ])
  const depIdEntries = await Promise.all(entryPromises)

  return Object.fromEntries(depIdEntries)
}

export function streamPromise (stream: Readable) {
  return new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []

    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

export async function getSpecs ({ cwd, pattern, server }: { cwd: string, pattern: string, server: ViteDevServer }) {
  const specFiles = await glob(pattern, { cwd, ignore: '**/node_modules/**' })

  const specs = await Promise.all(specFiles.map(async filename => ({
    filename,
    url: await resolveToUrl({ server, filename: join(cwd, filename) }),
  })))

  return `window.global = window; window.__specs = ${JSON.stringify(specs)}`
}

async function resolveToUrl({ server, filename }: { server: ViteDevServer, filename: string }) {
  // resolve dependency id
  const id = (await server.pluginContainer.resolveId(filename, __filename))?.id

  if (!id) throw Error(`[vite-jasmine] couldn't resolve "${filename}"`)

  // resolve, load and dransform
  await server.transformRequest(id)

  // get dep url from vite server moduleGraph
  return server.moduleGraph.getModuleById(id)!.url
}
