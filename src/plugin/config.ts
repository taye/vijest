import assert from 'assert'
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { resolve } from 'path'

import type { Plugin } from 'vite'

import { INTERNAL, STUBBED_WEB_DEPS } from '../constants'

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
          ...Object.fromEntries([...STUBBED_WEB_DEPS].map((id) => [id, stubs.empty])),
          ...(isDev
            ? {
                'graceful-fs': stubs.empty,
                // 'jest-util': resolve(rootDir, 'src', 'web', 'jest-util.ts'),
              }
            : {
                'jest-util': resolveWeb('jest-util.ts'),
                'graceful-fs': resolve(rootDir, 'src', 'web', 'remoteFs.ts'),
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
        exclude: [...STUBBED_WEB_DEPS, 'graceful-fs', 'supports-color'],
        include: ['jest-util'],
      },
    }
  }

export default config

async function createStubs ({ rootDir }: Pick<Internals, 'rootDir'>) {
  // TODO: distinct file for each instance
  const empty = resolve(rootDir, '_empty.js')
  const supportsColor = resolve(rootDir, '_supports-color.stub.js')

  const sc = await import('supports-color')

  await Promise.all([
    exists(empty) || writeFile(empty, 'export default {}'),
    exists(supportsColor) ||
      writeFile(supportsColor, `export default ${JSON.stringify(sc.default)};${exportProps(sc.default)}`),
  ] as Array<Promise<void>>)

  return { empty, supportsColor }
}

function exists (path: string) {
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
