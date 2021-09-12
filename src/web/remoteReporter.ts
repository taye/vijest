import { INTERNAL, REPORTER_QUESTIONS } from '../constants'
import type { CustomReporter } from '../jest/reporter'

import type { WebGlobal } from './jasmine'
import { post, postSync } from './utils'

const methods = [
  'jasmineStarted',
  'suiteStarted',
  'suiteDone',
  'specStarted',
  'specDone',
  'jasmineDone',
  'console',
  'fs',
  'snapshot',
  'init',
  'debugger',
] as const

console.log((global as WebGlobal)[INTERNAL])

const { filename } = (global as WebGlobal)[INTERNAL].currentSpec

const reporterEntries = methods.map(
  (method) =>
    [
      method,
      (arg: Record<string, unknown>) => {
        const body = { ...arg, filename }
        const postMethod = REPORTER_QUESTIONS.has(method) ? postSync : post

        return postMethod(method, body)
      },
    ] as const,
)
const reporter = Object.fromEntries(reporterEntries) as unknown as Required<CustomReporter>

export default reporter
