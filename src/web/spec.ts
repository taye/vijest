import * as pretty from 'pretty-format'
import supportsColor from 'supports-color'

import { CONSOLE_METHODS } from '../constants'

import type { SpecProps } from './jasmine'

const { parent } = window as any

const { env, globals, specImport, reporter, makeJest, ready } = parent.__specProps as SpecProps

Object.assign(window, globals, { parent: window, jest: makeJest(window) })

Object.defineProperty(window, 'frameElement', {
  get () {
    return null
  },
})

CONSOLE_METHODS.forEach((type) => {
  const original = console[type].bind(console)

  if (!original) return

  console[type] = (...args) => {
    original(...(args as any))

    // TODO: remove @vite/client script or prevent websocket connection
    if (/\[vite\]/.test(args[0])) return

    if (type === 'table') type = 'log'

    const highlight = !!supportsColor.stdout

    const formattedArgs = type.startsWith('count')
      ? args.map((arg) => arg.toString())
      : args.map((arg) => {
          try {
            return pretty.format(arg, { plugins: Object.values(pretty.plugins), highlight })
          } catch {
            return arg
          }
        })

    reporter.console({ type, args: formattedArgs })
  }
})

window.addEventListener('load', async () => {
  await ready

  try {
    await import(specImport.url)
  } catch (error: unknown) {
    globals.test('[import specs]', () => {
      globals.fail(error)
    })
  }

  env.execute()
})
