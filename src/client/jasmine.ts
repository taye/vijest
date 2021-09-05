import jasmineRequire from 'jasmine-core/lib/jasmine-core/jasmine'
import remoteReporter from './remoteReporter'

import jestMock from 'jest-mock'
import expect from 'expect'
import { postSync } from './utils'

export const jasmine = jasmineRequire.core(jasmineRequire)

export const env = jasmine.getEnv()

env.configure({
  failFast: false,
  oneFailurePerSpec: false,
  hideDisabled: false,
  random: false,
})

export const jasmineInterface = jasmineRequire.interface(jasmine, env)
const { describe, it } = jasmineInterface

jasmineInterface.test = jasmineInterface.it
describe.skip = jasmineInterface.xdescribe
describe.only = jasmineInterface.fdescribe
it.skip = jasmineInterface.xit
it.only = jasmineInterface.fit
it.skip = jasmineInterface.xtest
it.only = jasmineInterface.ftest
;[jasmineInterface.jsApiReporter, remoteReporter].forEach(env.addReporter)

const _sab = window.SharedArrayBuffer || ArrayBuffer

export const globals = {
  SharedArrayBuffer: _sab,
  jasmine,
  jasmineRequire,
  ...jasmineInterface,
  jest: {
    ...jestMock,
  },
  expect,
}
