import type puppeteer from 'puppeteer'

export interface VijestOptions {
  launch?: puppeteer.PuppeteerNodeLaunchOptions
  shareBrowserContext?: boolean
}

declare global {
  const vt: {
    debugger: () => void
  }
}
