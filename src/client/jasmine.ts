import jasmineRequire from 'jasmine-core/lib/jasmine-core/jasmine'
import jestMock from 'jest-mock'
import expect from 'expect'
import chalk from 'chalk'

console.log(chalk.red('asdf'))

import remoteReporter from './remoteReporter'

export const jasmine = jasmineRequire.core(jasmineRequire)

export const env = jasmine.getEnv()

env.configure({
  failFast: false,
  oneFailurePerSpec: false,
  hideDisabled: false,
  random: false,
})

export const jasmineInterface = jasmineRequire.interface(jasmine, env)

env.addReporter(jasmineInterface.jsApiReporter)
env.addReporter(remoteReporter)

const { describe, it } = jasmineInterface

describe.skip = jasmineInterface.xdescribe
describe.only = jasmineInterface.fdescribe

it.skip = jasmineInterface.xtest = jasmineInterface.xit
it.only = jasmineInterface.ftest = jasmineInterface.fit

const _sab = window.SharedArrayBuffer || ArrayBuffer

export const globals = {
  SharedArrayBuffer: _sab,
  jasmine,
  jasmineRequire,
  ...jasmineInterface,
  test: it,
  jest: {
    ...jestMock,
  },
  expect,
}
