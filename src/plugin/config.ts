import assert from 'assert'

import type { Plugin } from 'vite'

import { INTERNAL, STUBBED_WEB_DEPS } from '../constants'

import type { Internals, VitestPlugin } from '.'

const config =
  ({ isDev, rootDir, resolveWeb }: Internals): Plugin['config'] =>
  (config) => {
    const plugins = [...(config.plugins || [])] as VitestPlugin[]
    const pluginIndex = plugins.findIndex((p) => p[INTERNAL])!
    const pluginInstance = plugins[pluginIndex]

    assert(pluginInstance)

    plugins.splice(pluginIndex, 1)

    const stubFile = resolveWeb('stub.ts')

    return {
      plugins,
      server: isDev
        ? undefined
        : {
            middlewareMode: 'html',
            fs: { allow: [rootDir, process.cwd()] },
            open: false,
            hmr: false,
          },
      resolve: {
        alias: Object.fromEntries([...STUBBED_WEB_DEPS].map((id) => [id, stubFile])),
      },
      define: {
        'process.stderr': '""',
        'process.stdin': '""',
        'process.stdout': '""',
      },
      optimizeDeps: {
        exclude: [...STUBBED_WEB_DEPS],
      },
    }
  }

export default config
