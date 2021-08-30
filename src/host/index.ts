import  './style.css'

const config: any = {
  failFast: false,
  oneFailurePerSpec: false,
  hideDisabled: false,
  random: false,
}

// @ts-expect-error
window.__clientProps = {
  config,
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
clientFrame.src = '/@jasmine/client'
