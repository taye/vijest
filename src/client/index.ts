// @ts-expect-error
const { globals, env } = window.parent.__clientProps || {}

const _sab = window.SharedArrayBuffer || ArrayBuffer

Object.assign(window, { SharedArrayBuffer: _sab }, globals)

window.addEventListener('load', async () => {
  const errors: Error[] = []
  const pushError = (e: Error) => errors.push(e)

  const specImports: Array<{ filename: string, url: string }> = JSON.parse((window.frameElement as HTMLIFrameElement)?.dataset.specs || '[]')
  const specs = specImports.map(({ filename, url }) => [
    filename,
    () => import(/* @vite-ignore */ url).catch(pushError)
  ] as const)

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
