import type { Config } from '@jest/types'

import Environment from './environment'
import runner from './runner'
import setup from './setup'
import teardown from './teardown'

const preset: Config.InitialOptions = {
  testRunner: runner.__filename,
  testEnvironment: Environment.__filename,
  globalSetup: setup.__filename,
  globalTeardown: teardown.__filename,
  coverageProvider: 'v8',
}

export default preset
