import { INTERNAL } from '../constants'

const teardown = async () => {
  const { close } = (global as any)[INTERNAL]

  await close()
}

teardown.__filename = __filename

export default teardown
