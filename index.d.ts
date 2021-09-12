import type puppeteer from 'puppeteer'

export interface VitestOptions {
  launch?: Parameters<typeof puppeteer.launch>[0]
}

declare global {
  const vt: {
    debugger: () => void
  }
}
