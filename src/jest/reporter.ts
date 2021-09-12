/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs'
import { normalize } from 'path'

import type { AssertionResult, TestResult } from '@jest/test-result'
import { createEmptyTestResult } from '@jest/test-result'
import type { Config } from '@jest/types'
import { formatResultsErrors } from 'jest-message-util'
import type { SnapshotStateType } from 'jest-snapshot'

import type { CONSOLE_METHODS } from '../constants'
import { ALLOWED_FS_METHODS } from '../constants'
import type { SnapshotState } from '../web/jest-snapshot/State'

import type Environment from './environment'

type ArrayElementType<T> = T extends ArrayLike<infer P> ? P : never
type OrPromise<T> = Promise<T> | T

export type CustomReporter = {
  jasmineDone: (arg: any) => void
  jasmineStarted: (arg: any) => void
  specDone: (arg: any) => void
  specStarted: (arg: any) => void
  suiteDone: (arg: any) => void
  suiteStarted: (arg: any) => void
  console?: (arg: { type: ArrayElementType<typeof CONSOLE_METHODS>; args: string[] }) => void
  init?: () => OrPromise<{ config: any; initialSnapsthots: any }>
  debugger?: () => Promise<void>
  snapshot?: (arg: { method: string; args?: unknown[] }) => void
  fs?: (arg: { method: string; args: [string, ...unknown[]] }) => Promise<unknown>

  filename?: string
}

type Microseconds = number

export class Reporter implements CustomReporter {
  private _testResults: Array<AssertionResult> = []
  private _globalConfig: Config.GlobalConfig
  private _config: Config.ProjectConfig
  private _currentSuites: Array<string> = []
  private _resolve!: (r: TestResult) => void
  private _resultsPromise: Promise<TestResult>
  private _startTimes = new Map<string, Microseconds>()
  private _testPath: Config.Path

  private _environment: Environment
  filename: string
  snapshotState: SnapshotStateType

  constructor ({
    globalConfig,
    config,
    testPath,
    environment,
    snapshotState,
  }: {
    globalConfig: Config.GlobalConfig
    config: Config.ProjectConfig
    testPath: Config.Path
    environment: Environment
    snapshotState: SnapshotStateType
  }) {
    this._globalConfig = globalConfig
    this._config = config
    this._testPath = testPath
    this._resultsPromise = new Promise((resolve) => (this._resolve = resolve))

    this._environment = environment
    this.filename = testPath
    this.snapshotState = snapshotState
  }

  jasmineStarted () {}

  specStarted (spec: any): void {
    this._startTimes.set(spec.id, Date.now())
  }

  specDone (result: any): void {
    this._testResults.push(this._extractSpecResults(result, this._currentSuites.slice(0)))
  }

  suiteStarted (suite: any): void {
    this._currentSuites.push(suite.description)
  }

  suiteDone (): void {
    this._currentSuites.pop()
  }

  jasmineDone (): void {
    let numFailingTests = 0
    let numPassingTests = 0
    let numPendingTests = 0
    let numTodoTests = 0
    const testResults = this._testResults
    testResults.forEach((testResult) => {
      if (testResult.status === 'failed') {
        numFailingTests++
      } else if (testResult.status === 'pending') {
        numPendingTests++
      } else if (testResult.status === 'todo') {
        numTodoTests++
      } else {
        numPassingTests++
      }
    })

    const testResult: TestResult = {
      ...createEmptyTestResult(),
      failureMessage: formatResultsErrors(testResults, this._config, this._globalConfig, this._testPath),
      numFailingTests,
      numPassingTests,
      numPendingTests,
      numTodoTests,
      testFilePath: this._testPath,
      testResults,
    }

    this.addSnapshotData(testResult)
    this._resolve(testResult)
  }

  getResults (): Promise<TestResult> {
    return this._resultsPromise
  }

  private _addMissingMessageToStack (stack: string, message?: string) {
    // Some errors (e.g. Angular injection error) don't prepend error.message
    // to stack, instead the first line of the stack is just plain 'Error'
    const ERROR_REGEX = /^Error:?\s*\n/

    if (stack && message && !stack.includes(message)) {
      return message + stack.replace(ERROR_REGEX, '\n')
    }
    return stack
  }

  private _extractSpecResults (specResult: any, ancestorTitles: Array<string>): AssertionResult {
    const start = this._startTimes.get(specResult.id)
    const duration = start ? Date.now() - start : undefined
    const status = specResult.status === 'disabled' ? 'pending' : specResult.status
    const location = specResult.__callsite
      ? {
          column: specResult.__callsite.getColumnNumber(),
          line: specResult.__callsite.getLineNumber(),
        }
      : null
    const results: AssertionResult = {
      ancestorTitles,
      duration,
      failureDetails: [],
      failureMessages: [],
      fullName: specResult.fullName,
      location,
      numPassingAsserts: 0, // Jasmine2 only returns an array of failed asserts.
      status,
      title: specResult.description,
    }

    specResult.failedExpectations.forEach((failed: any) => {
      const message =
        !failed.matcherName && typeof failed.stack === 'string'
          ? this._addMissingMessageToStack(failed.stack, failed.message)
          : failed.message || ''
      results.failureMessages.push(message)
      results.failureDetails.push(failed)
    })

    return results
  }

  console: CustomReporter['console'] = ({ type, args }) => {
    this._environment.global?.console[type](...args.map((a) => a.toString()))
  }

  fs: CustomReporter['fs'] = ({ method, args: [path, ...rest] }) => {
    console.log(method, path, process.cwd())

    if (!normalize(path).startsWith(process.cwd())) {
      return
    }

    return ALLOWED_FS_METHODS.has(method as any)
      ? // @ts-expect-error
        fs[method](path, ...rest)
      : undefined
  }

  init: CustomReporter['init'] = () => {
    const initialSnapsthots = this.snapshotState as unknown as Readonly<SnapshotState>

    const res = {
      config: this._config,
      initialSnapsthots: {
        ...initialSnapsthots,
        _uncheckedKeys: [...initialSnapsthots._uncheckedKeys.values()],
        _counters: [...initialSnapsthots._counters.entries()],
      },
    }

    return res
  }

  snapshot: CustomReporter['snapshot'] = ({ method, args }) => {
    if (method === '_addSnapshot') {
      return (this.snapshotState as any)._addSnapshot(...args!)
    }
    if (method === '__update') {
      return Object.assign(this.snapshotState, args![0])
    }
    if (method === 'fail') {
      return (this.snapshotState as any).fail(...args!)
    }

    return undefined
  }

  addSnapshotData (results: TestResult) {
    const { snapshotState } = this

    results.testResults.forEach(({ fullName, status }: AssertionResult) => {
      if (status === 'pending' || status === 'failed') {
        // if test is skipped or failed, we don't want to mark
        // its snapshots as obsolete.
        snapshotState.markSnapshotsAsCheckedForTest(fullName)
      }
    })

    const uncheckedCount = snapshotState.getUncheckedCount()
    const uncheckedKeys = snapshotState.getUncheckedKeys()

    if (uncheckedCount) {
      snapshotState.removeUncheckedKeys()
    }

    const status = snapshotState.save()
    results.snapshot.fileDeleted = status.deleted
    results.snapshot.added = snapshotState.added
    results.snapshot.matched = snapshotState.matched
    results.snapshot.unmatched = snapshotState.unmatched
    results.snapshot.updated = snapshotState.updated
    results.snapshot.unchecked = !status.deleted ? uncheckedCount : 0
    // Copy the array to prevent memory leaks
    results.snapshot.uncheckedKeys = Array.from(uncheckedKeys)
  }
}
