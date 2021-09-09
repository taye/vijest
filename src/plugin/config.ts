import assert from 'assert'
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { resolve } from 'path'

import type { Plugin } from 'vite'

import { INTERNAL, STUBBED_WEB_DEPS } from '../constants'

import type { Internals, VitestPlugin } from '.'

const config =
  ({ isDev, rootDir }: Internals): Plugin['config'] =>
  async (config) => {
    const plugins = [...(config.plugins || [])] as VitestPlugin[]
    const pluginIndex = plugins.findIndex((p) => p[INTERNAL])!
    const pluginInstance = plugins[pluginIndex]

    assert(pluginInstance)

    plugins.splice(pluginIndex, 1)

    const stubs = await createStubs({ rootDir })

    return {
      plugins,
      server: isDev
        ? undefined
        : {
            // TODO: check if 'ssr' and comply
            middlewareMode: 'html',
            fs: { allow: [rootDir, process.cwd()] },
            open: false,
            hmr: false,
          },
      resolve: {
        alias: {
          ...Object.fromEntries([...STUBBED_WEB_DEPS].map((id) => [id, stubs.empty])),
          'supports-color': stubs.supportsColor,
        },
      },
      define: {
        'process.stderr': '""',
        'process.stdin': '""',
        'process.stdout': '""',
      },
      optimizeDeps: {
        exclude: [...STUBBED_WEB_DEPS, 'supports-color'],
      },
    }
  }

export default config

async function createStubs ({ rootDir, isDev }: Pick<Internals, 'rootDir' | 'isDev'>) {
  // TODO: distinct file for each instance
  const empty = resolve(rootDir, 'stub.js')
  const supportsColor = resolve(rootDir, 'supports-color.stub.js')

  if (!isDev && !existsBoolean(empty) && !existsBoolean(supportsColor)) {
    console.log('WOWWOWOWOWOWOW')
    const sc = await import('supports-color')

    await Promise.all([
      writeFile(empty, 'export default {}'),
      writeFile(supportsColor, `export default ${JSON.stringify(sc.default)};${exportProps(sc.default)}`),
    ])
  }

  return { empty, supportsColor }
}

function existsBoolean (path: string) {
  try {
    return existsSync(path)
  } catch {
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportProps (o: any) {
  return Object.entries(o)
    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)}`)
    .join(';')
}
