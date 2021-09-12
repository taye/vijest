import reporter from './remoteReporter'

const makeMethod =
  (method: string) =>
  (...args: [string, ...unknown[]]) =>
    reporter.fs({ method, args })

export const existsSync = makeMethod('existsSync')
export const mkdirSync = makeMethod('mkdirSync')
export const readFileSync = makeMethod('readFileSync')
export const realPathSync = makeMethod('realPathSync')
export const unlinkSync = makeMethod('unlinkSync')
export const writeFileSync = makeMethod('writeFileSync')
