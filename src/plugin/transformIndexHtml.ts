import assert from 'assert'

import queryString from 'query-string'
import type { IndexHtmlTransform, Plugin } from 'vite'

import { HOST_BASE_PATH, INTERNAL_SYMBOL_NAME, URL_RE } from '../constants'
import { getDepUrls, getSpecJson } from '../utils'

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

    const tags = isJasmine
      ? [
          {
            tag: 'script',
            children: `(() => {
              let resolve, reject
              const ready = new Promise((res, rej) => { resolve = res; reject = rej })
              Object.assign(window, {
                global: window,
                [Symbol.for("${INTERNAL_SYMBOL_NAME}")]: {
                  currentSpec: ${await getSpecJson({ server, filename: (query.spec as string) || '' })},
                  id: ${JSON.stringify(query.id)},
                  ready, resolve, reject,
                }
              })
            })()`,
          },
          { tag: 'script', attrs: { type: 'module', src: depUrls.jasmine } },
          { tag: 'iframe', attrs: { src: HOST_BASE_PATH + '/spec' }, injectTo: 'body' } as const,
        ]
      : [{ tag: 'script', attrs: { type: 'module', src: depUrls.spec } }]

    return { html, tags }
  }

  return { enforce: 'pre', transform }
}

export default transformIndexHtml
