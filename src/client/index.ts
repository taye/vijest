import jasmineRequire from 'jasmine-core/lib/jasmine-core/jasmine'

import remoteReporter from './remoteReporter'

const jasmine = jasmineRequire.core(jasmineRequire)

const { config, globals } = (window.parent as any).__clientProps || {}

const env = jasmine.getEnv(config)

env.configure(config)

const jasmineInterface = jasmineRequire.interface(jasmine, env)
const { describe, it } = jasmineInterface

jasmineInterface.test = it
describe.skip = jasmineInterface.xdescribe
describe.only = jasmineInterface.fdescribe
it.skip = jasmineInterface.xit
it.only = jasmineInterface.fit

;[jasmineInterface.jsApiReporter, remoteReporter].forEach(env.addReporter)

Object.assign(window, jasmineInterface, {
  jasmine,
  jasmineRequire,
  test: it,
  SharedArrayBuffer: window.SharedArrayBuffer || ArrayBuffer,
  ...globals,
})

window.addEventListener('load', async () => {
  const errors: Error[] = []
  const pushError = (e: Error) => errors.push(e)

  const specImports: Array<{ filename: string, url: string }> = JSON.parse((window.frameElement as HTMLIFrameElement)?.dataset.specs || '[]')
  const specs = specImports.map(({ filename, url }) => [
    filename,
    () => import(/* @vite-ignore */ url).catch(pushError)
  ] as const)

  // load tests
  await Promise.all(
    specs.map(([filename, importer]) => {
      console.log('[jasmine client]', 'loading:', filename)
      return importer()
    }),
  )

  env.execute()

  jasmineInterface.test('[import specs]', () => {
    errors.forEach(jasmineInterface.fail)
  })
})
