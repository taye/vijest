import { ModernFakeTimers } from '@jest/fake-timers'
import expect from 'expect'
import jasmineRequire from 'jasmine-core/lib/jasmine-core/jasmine'
import * as jestMock from 'jest-mock'

import { HOST_BASE_PATH } from '../constants'

import patchSpec from './patches/Spec'
import reporter from './remoteReporter'

patchSpec(jasmineRequire)

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

export const globals = {
  SharedArrayBuffer: window.SharedArrayBuffer || ArrayBuffer,
  ...jasmineInterface,
  test: it,
  expect,
}

const specProps = {
  env,
  globals,
  reporter,
  jasmine,
  jasmineRequire,
  // @ts-expect-error
  specImports: window.__specs as Array<{ filename: string; url: string }>,
  makeJest: (window: Window) => makeJest(window),
} as const

// @ts-expect-error
window.__specProps = specProps

window.addEventListener('load', () => {
  const specFrame = document.body.appendChild(document.createElement('iframe'))

  specFrame.src = HOST_BASE_PATH + '/spec'
})

function makeJest (window: Window) {
  // @ts-expect-error
  const timers = new ModernFakeTimers({ global: window, config: { rootDir: location.href } })

  const jest: Partial<typeof global.jest> = {
    ...(jestMock as unknown as typeof global.jest),
    ...Object.fromEntries(
      [...Object.getOwnPropertyNames(timers), ...Object.getOwnPropertyNames(ModernFakeTimers.prototype)]
        .filter((key) => key[0] !== '_' && typeof (timers as any)[key] === 'function')
        .map((key) => {
          return [key, (...args: any[]) => (timers as any)[key](...args)]
        }),
    ),
  }

  return jest
}
