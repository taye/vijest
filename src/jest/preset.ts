import type { Config } from '@jest/types'
import runner from './runner'

const preset: Config.InitialProjectOptions = {
  testRunner: runner.__filename,
}

export default preset
