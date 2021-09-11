import reporter from './remoteReporter'

const makeMethod =
  (method: string) =>
  (...args: unknown[]) =>
    reporter.fs({ method, args })
export const unlinkSync = makeMethod('unlinkSync')
export const existsSync = makeMethod('existsSync')
export const readFileSync = makeMethod('readFileSync')
export const mkdirSync = makeMethod('mkdirSync')
export const realPathSync = makeMethod('realPathSync')
