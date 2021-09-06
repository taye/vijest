import jasmineRequire from 'jasmine-core/lib/jasmine-core/jasmine'
import jestMock from 'jest-mock'
import expect from 'expect'

import reporter from './remoteReporter'
import { HOST_BASE_PATH } from '../constants'

export const jasmine = jasmineRequire.core(jasmineRequire)

export const env = jasmine.getEnv()

export type Globals = typeof globals
export type SpecProps = typeof specProps

env.configure({
  failFast: false,
  oneFailurePerSpec: false,
  hideDisabled: false,
  random: false,
})

export const jasmineInterface = jasmineRequire.interface(jasmine, env)

env.addReporter(jasmineInterface.jsApiReporter)
env.addReporter(reporter)

const { describe, it } = jasmineInterface

describe.skip = jasmineInterface.xdescribe
describe.only = jasmineInterface.fdescribe

it.skip = jasmineInterface.xtest = jasmineInterface.xit
it.only = jasmineInterface.ftest = jasmineInterface.fit

const _sab = window.SharedArrayBuffer || ArrayBuffer

export const globals = {
  SharedArrayBuffer: _sab,
  ...jasmineInterface,
  test: it,
  jest: {
    ...jestMock,
  },
  expect,
}

const specProps = {
  env,
  globals,
  reporter,
  jasmine,
  jasmineRequire,
  specImports: (window as any).__specs as Array<{ filename: string; url: string }>,
} as const

;(window as any).__specProps = specProps

window.addEventListener('load', () => {
  const specFrame = document.body.appendChild(document.createElement('iframe'))

  specFrame.src = HOST_BASE_PATH + '/spec'
})
