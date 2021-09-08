import type { Plugin } from 'vite'

import { STUBBED_WEB_DEPS } from '../constants'

import type { Internals } from '.'

const config =
  ({ isDev, rootDir, resolveWeb }: Internals): Plugin['config'] =>
  () => {
    const stubFile = resolveWeb('stub.ts')

    return {
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
