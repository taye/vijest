import assert from 'assert'
import { readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'

import chalk from 'chalk'
import findCacheDir from 'find-cache-dir'
import mkdirp from 'mkdirp'
import puppeteer from 'puppeteer'
import { createServer } from 'vite'
// @ts-expect-error
import WebSocket, { WebSocketServer } from 'ws'

import type { VitestOptions } from '../index.d'

import { HOST_BASE_PATH, INTERNAL, PLUGIN_NAME, REPORTER_QUESTIONS } from './constants'
import type { Reporter } from './jest/reporter'
import vitest from './plugin'
import { addressToUrl, message, timeout } from './utils'

export type LaunchOptions = VitestOptions

type PromiseResolution<T> = T extends PromiseLike<infer U> ? U : never

export type Launcher = PromiseResolution<ReturnType<typeof launch>>

export interface LaunchConnection {
  baseUrl: string
  wsUrl: string
  headless: boolean
}

export interface StartSpecArg {
  filename: string
  reporter: Reporter
  connection: LaunchConnection
  page: puppeteer.Page
  ws: WebSocket
}

interface WsConnectData {
  method: 'connect'
  arg: {
    browserWSEndpoint: string
    browserVersion: string
  }
}

export async function launch ({ launch: puppeteerOptions, ...serverOptions }: LaunchOptions = {}) {
  const fullPuppeteerOptions = {
    ignoreHTTPSErrors: true,
    ...puppeteerOptions,
    args: ['--no-sandbox', ...(puppeteerOptions?.args || [])],
  }
  const { server, internals: serverInternals, baseUrl } = await createViteServer(serverOptions)
  const { wsClients } = serverInternals
  const wss = new WebSocketServer({ port: 0 })

  const allBrowsers = new Set<puppeteer.Browser>()

  wss.on('connection', (ws: WebSocket & { filename?: string }) => {
    ws.once('message', async (filenameMessage) => {
      const filename = (ws.filename = filenameMessage.toString())

      assert(!wsClients.get(filename))
      wsClients.set(filename, ws)

      const browser: puppeteer.Browser = await puppeteer.launch(fullPuppeteerOptions)
      allBrowsers.add(browser)

      const connectData: WsConnectData = {
        method: 'connect',
        arg: {
          browserWSEndpoint: browser.wsEndpoint(),
          browserVersion: await browser.version(),
        },
      }

      ws.once('close', () => {
        allBrowsers.delete(browser)
        browser.close()
        wsClients.delete(filename)
      })

      ws.send(JSON.stringify(connectData))
    })
  })

  const connection: LaunchConnection = {
    baseUrl,
    wsUrl: addressToUrl(wss.address(), 'ws'),
    headless: getIsHeadless(fullPuppeteerOptions),
  }

  const close = async () => {
    await Promise.all([...[...allBrowsers].map((b) => b.close()), serverInternals.close(), wss.close()])
    allBrowsers.clear()
    wsClients.forEach((ws) => ws.terminate())
  }

  return { connection, server, close }
}

export async function startSpec ({ filename, reporter, connection, page, ws }: StartSpecArg) {
  const clientUrl = new URL(`${HOST_BASE_PATH}/jasmine`, connection.baseUrl)
  const url = new URL(clientUrl)

  url.searchParams.set('spec', filename)

  // eslint-disable-next-line prefer-const
  let cdpPromise: Promise<puppeteer.CDPSession>

  ws.on('message', async (data) => {
    const { method, arg } = JSON.parse(data.toString())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (reporter as any)[method]?.(arg)

    if (method === 'debugger') {
      if (connection.headless) {
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

  cdpPromise = page
    .target()
    .createCDPSession()
    .then(async (cdp) => {
      if (!connection.headless) {
        await cdp.send('Debugger.enable')
      }

      return cdp
    })

  const closePromise: typeof resultsPromise = new Promise((resolve, reject) => {
    const onClose = () => {
      if (!done) {
        reject(new Error(message('Browser was closed before the spec was completed')))
      }
    }

    page.on('close', onClose)
    page.browser().on('close', onClose)
    resultsPromise.then(resolve)
  })

  await page.goto(url.href)
  await page.coverage.startJSCoverage({ resetOnNavigation: false })

  const close = () => Promise.all([page.close(), cdpPromise?.then((cdp) => cdp.detach()), ws.close()])

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

/*
const getCoverage = async (page: puppeteer.Page) => {
  const jsCoverage = await page.coverage.stopJSCoverage()
  pti.write(jsCoverage, { includeHostname: true, storagePath: './coverage' })
}
*/

const cacheDir = findCacheDir({ name: PLUGIN_NAME, thunk: true })

const getConnectionCachePath = () => {
  assert(
    cacheDir,
    message("the location to write the browser and server info couldn't be determined or is not writable."),
  )

  return cacheDir('state.json')
}

export async function cacheConnection (state: LaunchConnection) {
  const path = getConnectionCachePath()
  const dir = dirname(path)

  await mkdirp(dir)

  return writeFile(path, JSON.stringify(state))
}

export async function connect ({ filename, reporter }: { filename: string; reporter: Reporter }) {
  let connection!: LaunchConnection

  try {
    connection = JSON.parse((await readFile(getConnectionCachePath())).toString())
  } catch {}

  assert(connection, message("plugin hasn't been launched"))

  const ws = new WebSocket(connection.wsUrl)

  ws.on('open', () => ws.send(filename))

  const browserConnection = await Promise.race([
    new Promise<WsConnectData['arg']>((resolve, reject) => {
      ws.once('message', (data) => {
        try {
          const { method, arg } = JSON.parse(data.toString()) as WsConnectData

          assert(method === 'connect')
          resolve(arg)
        } catch (error) {
          reject(error)
        }
      })
    }),
    timeout(1000).then(() => {
      throw new Error(message(`timed out while trying to connect to the browser to run "${filename}"`))
    }),
  ])

  const browser = await puppeteer.connect(browserConnection)
  const page = (await browser?.pages())?.[0]

  assert(browser && page)

  return {
    startSpec: async () => startSpec({ connection, filename, ws, reporter, page }),
    disconnect: () => ws.close(),
  }
}

const getIsHeadless = ({ headless, devtools }: { headless?: boolean; devtools?: boolean }) => {
  return headless === undefined ? !devtools : !!headless
}
