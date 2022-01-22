import type { TestResult } from '@jest/test-result'
import type { Config } from '@jest/types'
import type Runtime from 'jest-runtime'
import { buildSnapshotResolver } from 'jest-snapshot'
import { SnapshotState } from 'jest-snapshot'

import { connect } from '../connector'
import { INTERNAL } from '../constants'

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

  const { expand, updateSnapshot } = globalConfig
  const { prettierPath, snapshotFormat } = config
  const localRequire: Runtime['requireModule'] = (...args) => runtime.requireModule(...args)
  const snapshotResolver = await buildSnapshotResolver(config, localRequire)
  const snapshotPath = snapshotResolver.resolveSnapshotPath(testPath)
  const snapshotState = new SnapshotState(snapshotPath, {
    expand,
    prettierPath,
    snapshotFormat,
    updateSnapshot,
  })

  const reporter = new Reporter({ globalConfig, config, testPath, environment, snapshotState })
  const { startSpec } = await connect({ filename: testPath, reporter })
  const { close } = await startSpec()
  const results = await reporter.getResults()

  close()

  return results
}

runner.__filename = __filename

export default runner
