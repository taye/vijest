import { resolve } from 'path'

import { VitestOptions } from '../..'
import { INTERNAL, PLUGIN_NAME } from '../constants'
import { cacheConnection, launch, Launcher } from '../launcher'

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

async function getConfig(): Promise<VitestOptions> {
  const configName = resolve(PLUGIN_NAME + '.config.js')

  try {
    const config = await (await import(configName)).default
    return config
  } catch {
    return {}
  }
}
