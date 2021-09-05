import { dirname } from 'path'
import assert from 'assert'
import puppeteer from 'puppeteer'
import { createServer } from 'vite'
import pti from 'puppeteer-to-istanbul'
import findCacheDir from 'find-cache-dir'
import { readFile, writeFile } from 'fs/promises'
import WebSocket from 'ws'
import mkdirp from 'mkdirp'

import { HOST_BASE_PATH, INTERNAL, PLUGIN_NAME } from './constants'
import viteJasmine from './plugin'
import type { Reporter } from './jest/reporter'
import { addressToUrl, message } from './utils'

type LaunchOptions = Parameters<typeof puppeteer['launch']>[0]

type PromiseResolution<T> = T extends PromiseLike<infer U> ? U : never

export type Launcher = PromiseResolution<ReturnType<typeof launch>>

export interface LaunchConnection {
  baseUrl: string
  wsUrl: string
  puppeteer: {
    browserWSEndpoint: string
    browserVersion: string
  }
}

export interface StartSpecArg {
  filename: string
  reporter: Reporter
  connection: LaunchConnection
  browser: puppeteer.Browser
}

export async function launch(options: LaunchOptions = {}) {
  const { baseUrl, server, internals } = await createViteServer()

  const browser = await puppeteer.launch({
    // TODO
    executablePath: 'chromium',
    ignoreHTTPSErrors: true,
    ...options,
    args: ['--no-sandbox', ...(options.args || [])],
  })

  const connection: LaunchConnection = {
    baseUrl,
    wsUrl: addressToUrl(internals.wss.address(), 'ws'),
    puppeteer: {
      browserWSEndpoint: browser.wsEndpoint(),
      browserVersion: await browser.version(),
    },
  }

  const close = () => {
    return Promise.all([browser.close(), internals.close()])
  }

  return { connection, browser, internals, server, close }
}

export async function startSpec({ filename, reporter, connection, browser }: StartSpecArg) {
  const clientUrl = new URL(`${HOST_BASE_PATH}/client`, connection.baseUrl)
  const url = new URL(clientUrl)

  url.searchParams.set('spec', filename)

  const ws = new WebSocket(connection.wsUrl)

  ws.on('message', (message) => {
    const { method, arg } = JSON.parse(message.toString())

    if (arg.filename !== filename) return
    ;(reporter as any)[method]?.(arg)
  })

  const { getResults } = reporter

  reporter.getResults = () =>
    getResults.apply(reporter).then(async (results) => {
      ws.close()
      // TODO
      // await getCoverage(page)
      return results
    })

  const page = await browser.newPage()
  await page.goto(url.href)
  await page.coverage.startJSCoverage({ resetOnNavigation: false })

  const close = () => Promise.all([page.close(), ws.close()])

  return { page, close }
}

async function createViteServer() {
  const plugin = viteJasmine()
  const internals = plugin[INTERNAL]

  const server = await createServer({
    plugins: [plugin],
  })

  const baseUrl = internals.getServerUrl()

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

export async function cacheConnection(state: any) {
  const path = getConnectionCachePath()
  const dir = dirname(path)

  await mkdirp(dir)

  return writeFile(path, JSON.stringify(state))
}

export async function connectToLauncher() {
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
