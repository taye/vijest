import { INTERNAL } from '../constants'
import { cacheConnection, launch, Launcher } from '../launcher'

const setup = async () => {
  const launchState = await launch({
    // headless: false,
    // devtools: true,
    // slowMo: 500,
  })

  ;(global as unknown as { [INTERNAL]: Launcher })[INTERNAL] = launchState

  await cacheConnection(launchState.connection)
}

setup.__filename = __filename

export default setup
