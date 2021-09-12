import assert from 'assert'
import { readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'

import chalk from 'chalk'
import findCacheDir from 'find-cache-dir'
import mkdirp from 'mkdirp'
import puppeteer from 'puppeteer'
import pti from 'puppeteer-to-istanbul'
import { createServer } from 'vite'
import WebSocket from 'ws'

import type { VitestOptions } from '../index.d'

import { HOST_BASE_PATH, INTERNAL, PLUGIN_NAME, REPORTER_QUESTIONS } from './constants'
import type { Reporter } from './jest/reporter'
import vitest from './plugin'
import { addressToUrl, message } from './utils'

export type LaunchOptions = VitestOptions

type PromiseResolution<T> = T extends PromiseLike<infer U> ? U : never

export type Launcher = PromiseResolution<ReturnType<typeof launch>>

export interface LaunchConnection {
  baseUrl: string
  wsUrl: string
  puppeteer: {
    browserWSEndpoint: string
    browserVersion: string
    headless: boolean
  }
}

export interface StartSpecArg {
  filename: string
  reporter: Reporter
  connection: LaunchConnection
  browser: puppeteer.Browser
}

export async function launch ({ launch: puppeteerOptions, ...serverOptions }: LaunchOptions = {}) {
  const fullPuppeteerOptions = {
    ignoreHTTPSErrors: true,
    ...puppeteerOptions,
    args: ['--no-sandbox', ...(puppeteerOptions?.args || [])],
  }
  const [{ server, internals, baseUrl }, browser] = await Promise.all([
    createViteServer(serverOptions),

    puppeteer.launch(fullPuppeteerOptions),
  ])

  const connection: LaunchConnection = {
    baseUrl,
    wsUrl: addressToUrl(internals.wss.address(), 'ws'),
    puppeteer: {
      browserWSEndpoint: browser.wsEndpoint(),
      browserVersion: await browser.version(),
      headless: getIsHeadless(fullPuppeteerOptions),
    },
  }

  const close = () => {
    return Promise.all([browser.close(), internals.close()])
  }

  return { connection, browser, internals, server, close }
}

export async function startSpec ({ filename, reporter, connection, browser }: StartSpecArg) {
  const clientUrl = new URL(`${HOST_BASE_PATH}/jasmine`, connection.baseUrl)
  const url = new URL(clientUrl)

  url.searchParams.set('spec', filename)

  const ws = new WebSocket(connection.wsUrl)
  let cdpPromise: Promise<puppeteer.CDPSession>

  ws.on('open', () => ws.send(filename))

  ws.on('message', async (data) => {
    const { method, arg } = JSON.parse(data.toString())
    const res = (reporter as any)[method]?.(arg)

    if (method === 'debugger') {
      if (connection.puppeteer.headless) {
        console.warn(chalk.yellow(message("`vt.debugger()` isn't supported in headless browser mode")))
        return
      }

      const cdp = await cdpPromise

      await cdp.send('Page.bringToFront')
      await cdp.send('Debugger.pause')

      console.info(chalk.cyan(message('paused at `vt.debugger()`')))
      console.info(chalk.cyan(message("open your test page's devtools to continue debugging")))

      return
    }

    if (REPORTER_QUESTIONS.has(method)) {
      ws.send(JSON.stringify(await res))
    }
  })

  const page = await browser.newPage()

  const resultsPromise = reporter.getResults()
  let done = false

  reporter.getResults = () =>
    Promise.race([
      closePromise.then(() => resultsPromise),
      resultsPromise.then(async (results) => {
        done = true
        // TODO
        // await getCoverage(page)
        return results
      }),
    ])

  if (!connection.puppeteer.headless) {
    cdpPromise = page
      .target()
      .createCDPSession()
      .then(async (cdp) => {
        await cdp.send('Debugger.enable')
        return cdp
      })
  }

  const closePromise: typeof resultsPromise = new Promise((resolve, reject) => {
    const onClose = () => {
      if (!done) {
        reject(new Error(message('Browser was closed before the spec was completed')))
      }
    }

    page.on('close', onClose)
    browser.on('close', onClose)
    resultsPromise.then(resolve)
  })

  await page.goto(url.href)
  await page.coverage.startJSCoverage({ resetOnNavigation: false })

  const close = () => Promise.all([page.close(), ws.close(), cdpPromise?.then((cdp) => cdp.detach())])

  return { page, close }
}

async function createViteServer (options: VitestOptions) {
  const plugin = vitest(options)
  const internals = plugin[INTERNAL]

  const server = await createServer({
    plugins: [plugin],
  })

  const baseUrl = internals.getBaseUrl()

  assert(
    baseUrl,
    message(`the test runner coudn't determine the web server address.
    If you're using Vite in middleware mode, set the plugin's "baseUrl: string" option.`),
  )

  return { baseUrl, internals, server }
}

// @ts-expect-error
const getCoverage = async (page: puppeteer.Page) => {
  const jsCoverage = await page.coverage.stopJSCoverage()

  pti.write(jsCoverage, { includeHostname: true, storagePath: './coverage' })
}

const cacheDir = findCacheDir({ name: PLUGIN_NAME, thunk: true })

const getConnectionCachePath = () => {
  assert(
    cacheDir,
    message("the location to write the browser and server info couldn't be determined or is not writable."),
  )

  return cacheDir('state.json')
}

export async function cacheConnection (state: any) {
  const path = getConnectionCachePath()
  const dir = dirname(path)

  await mkdirp(dir)

  return writeFile(path, JSON.stringify(state))
}

export async function connectToLauncher () {
  let connection!: LaunchConnection

  try {
    connection = JSON.parse((await readFile(getConnectionCachePath())).toString())
  } catch {}

  assert(connection, message("plugin hasn't been launched"))

  const browser = await puppeteer.connect(connection.puppeteer)

  return {
    browser,
    startSpec: (options: Omit<StartSpecArg, 'connection' | 'browser'>) =>
      startSpec({ ...options, connection, browser }),
  }
}

const getIsHeadless = ({ headless, devtools }: { headless?: boolean; devtools?: boolean }) => {
  return headless === undefined ? !devtools : !!headless
}
