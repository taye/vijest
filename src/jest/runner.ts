import type { TestResult } from '@jest/test-result'
import type { Config } from '@jest/types'
import type Runtime from 'jest-runtime'

import { INTERNAL } from '../constants'
import { connectToLauncher } from '../launcher'

import type Environment from './environment'
import { Reporter } from './reporter'

async function runner (
  globalConfig: Config.GlobalConfig,
  config: Config.ProjectConfig,
  environment: Environment,
  runtime: Runtime,
  testPath: string,
): Promise<TestResult> {
  if (!environment[INTERNAL]) {
    const defaultRunner =
      process.env.JEST_JASMINE === '1' ? require('jest-jasmine2') : require('jest-circus/runner')

    return defaultRunner(globalConfig, config, environment, runtime, testPath)
  }

  const reporter = new Reporter(globalConfig, config, testPath, environment)
  const { startSpec, browser } = await connectToLauncher()
  const { page } = await startSpec({ filename: testPath, reporter })

  const results = await reporter.getResults()

  page.close()

  return results
}

runner.__filename = __filename

export default runner
