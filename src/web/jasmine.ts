import { Buffer } from 'buffer'

import { ModernFakeTimers } from '@jest/fake-timers'
import expect, { setState } from 'expect'
import jasmineRequire from 'jasmine-core/lib/jasmine-core/jasmine'
import * as jestMock from 'jest-mock'
import sourcemapSupport from 'source-map-support'

import { INTERNAL } from '../constants'

import { expectSnapshots } from './expectSnapshots'
import patchSpec from './patches/Spec'
import reporter from './remoteReporter'
import vt from './vt'

patchSpec(jasmineRequire)

export const jasmine = jasmineRequire.core(jasmineRequire)
export const env = jasmine.getEnv()

export type SpecProps = typeof specProps
export type WebGlobal = typeof globalThis & {
  [INTERNAL]: {
    ready: Promise<void>
    resolve: () => void
    reject: () => void
    currentSpec: { filename: string; url: string }
    id: string
  }
  __specProps: SpecProps
}

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

const window = global as unknown as WebGlobal

export const globals = {
  SharedArrayBuffer: window.SharedArrayBuffer || ArrayBuffer,
  ...jasmineInterface,
  test: it,
  expect,
  vt,
}

const serverInjected = window[INTERNAL]

;(async () => {
  const { config, initialSnapsthots } = await reporter.init()
  const snapshotState = await expectSnapshots(initialSnapsthots)

  globalThis.Buffer = Buffer
  sourcemapSupport.install()

  // @ts-expect-error
  setState({ snapshotState, expand: config.expanc })
})().then(serverInjected.resolve, serverInjected.reject)

const specProps = {
  env,
  globals,
  reporter,
  jasmine,
  jasmineRequire,
  makeJest: (window: Window) => makeJest(window),
} as const

window.__specProps = specProps

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
