import { INTERNAL, REPORTER_QUESTIONS } from '../constants'
import type { CustomReporter } from '../jest/reporter'

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
] as const

const { filename } = (global as any)[INTERNAL]

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
