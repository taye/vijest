import type { Config } from '@jest/types'
import type { TestResult } from '@jest/test-result'
import type { JestEnvironment } from '@jest/environment'
import type Runtime from 'jest-runtime'

import { INTERNAL } from '../constants'
import { Reporter } from './reporter'
import { getLaunch } from '../utils'
import Environment from './environment'

async function runner(
  globalConfig: Config.GlobalConfig,
  config: Config.ProjectConfig,
  environment: JestEnvironment,
  runtime: Runtime,
  testPath: string,
): Promise<TestResult> {
  if (!(environment as Environment)[INTERNAL]) {
    const defaultRunner =
      process.env.JEST_JASMINE === '1' ? require('jest-jasmine2') : require('jest-circus/runner')

    return defaultRunner(globalConfig, config, environment, runtime, testPath)
  }

  const reporter = new Reporter(globalConfig, config, testPath)
  const { startSpec } = await getLaunch()
  const { page } = await startSpec({ filename: testPath, reporter })
  const results = await reporter.getResults()

  await page.close()

  return results
}

runner.__filename = __filename

export default runner
