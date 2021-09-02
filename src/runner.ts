import assert from 'assert'
import { AddressInfo } from 'net'
import puppeteer from 'puppeteer'
import { createServer, Plugin, ViteDevServer } from 'vite'
import pti from 'puppeteer-to-istanbul'

import { HOST_BASE_PATH, INTERNAL, PLUGIN_NAME } from './constants'
import viteJasmine from './plugin'
import { findPlugin } from './utils'

type LaunchOptions = Parameters<typeof puppeteer['launch']>[0]

export async function launch(options: LaunchOptions = {}) {
  const { baseUrl, server, internals } = await createViteServer()

  const hostUrl = new URL(baseUrl).origin + `${HOST_BASE_PATH}`

  const browser = await puppeteer.launch({
    // TODO
    executablePath: 'chromium',
    ...options,
    args: ['--no-sandbox', ...((options as any).args || [])],
  })

  const startSpec = async () => {
    const page = (await browser.pages())[0] || (await browser.newPage())

    await page.goto(hostUrl)
    await page.coverage.startJSCoverage({ resetOnNavigation: false })

    return new Promise<any>((resolve) => {
      const doneHook = {
        jasmineDone: async (arg: unknown) => {
          message('DONEEEEEE')
          internals.hooks.delete(doneHook)
          await getCoverage(page)
          resolve(arg)
        },
      }
      internals.hooks.add(doneHook)
    })
  }

  return { browser, startSpec, server }
}

export async function createViteServer() {
  const server = await createServer({
    plugins: [injectPlugin],
  })

  const pluginInstance = findPlugin(server.config)!
  const internals = pluginInstance.config(INTERNAL)

  await server.listen(0)

  const baseUrl = internals.options.baseUrl || getServerUrl(server)

  assert(
    baseUrl,
    message(`The test runner coudn't determine the web server address.
    If you're using Vite in middleware mode, set the plugin's "baseUrl: string" option.`),
  )

  return { baseUrl, internals, server }
}

export const injectPlugin: Plugin = {
  name: PLUGIN_NAME + '-inject',
  config(config) {
    const hasExisting = !!findPlugin(config)

    return {
      plugins: hasExisting ? [] : [viteJasmine() as unknown as Plugin],
    }
  },
}

const getServerUrl = (server: ViteDevServer) => {
  const addressInfo = server.httpServer?.address() as AddressInfo | null

  if (!addressInfo) return ''

  const protocol = server.config.server.https ? 'https' : 'http'

  return `${protocol}://${addressInfo.address}:${addressInfo.port}`
}

const getCoverage = async (page: puppeteer.Page) => {
  const jsCoverage = await page.coverage.stopJSCoverage()

  pti.write(jsCoverage, { includeHostname: true, storagePath: './coverage' })
}

export function message(s: string) {
  return `[${PLUGIN_NAME}] ${s}`
}

launch({
  // headless: false,
  // devtools: true,
  // slowMo: 500,
}).then(async ({ startSpec, browser, server }) => {
  const results = await startSpec()
  await browser.close()
  await server.close()

  console.log(results)

  if (results.overallStatus === 'failed') process.exit(1)
  // process.exit()
})
