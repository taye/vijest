import { Readable } from 'stream'

export async function getDepUrls ({ server, customResolve }: {
  server: import('vite').ViteDevServer
  customResolve: (s: string) => string
}) {
  const htmlDeps = {
    host: customResolve('host/index.ts'),
    client: customResolve('client/index.ts'),
  }

  // resolve html dependencies
  const depIdEntries = await Promise.all(Object.entries(htmlDeps).map(async ([name, path]) => [
    name, (await server.pluginContainer.resolveId(path, __filename)).id
  ]))

  // resolve, load and dransform deps
  await Promise.all(depIdEntries.map(([_name, id]) => server.transformRequest(id)))

  // get dep urls from vite server moduleGraph
  return Object.fromEntries(depIdEntries.map(([name, id]) => [
    name, server.moduleGraph.getModuleById(id).url
  ]))
}

export function streamPromise (stream: Readable) {
  return new Promise<Buffer>((resolve) => {
    const chunks = []

    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}
