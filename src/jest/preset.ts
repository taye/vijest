import type { Config } from '@jest/types'
import Environment from './environment'
import runner from './runner'

const preset: Config.InitialProjectOptions = {
  testRunner: runner.__filename,
  testEnvironment: Environment.__filename,
}

export default preset
