import type puppeteer from 'puppeteer'

export interface VitestOptions {
  launch?: puppeteer.PuppeteerNodeLaunchOptions
  shareBrowserContext?: boolean
}

declare global {
  const vt: {
    debugger: () => void
  }
}
