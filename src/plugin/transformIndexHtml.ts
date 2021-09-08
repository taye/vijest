import assert from 'assert'

import queryString from 'query-string'
import type { Plugin } from 'vite'

import { INTERNAL_SYMBOL_NAME, URL_RE } from '../constants'
import { getDepUrls, getSpecs } from '../utils'

import type { Internals } from '.'

let depUrlsPromise: Promise<ReturnType<typeof getDepUrls>>

const transformIndexHtml =
  ({ resolveWeb }: Internals): Plugin['transformIndexHtml'] =>
  async (html, { path, server }) => {
    assert(server)

    const [, subpath, search] = path.match(URL_RE) || []
    const isJasmine = subpath === 'jasmine'
    const isSpec = subpath === 'spec'

    if (!isJasmine && !isSpec) return

    const query = queryString.parse(search)
    const depUrls = await (depUrlsPromise = depUrlsPromise || getDepUrls({ server, resolveWeb }))

    const tags = isJasmine
      ? [
          {
            tag: 'script',
            children: `Object.assign(window, {
                global: window,
                [Symbol.for("${INTERNAL_SYMBOL_NAME}")]: { filename: ${JSON.stringify(query.spec)} }
              })`,
          },
          {
            tag: 'script',
            children: await getSpecs({ server, filenames: query.spec || [] }),
          },
          { tag: 'script', attrs: { type: 'module', src: depUrls.jasmine } },
        ]
      : [{ tag: 'script', attrs: { type: 'module', src: depUrls.spec } }]

    return { html, tags }
  }

export default transformIndexHtml
