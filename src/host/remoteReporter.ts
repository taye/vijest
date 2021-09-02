import { HOST_BASE_PATH } from '../constants'

export default [
  'jasmineStarted',
  'suiteStarted',
  'suiteDone',
  'specStarted',
  'specDone',
  'jasmineDone',
].reduce((acc, method) => {
  acc[method] = (arg: any) =>
    fetch(`${HOST_BASE_PATH}/report`, {
      method: 'POST',
      body: JSON.stringify({ method, arg }),
    })

  return acc
}, {} as any)
