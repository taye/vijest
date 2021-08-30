/* eslint-disable no-console, import/no-extraneous-dependencies */
import jasmineRequire from 'jasmine-core/lib/jasmine-core/jasmine'
import type { SinonStub } from 'sinon'
import sinon from 'sinon'

import remoteReporter from './remoteReporter'

const jasmine = jasmineRequire.core(jasmineRequire)

const { config } = window.parent?.__clientProps || {}

const env = jasmine.getEnv(config)

env.configure(config)

const jasmineInterface = jasmineRequire.interface(jasmine, env)

const describe = (...args: any[]) => jasmineInterface.describe(...args)
// use test() instead of it()
const test = (...args: any[]) => jasmineInterface.it(...args)

// skip
describe.skip = (description: string) => console.log('[descripe.skip]', description)
test.skip = (description: string) => console.log('[test.skip]', description)
// only
describe.only = jasmineInterface.fdescribe
test.only = jasmineInterface.fit

Object.assign(window, jasmineInterface, {
  jasmine,
  jasmineRequire,
  describe,
  test,
  sinon,
  SharedArrayBuffer: ArrayBuffer,
  jest: {
    // eslint-disable-next-line import/no-named-as-default-member
    fn: sinon.spy,
  },
})

// add reporters
;[jasmineInterface.jsApiReporter, remoteReporter].forEach(env.addReporter)

window.addEventListener('load', async () => {
  const errors: Error[] = []
  const pushError = (e: Error) => errors.push(e)

  await addMatchers().catch(pushError)

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

  test('[import specs]', () => {
    errors.forEach(jasmineInterface.fail)
  })
})

async function addMatchers () {
  jasmine.Expectation.addCoreMatchers(await getSinonMatchers())

  jasmine.Expectation.addCoreMatchers({
    toHaveLength: jasmine.matchers.toHaveSize,
    // TODO
    toMatchObject: (...args: any[]) => {
      // const
    },
  })

  jasmineInterface.expect.objectContaining = jasmine.objectContaining
  jasmineInterface.expect.any = jasmine.any

  // ignore constructor differences in Expect.toEqual
  const { MatchersUtil } = jasmine
  MatchersUtil.prototype._eq_ = MatchersUtil.prototype.eq_
  MatchersUtil.prototype.eq_ = function (a: any, b: any, ...rest: any[]) {
    if (
      typeof a === 'object' && typeof b === 'object' && !!a && !!b &&
      !(typeof b.jasmineMatches === 'function' || b instanceof jasmine.ObjectContaining) &&
      a.constructor !== b.constructor) {
      a = { ...a }
      b = { ...b }
    }

    return this._eq_(a, b, ...rest)
  }
}

async function getSinonMatchers () {
  let sinonMatchers: any
  const { addMatchers } = jasmine

  window.beforeEach = (addSinonMatchers) => addSinonMatchers(null)

  jasmine.addMatchers = (_matchers: unknown) => {
    sinonMatchers = _matchers
  }

  await import(/* @vite-ignore */ 'jasmine-sinon')

  window.beforeEach = jasmineInterface.beforeEach
  jasmine.addMatchers = addMatchers

  sinonMatchers.toHaveBeenNthCalledWith = (...args: any[]) => {
    const calledWith = sinonMatchers.toHaveBeenCalledWith(...args)
    return {
      compare: (stub: SinonStub, n: number, arg: unknown) => {
        const nthCall = stub.getCall(n) || stub.lastCall

        nthCall.printf = stub.printf.bind(stub)

        return calledWith.compare(nthCall, arg)
      },
    }
  }

  sinonMatchers.toHaveBeenLastCalledWith = (...args: any[]) => {
    const nthCalledWith = sinonMatchers.toHaveBeenNthCalledWith(...args)

    return {
      compare: (stub: SinonStub, arg: unknown) => {
        return nthCalledWith.compare(stub, stub.callCount - 1, arg)
      },
    }
  }

  sinonMatchers.toHaveBeenCalledTimes = (...args: any[]) => {
    const calledTimes = jasmine.matchers.toHaveBeenCalledTimes(...args)

    return {
      compare: (stub: SinonStub, n: number) => {
        if (jasmine.isSpy(stub)) return calledTimes.compare(stub, n)

        const pass = stub.getCalls().length === n

        return {
          pass,
          message: stub.printf(
            `Expected spy "%n" ${pass ? 'not ' : ''}to have been called ${n} time${
              n === 1 ? '' : 's'
            }, but was called %c`,
          ),
        }
      },
    }
  }

  return sinonMatchers
}
