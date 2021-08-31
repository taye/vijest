import jasmineRequire from 'jasmine-core/lib/jasmine-core/jasmine'
import remoteReporter from './remoteReporter'

const jasmine = jasmineRequire.core(jasmineRequire)

import './style.css'

import expect from 'expect'
import jestMock from 'jest-mock'

const jest = {
  ...jestMock,
}

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

// @ts-expect-error
window.__clientProps = {
  env,
  globals: {
    jasmine,
    jasmineRequire,
    test: it,
    expect,
    jest,
  },
}

/**
 * Setting up timing functions to be able to be overridden. Certain browsers (Safari, IE 8, phantomjs) require this hack.
 */
/* eslint-disable no-self-assign */
window.setTimeout = window.setTimeout
window.setInterval = window.setInterval
window.clearTimeout = window.clearTimeout
window.clearInterval = window.clearInterval
/* eslint-enable no-self-assign */

// load client iframe
const clientFrame = document.getElementById('client-frame') as HTMLIFrameElement
clientFrame.dataset.specs = JSON.stringify((window as any).__specs)
clientFrame.src = '/@jasmine/client'
