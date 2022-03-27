import { resolve } from 'path'

import type { VijestOptions } from '../..'
import type { Launcher } from '../connector'
import { cacheConnection, launch } from '../connector'
import { INTERNAL, PLUGIN_NAME } from '../constants'

const setup = async ({ rootDir }: { rootDir: string }) => {
  const { launch: launchOptions, ...serverOptions } = await getConfig(rootDir)

  const launchState = await launch({
    launch: launchOptions,
    ...serverOptions,
  })

  ;(global as unknown as { [INTERNAL]: Launcher })[INTERNAL] = launchState

  await cacheConnection(launchState.connection)
}

setup.__filename = __filename

export default setup

async function getConfig (rootDir: string): Promise<VijestOptions> {
  const configName = resolve(rootDir, PLUGIN_NAME + '.config.js')

  try {
    const config = await (await import(configName)).default
    return config
  } catch {
    return {}
  }
}
