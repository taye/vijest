import * as pretty from 'pretty-format'

import { env, globals } from './jasmine'
import { CONSOLE_METHODS } from '../constants'
import reporter from './remoteReporter'

Object.assign(window, globals)

import supportsColor from 'supports-color'

CONSOLE_METHODS.forEach((type) => {
  const original = console[type]

  if (!original) return

  console[type] = (...args) => {
    original.apply(console, args as any)

    if (type === 'table') type = 'log'

    const highlight = !!supportsColor.stdout

    const formattedArgs = type.startsWith('count')
      ? args.map((arg) => arg.toString())
      : args.map((arg) => pretty.format(arg, { plugins: Object.values(pretty.plugins), highlight }))

    reporter.console!({ type, args: formattedArgs })
  }
})

window.addEventListener('load', async () => {
  const errors: Error[] = []
  const pushError = (e: Error) => errors.push(e)

  const specImports: Array<{ filename: string; url: string }> = (window as any).__specs
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
