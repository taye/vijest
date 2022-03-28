import assert from 'assert'
import { readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'

import type { ShouldInstrumentOptions } from '@jest/transform'
import type { Config } from '@jest/types'
import chalk from 'chalk'
import findCacheDir from 'find-cache-dir'
import get from 'lodash/get'
import mkdirp from 'mkdirp'
import puppeteer from 'puppeteer'
import { createServer } from 'vite'
import type { AddressInfo } from 'ws'
import WebSocket, { Server as WebSocketServer } from 'ws'

import type { VijestOptions } from '../index.d'

import { HOST_BASE_PATH, INTERNAL, PAGE_METHODS, PLUGIN_NAME } from './constants'
import type { Reporter } from './jest/reporter'
import vijest from './plugin'
import { addressToUrl, convertCoverage, message, timeout } from './utils'

export type LaunchOptions = VijestOptions

type PromiseResolution<T> = T extends PromiseLike<infer U> ? U : never

export type Launcher = PromiseResolution<ReturnType<typeof launch>>

export interface LaunchConnection {
  rootDir: string
  baseUrl: string
  wsUrl: string
  headless: boolean
  shareBrowserContext: boolean
}

export interface StartSpecArg {
  filename: string
  reporter: Reporter
  connection: LaunchConnection
  coverageOptions: ShouldInstrumentOptions
  config: Config.ProjectConfig
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

export async function launch ({
  launch: puppeteerOptions,
  shareBrowserContext,
  ...serverOptions
}: LaunchOptions = {}) {
  const fullPuppeteerOptions = {
    ignoreHTTPSErrors: true,
    ...puppeteerOptions,
    args: ['--no-sandbox', ...(puppeteerOptions?.args || [])],
  }
  const { server, internals: serverInternals, baseUrl } = await createViteServer(serverOptions)
  const { wsClients } = serverInternals
  const wss = new WebSocketServer({ port: 0 })

  const allBrowsers = new Set<puppeteer.Browser>()

  let sharedConnection: { browser: puppeteer.Browser; connectData: WsConnectData } | undefined

  if (shareBrowserContext) {
    const browser = await puppeteer.launch(fullPuppeteerOptions)

    allBrowsers.add(browser)
    sharedConnection = {
      browser,
      connectData: {
        method: 'connect',
        arg: {
          browserWSEndpoint: browser.wsEndpoint(),
          browserVersion: await browser.version(),
        },
      },
    }
  }

  wss.on('connection', (ws: WebSocket & { id?: string }) => {
    ws.once('message', async (initId) => {
      const id = (ws.id = initId.toString())

      assert(!wsClients.get(id))
      wsClients.set(id, ws)

      const browser: puppeteer.Browser =
        sharedConnection?.browser || (await puppeteer.launch(fullPuppeteerOptions))
      allBrowsers.add(browser)

      const connectData: WsConnectData = sharedConnection?.connectData || {
        method: 'connect',
        arg: {
          browserWSEndpoint: browser.wsEndpoint(),
          browserVersion: await browser.version(),
        },
      }

      ws.once('close', () => {
        if (!sharedConnection) {
          browser.close()
          allBrowsers.delete(browser)
        }

        wsClients.delete(id)
      })

      ws.send(JSON.stringify(connectData))
    })
  })

  const connection: LaunchConnection = {
    rootDir: server.config.root,
    baseUrl,
    shareBrowserContext: !!shareBrowserContext,
    wsUrl: addressToUrl(wss.address() as AddressInfo, 'ws'),
    headless: getIsHeadless(fullPuppeteerOptions),
  }

  const close = async () => {
    wss.clients.forEach((ws) => ws.close())

    await Promise.all([
      new Promise((r) => wss.close(r)),
      serverInternals.close(),
      Promise.all([...allBrowsers].map((b) => b.close())),
    ])

    allBrowsers.clear()
  }

  return { connection, server, close }
}

export async function startSpec ({
  filename,
  reporter,
  coverageOptions,
  config,
  connection,
  page,
  ws,
}: StartSpecArg) {
  const clientUrl = new URL(`${HOST_BASE_PATH}/jasmine`, connection.baseUrl)
  const url = new URL(clientUrl)

  url.searchParams.set('spec', filename)
  url.searchParams.set('id', reporter.id)

  let cdpPromise: Promise<puppeteer.CDPSession> | undefined

  ws.on('message', async (data) => {
    const { method, arg, requestId } = JSON.parse(data.toString())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let res = (reporter as any)[method]?.(arg)

    if (method === 'debugger') {
      if (connection.headless) {
        console.warn(chalk.yellow(message("`vt.debugger()` isn't supported in headless browser mode")))
      } else {
        cdpPromise ||= page
          .target()
          .createCDPSession()
          .then(async (cdp) => {
            if (!connection.headless) {
              await cdp.send('Debugger.enable')
            }

            return cdp
          })

        const cdp = await cdpPromise

        await cdp.send('Page.bringToFront')
        await cdp.send('Debugger.pause')

        console.info(chalk.cyan(message('paused at `vt.debugger()`')))
        console.info(chalk.cyan(message("open your test page's devtools to continue debugging")))
      }
    } else if (method === 'pageMethod') {
      assert(PAGE_METHODS.has(arg.path.join('.')))
      const namespacePath = arg.path.slice(0, arg.path.length - 1)
      const methodName = arg.path[arg.path.length - 1]
      const namespace = namespacePath.length ? get(page, namespacePath) : page.frames()[1]

      try {
        res = await namespace[methodName]?.(...arg.args)
      } catch (error) {
        ws.send(JSON.stringify({ requestId, statusCode: 500, response: (error as Error).message }))
      }
    }

    ws.send(JSON.stringify({ requestId, response: await res }))
  })

  let done = false
  const resultsPromise = reporter.getResults().then((r) => {
    done = true
    return r
  })

  const getResults = async () => {
    const results = await Promise.race([resultsPromise, closePromise])

    if (coverageOptions.collectCoverage) {
      const puppeteerCoverage = await page.coverage.stopJSCoverage()
      results.v8Coverage = (
        await convertCoverage({ puppeteerCoverage, connection, coverageOptions, config })
      ).map((c: any) => ({ result: c }))
    }

    return results
  }

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

  if (coverageOptions.collectCoverage) {
    await page.coverage.startJSCoverage({ resetOnNavigation: false })
  }

  const close = () =>
    Promise.all([Promise.resolve(cdpPromise).then((cdp) => cdp?.detach()), page.close(), ws.close()])

  return { getResults, close }
}

async function createViteServer (options: VijestOptions) {
  const plugin = vijest(options)
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

export async function connect ({
  filename,
  reporter,
  coverageOptions,
  config,
}: {
  filename: string
  reporter: Reporter
  coverageOptions: ShouldInstrumentOptions
  config: Config.ProjectConfig
}) {
  let connection: LaunchConnection

  try {
    connection = JSON.parse((await readFile(getConnectionCachePath())).toString())
  } catch {}

  assert(connection!, message("server hasn't been started"))

  const ws = new WebSocket(connection.wsUrl)

  ws.on('open', () => ws.send(reporter.id))

  const browserConnection = await timeout(
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
      // throw new Error(message(`timed out while trying to connect to the browser to run "${filename}"`))
    }),
    1000,
  )

  assert(browserConnection)

  const browser = await puppeteer.connect(browserConnection)
  const page = await browser.newPage()

  return {
    startSpec: async () => startSpec({ connection, filename, ws, reporter, coverageOptions, config, page }),
    disconnect: () => ws.close(),
  }
}

const getIsHeadless = ({ headless, devtools }: { headless?: boolean; devtools?: boolean }) => {
  return headless === undefined ? !devtools : !!headless
}
