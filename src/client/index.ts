import { env, globals } from './jasmine'

Object.assign(window, globals)

window.addEventListener('load', async () => {
  const errors: Error[] = []
  const pushError = (e: Error) => errors.push(e)

  const specImports: Array<{ filename: string; url: string }> = (window as any).__specs
  const specs = specImports.map(
    ({ filename, url }) => [filename, () => import(/* @vite-ignore */ url).catch(pushError)] as const,
  )

  // load tests
  await Promise.all(
    specs.map(([filename, importer]) => {
      console.log('[jasmine client]', 'loading:', filename)
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
