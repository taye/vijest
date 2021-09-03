import { Readable } from 'stream'
import { promisify } from 'util'
import { resolve } from 'path'
import { ResolvedConfig, UserConfig, ViteDevServer } from 'vite'
import { INTERNAL, PLUGIN_NAME } from './constants'
import { ViteJasminePlugin } from './plugin'

export async function getDepUrls({
  server,
  customResolve,
}: {
  server: import('vite').ViteDevServer
  customResolve: (s: string) => string
}) {
  const htmlDeps = {
    // host: customResolve('host/index.ts'),
    client: customResolve('client/index.ts'),
  }

  const entryPromises = Object.entries(htmlDeps).map(async ([name, filename]) => [
    name,
    await resolveToUrl({ server, filename }),
  ])
  const depIdEntries = await Promise.all(entryPromises)

  return Object.fromEntries(depIdEntries)
}

export function streamPromise(stream: Readable) {
  return new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []

    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

export async function getSpecs({
  cwd,
  filenames,
  server,
}: {
  cwd: string
  filenames: string | string[]
  server: ViteDevServer
}) {
  filenames = Array.isArray(filenames) ? filenames : [filenames]

  const specs = await Promise.all(
    filenames.map(async (filename) => ({
      filename,
      url: await resolveToUrl({ server, filename: resolve(cwd, filename) }),
    })),
  )

  return `window.global = window; window.__specs = ${JSON.stringify(specs)}`
}

export async function resolveToUrl({ server, filename }: { server: ViteDevServer; filename: string }) {
  // resolve dependency id
  const absolutePath = resolve(server.config.root, filename)
  const id = (await server.pluginContainer.resolveId(absolutePath, __filename))?.id

  if (!id) throw Error(`[vite-jasmine] couldn't resolve "${filename}"`)

  // resolve, load and dransform
  await server.transformRequest(id)

  // get dep url from vite server moduleGraph
  return server.moduleGraph.getModuleById(id)!.url
}

export function findPlugin(config: UserConfig | ResolvedConfig) {
  const plugins = (config?.plugins || []).flat() as unknown as ViteJasminePlugin[]

  return plugins.find((p) => p && p[INTERNAL])
}
