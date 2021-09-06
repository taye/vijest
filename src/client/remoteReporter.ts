import { INTERNAL } from '../constants'
import { CustomReporter } from '../jest/reporter'

import { post } from './utils'

const methods = [
  'jasmineStarted',
  'suiteStarted',
  'suiteDone',
  'specStarted',
  'specDone',
  'jasmineDone',
  'console',
] as const

const { filename } = (global as any)[INTERNAL]

const reporterEntries = methods.map(
  (method) => [method, (arg: any) => post(method, { ...arg, filename })] as const,
)
const reporter = Object.fromEntries(reporterEntries) as unknown as CustomReporter

export default reporter
