import { post } from './utils'

const methods = ['jasmineStarted', 'suiteStarted', 'suiteDone', 'specStarted', 'specDone', 'jasmineDone']

const reporter = Object.fromEntries(
  methods.map(
    (method) =>
      [
        method,
        async (arg: any) => {
          return await post('report', { method, arg })
        },
      ] as const,
  ),
)

export default reporter
