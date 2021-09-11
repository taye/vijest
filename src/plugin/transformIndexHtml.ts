import assert from 'assert'

import queryString from 'query-string'
import type { IndexHtmlTransform, Plugin } from 'vite'

import { INTERNAL_SYMBOL_NAME, URL_RE } from '../constants'
import { getDepUrls, getSpec } from '../utils'

import type { Internals } from '.'

let depUrlsPromise: Promise<ReturnType<typeof getDepUrls>>

const transformIndexHtml = ({ resolveWeb }: Internals): Plugin['transformIndexHtml'] => {
  const transform: IndexHtmlTransform = async (html, { path, server }) => {
    assert(server)

    const [, subpath, search] = path.match(URL_RE) || []
    const isJasmine = subpath === 'jasmine'
    const isSpec = subpath === 'spec'

    if (!isJasmine && !isSpec) return

    const query = queryString.parse(search)
    const depUrls = await (depUrlsPromise = depUrlsPromise || getDepUrls({ server, resolveWeb }))

    assert(isSpec || typeof query.spec === 'string')

    const specState = { filename: query.spec }
    const tags = isJasmine
      ? [
          {
            tag: 'script',
            children: `Object.assign(window, {
                global: window,
                [Symbol.for("${INTERNAL_SYMBOL_NAME}")]: ${JSON.stringify(specState)}
              })`,
          },
          {
            tag: 'script',
            children: await getSpec({ server, filename: (query.spec as string) || '' }),
          },
          { tag: 'script', attrs: { type: 'module', src: depUrls.jasmine } },
        ]
      : [{ tag: 'script', attrs: { type: 'module', src: depUrls.spec } }]

    return { html, tags }
  }

  return { enforce: 'pre', transform }
}

export default transformIndexHtml
