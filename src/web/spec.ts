import * as pretty from 'pretty-format'
import supportsColor from 'supports-color'

import { CONSOLE_METHODS } from '../constants'
import type { SpecProps } from './jasmine'

const { parent } = window as any

const { env, globals, specImports, reporter } = parent.__specProps as SpecProps

Object.assign(window, globals, { parent: window })

Object.defineProperty(window, 'frameElement', {
  get() {
    return null
  },
})

CONSOLE_METHODS.forEach((type) => {
  const original = console[type].bind(console)

  if (!original) return

  console[type] = (...args) => {
    original(...(args as any))

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
  const errors: Error[] = []
  const pushError = (e: Error) => errors.push(e)

  const specs = specImports.map(
    ({ filename, url }) => [filename, () => import(/* @vite-ignore */ url).catch(pushError)] as const,
  )

  // load tests
  await Promise.all(
    specs.map(([_, importer]) => {
      return importer()
    }),
  )

  env.execute()

  if (errors.length) {
    globals.test('[import specs]', () => {
      errors.forEach(globals.fail)
    })
  }
})
