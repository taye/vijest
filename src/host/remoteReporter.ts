export default [
  'jasmineStarted',
  'suiteStarted',
  'suiteDone',
  'specStarted',
  'specDone',
  'jasmineDone',
].reduce((acc, method) => {
  acc[method] = (arg: any) => fetch('/@jasmine/report', {
    method: 'POST',
    body: JSON.stringify({ method, arg }),
  })

  return acc
}, {} as any)
