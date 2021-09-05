import { INTERNAL } from '../constants'
import { cacheConnection, launch } from '../launcher'

const setup = async () => {
  const launchState = await launch({
    // headless: false,
    // devtools: true,
    // slowMo: 500,
  })

  ;(global as any)[INTERNAL] = launchState

  await cacheConnection(launchState.connection)
}

setup.__filename = __filename

export default setup
