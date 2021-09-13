import { resolve } from 'path'

import type { VitestOptions } from '../..'
import type { Launcher } from '../connector'
import { cacheConnection, launch } from '../connector'
import { INTERNAL, PLUGIN_NAME } from '../constants'

const setup = async () => {
  const { launch: launchOptions, ...serverOptions } = await getConfig()

  // FIXME: testEnvironmentOptions isn't available here?!
  const launchState = await launch({
    launch: launchOptions,
    ...serverOptions,
  })

  ;(global as unknown as { [INTERNAL]: Launcher })[INTERNAL] = launchState

  await cacheConnection(launchState.connection)
}

setup.__filename = __filename

export default setup

async function getConfig (): Promise<VitestOptions> {
  const configName = resolve(PLUGIN_NAME + '.config.js')

  try {
    const config = await (await import(configName)).default
    return config
  } catch {
    return {}
  }
}
