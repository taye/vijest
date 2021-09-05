import assert from 'assert'
import puppeteer from 'puppeteer'
import { createServer } from 'vite'
import pti from 'puppeteer-to-istanbul'

import { HOST_BASE_PATH, INTERNAL, PLUGIN_NAME } from './constants'
import viteJasmine from './plugin'
import type { Reporter } from './jest/reporter'

type LaunchOptions = Parameters<typeof puppeteer['launch']>[0]

interface StartSpecArg {
  filename: string
  reporter: Reporter
}

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

  const startSpec = async ({ filename, reporter }: StartSpecArg) => {
    const url = new URL(clientUrl)

    url.searchParams.set('spec', filename)

    internals.hooks.add(reporter)

    const { getResults } = reporter
    reporter.getResults = () =>
      getResults.apply(reporter).then(async (results) => {
        internals.hooks.delete(reporter)
        // TODO
        // await getCoverage(page)
        return results
      })

    const page = await browser.newPage()
    await page.goto(url.href)
    await page.coverage.startJSCoverage({ resetOnNavigation: false })

    return { page }
  }

  const close = () => {
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
