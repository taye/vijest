import jasmineRequire from 'jasmine-core/lib/jasmine-core/jasmine'
import remoteReporter from './remoteReporter'

import jestMock from 'jest-mock'
import expect from 'expect'

import './style.css'

const jasmine = jasmineRequire.core(jasmineRequire)

const env = jasmine.getEnv()

env.configure({
  failFast: false,
  oneFailurePerSpec: false,
  hideDisabled: false,
  random: false,
})

const jasmineInterface = jasmineRequire.interface(jasmine, env)
const { describe, it } = jasmineInterface

jasmineInterface.test = it
describe.skip = jasmineInterface.xdescribe
describe.only = jasmineInterface.fdescribe
it.skip = jasmineInterface.xit
it.only = jasmineInterface.fit
;[jasmineInterface.jsApiReporter, remoteReporter].forEach(env.addReporter)

const _sab = window.SharedArrayBuffer || ArrayBuffer

Object.assign(window, {
  SharedArrayBuffer: _sab,
  jasmine,
  jasmineRequire,
  test: it,
  jest: {
    ...jestMock,
  },
  expect,
})

window.addEventListener('load', async () => {
  const errors: Error[] = []
  const pushError = (e: Error) => errors.push(e)

  const specImports: Array<{ filename: string; url: string }> = (window as any).__specs
  const specs = specImports.map(
    ({ filename, url }) => [filename, () => import(/* @vite-ignore */ url).catch(pushError)] as const,
  )

  // load tests
  await Promise.all(
    specs.map(([filename, importer]) => {
      console.log('[jasmine client]', 'loading:', filename)
      return importer()
    }),
  )

  env.execute()

  if (errors.length) {
    jasmineInterface.test('[import specs]', () => {
      errors.forEach(jasmineInterface.fail)
    })
  }
})
