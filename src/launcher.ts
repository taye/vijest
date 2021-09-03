import assert from 'assert'
import puppeteer from 'puppeteer'
import { createServer } from 'vite'
import pti from 'puppeteer-to-istanbul'

import { HOST_BASE_PATH, INTERNAL, PLUGIN_NAME } from './constants'
import viteJasmine from './plugin'

type LaunchOptions = Parameters<typeof puppeteer['launch']>[0]

export async function launch(options: LaunchOptions = {}) {
  const { baseUrl, server, internals } = await createViteServer()

  const clientUrl = new URL(`${HOST_BASE_PATH}/client`, baseUrl)

  const browser = await puppeteer.launch({
    // TODO
    executablePath: 'chromium',
    ignoreHTTPSErrors: true,
    ...options,
    args: ['--no-sandbox', ...(options.args || [])],
  })

  const startSpec = async (filename: string) => {
    const page = await browser.newPage()
    const url = new URL(clientUrl)

    url.searchParams.set('spec', filename)

    await page.goto(url.href)
    await page.coverage.startJSCoverage({ resetOnNavigation: false })

    const results = new Promise<any>((resolve) => {
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

    return { page, results }
  }

  const close = () => {
    console.error('CLOSING')
    return Promise.all([browser, server].map((item) => item.close()))
  }

  return { browser, startSpec, server, close }
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
    message(`The test runner coudn't determine the web server address.
    If you're using Vite in middleware mode, set the plugin's "baseUrl: string" option.`),
  )

  return { baseUrl, internals, server }
}

const getCoverage = async (page: puppeteer.Page) => {
  const jsCoverage = await page.coverage.stopJSCoverage()

  pti.write(jsCoverage, { includeHostname: true, storagePath: './coverage' })
}

export function message(s: string) {
  return `[${PLUGIN_NAME}] ${s}`
}
