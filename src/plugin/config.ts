import assert from 'assert'
import { writeFile } from 'fs/promises'
import { resolve } from 'path'

import type { Plugin } from 'vite'

import { INTERNAL } from '../constants'

import type { Internals, VijestPlugin } from '.'

const config =
  ({ isDev, rootDir, resolveWeb }: Internals): Plugin['config'] =>
  async (config) => {
    const plugins = [...(config.plugins || [])] as VijestPlugin[]
    const pluginIndex = plugins.findIndex((p) => p[INTERNAL])!
    const pluginInstance = plugins[pluginIndex]

    assert(pluginInstance)

    plugins.splice(pluginIndex, 1)
    plugins.unshift(pluginInstance)

    const stubs = await createStubs({ rootDir })

    return {
      plugins,
      logLevel: 'error',
      server: isDev
        ? undefined
        : {
            // TODO: check if 'ssr' and comply
            middlewareMode: 'html',
            fs: { allow: [rootDir, process.cwd()] },
            open: false,
            hmr: false,
            watch: { ignored: () => true },
          },
      resolve: {
        alias: {
          path: 'path-browserify',
          ...(isDev
            ? {
                'graceful-fs': stubs.empty,
                // 'jest-util': resolve(rootDir, 'src', 'web', 'jest-util.ts'),
              }
            : {
                'jest-util': resolveWeb('jest-util.ts'),
                'graceful-fs': resolveWeb('remoteFs.ts'),
              }),
          'supports-color': stubs.supportsColor,
          'jest-snapshot': resolveWeb('jest-snapshot/index.ts'),
        },
      },
      define: {
        'process.stderr': '""',
        'process.stdin': '""',
        'process.stdout': '""',
        'process.platform': '""',
        'process.env': '""',
      },
      optimizeDeps: {
        include: ['jest-util', 'jest-mock', 'expect', 'chalk'],
      },
    }
  }

export default config

async function createStubs ({ rootDir }: Pick<Internals, 'rootDir'>) {
  // TODO: distinct file for each instance
  const empty = resolve(rootDir, 'empty-module.js')
  const supportsColor = resolve(rootDir, '_supports-color.stub.js')

  const sc = await import('supports-color')

  await writeFile(supportsColor, `export default ${JSON.stringify(sc.default)};${exportProps(sc.default)}`)

  return { empty, supportsColor }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportProps (o: any) {
  return Object.entries(o)
    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)}`)
    .join(';')
}
