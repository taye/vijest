import type puppeteer from 'puppeteer'

export interface VitestOptions {
  launch?: Parameters<typeof puppeteer.launch>[0]
}
