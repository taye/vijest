import type { Config } from '@jest/types'
import type { TestResult } from '@jest/test-result'
import type { JestEnvironment } from '@jest/environment'
import type Runtime from 'jest-runtime'
import { extract, parse } from 'jest-docblock'

import { launch } from '../launcher'
import { PLUGIN_NAME } from '../constants'
import { readFile } from 'fs/promises'

const launchPromise = launch({
  // headless: false,
  // devtools: true,
  // slowMo: 500,
})

async function runner(
  globalConfig: Config.GlobalConfig,
  config: Config.ProjectConfig,
  environment: JestEnvironment,
  runtime: Runtime,
  testPath: string,
): Promise<TestResult> {
  // TODO: read only until '*/'
  const source = (await readFile(testPath)).toString()
  const pragmas = parse(extract(source))
  const env = pragmas?.['jest-environment']

  if (env && env !== PLUGIN_NAME) {
    const defaultRunnerSpecifier =
      process.env.JEST_JASMINE === '1'
        ? require.resolve('jest-jasmine2')
        : require.resolve('jest-circus/runner')

    const defaultRunner = runtime.requireModule<typeof runner>(defaultRunnerSpecifier)
    return defaultRunner(globalConfig, config, environment, runtime, testPath)
  }

  const { startSpec } = await launchPromise
  const { page, results } = await startSpec(testPath)

  await page.close()

  return results
}

runner.__filename = __filename

export default runner
