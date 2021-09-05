import { INTERNAL } from '../constants'
import { Launcher } from '../launcher'

const teardown = async () => {
  const { close } = (global as unknown as { [INTERNAL]: Launcher })[INTERNAL]

  await close()
}

teardown.__filename = __filename

export default teardown
