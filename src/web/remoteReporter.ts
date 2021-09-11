import { INTERNAL } from '../constants'
import type { CustomReporter } from '../jest/reporter'

import { postSync } from './utils'

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
] as const

const { filename } = (global as any)[INTERNAL]

const reporterEntries = methods.map(
  (method) => [method, (arg: Record<string, unknown>) => postSync(method, { ...arg, filename })] as const,
)
const reporter = Object.fromEntries(reporterEntries) as unknown as Required<CustomReporter>

export default reporter
