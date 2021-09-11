/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Config } from '@jest/types'
import { extractExpectedAssertionsErrors, getState, setState } from 'expect'
import type { Plugin } from 'pretty-format'

export type SetupOptions = {
  config: Config.ProjectConfig
  globalConfig: Config.GlobalConfig
  localRequire: (moduleName: string) => Plugin
  testPath: Config.Path
}

// Get suppressed errors form  jest-matchers that weren't throw during
// test execution and add them to the test result, potentially failing
// a passing test.
const addSuppressedErrors = (result: any) => {
  const { suppressedErrors } = getState()
  setState({ suppressedErrors: [] })
  if (suppressedErrors.length) {
    result.status = 'failed'

    result.failedExpectations = suppressedErrors.map((error) => ({
      actual: '',
      // passing error for custom test reporters
      error,
      expected: '',
      matcherName: '',
      message: error.message,
      passed: false,
      stack: error.stack,
    }))
  }
}

const addAssertionErrors = (result: any) => {
  const assertionErrors = extractExpectedAssertionsErrors()
  if (assertionErrors.length) {
    const jasmineErrors = assertionErrors.map(({ actual, error, expected }) => ({
      actual,
      expected,
      message: error.stack,
      passed: false,
    }))
    result.status = 'failed'
    result.failedExpectations = result.failedExpectations.concat(jasmineErrors)
  }
}

const patchSpec = (jasmineRequire: any) => {
  const Spec_ = jasmineRequire.Spec
  jasmineRequire.Spec = (jasmine: unknown) => {
    class Spec extends Spec_(jasmine) {
      constructor (attr: any) {
        const resultCallback = attr.resultCallback
        attr.resultCallback = function (result: any, ...args: unknown[]) {
          addSuppressedErrors(result)
          addAssertionErrors(result)
          resultCallback.call(attr, result, ...args)
        }
        const onStart = attr.onStart
        attr.onStart = (...args: unknown[]) => {
          setState({ currentTestName: this.getFullName() })
          onStart?.apply(attr, args)
        }
        super(attr)
      }

      onException (error: any) {
        const { matcherResult } = error

        if (matcherResult) {
          matcherResult.matcherName = matcherResult.name
          matcherResult.stack = error.stack
          matcherResult.passed = matcherResult.pass

          this.result.failedExpectations.push(matcherResult)
        } else {
          return super.onException(error)
        }
      }
    }

    return Spec
  }
}

export default patchSpec
