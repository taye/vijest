import type { Launcher } from '../connector'
import { INTERNAL } from '../constants'

const teardown = async () => {
  const { close } = (global as unknown as { [INTERNAL]: Launcher })[INTERNAL]

  await close()
}

teardown.__filename = __filename

export default teardown
