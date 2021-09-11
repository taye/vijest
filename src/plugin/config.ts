import assert from 'assert'
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'

import type { Plugin } from 'vite'

import { INTERNAL, STUBBED_WEB_DEPS } from '../constants'

import type { Internals, VitestPlugin } from '.'

const config =
  ({ isDev, rootDir, resolveWeb }: Internals): Plugin['config'] =>
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
          path: 'path-browserify',
          ...Object.fromEntries([...STUBBED_WEB_DEPS].map((id) => [id, stubs.empty])),
          ...(isDev ? { 'graceful-fs': resolve(rootDir, 'src', 'web', 'remoteFs.ts') } : {}),
          'supports-color': stubs.supportsColor,
          'jest-util': stubs.jestUtil,
          'jest-snapshot': resolve(resolveWeb('jest-snapshot/index.ts')),
        },
      },
      define: {
        'process.stderr': '""',
        'process.stdin': '""',
        'process.stdout': '""',
        'process.platform': '""',
      },
      optimizeDeps: {
        exclude: [...STUBBED_WEB_DEPS, 'supports-color'],
      },
    }
  }

export default config

async function createStubs ({ rootDir }: Pick<Internals, 'rootDir'>) {
  // TODO: distinct file for each instance
  const empty = resolve(rootDir, '_empty.js')
  const supportsColor = resolve(rootDir, '_supports-color.stub.js')
  const jestUtil = resolve(rootDir, '_jest-util.js')
  const ju = dirname(require.resolve('jest-util'))

  const sc = await import('supports-color')

  await Promise.all([
    exists(empty) || writeFile(empty, 'export default {}'),
    exists(supportsColor) ||
      writeFile(supportsColor, `export default ${JSON.stringify(sc.default)};${exportProps(sc.default)}`),
    exists(jestUtil) ||
      writeFile(
        jestUtil,
        `
export {default as createDirectory} from '${ju}/createDirectory';
export {default as isInteractive} from '${ju}/isInteractive';
export {default as isPromise} from '${ju}/isPromise';
export {default as deepCyclicCopy} from '${ju}/deepCyclicCopy';
export {default as convertDescriptorToString} from '${ju}/convertDescriptorToString';
export * as specialChars from '${ju}/specialChars';
export {default as replacePathSepForGlob} from '${ju}/replacePathSepForGlob';
export {default as globsToMatcher} from '${ju}/globsToMatcher';
export {default as pluralize} from '${ju}/pluralize';
export {default as formatTime} from '${ju}/formatTime';
export {default as tryRealpath} from '${ju}/tryRealpath';
`,
      ),
  ] as Array<Promise<void>>)

  return { empty, supportsColor, jestUtil }
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
