import { HOST_BASE_PATH, INTERNAL } from '../constants'

import type { WebGlobal } from './jasmine'

// get pre-mock globals
const { fetch, XMLHttpRequest } = window

export async function post (path: string, body?: any) {
  const r = await fetch(`${HOST_BASE_PATH}/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!r.ok) {
    throw new Error(await r.json())
  }

  return await r.json()
}

export function postSync (path: string, body?: any) {
  const xhr = new XMLHttpRequest()

  xhr.open('POST', `${HOST_BASE_PATH}/${path}`, false)
  xhr.send(body && JSON.stringify(body))

  const { responseText } = xhr

  return responseText ? JSON.parse(xhr.responseText) : undefined
}

const { pathSeparator } = (global as WebGlobal)[INTERNAL]

export const join = (...segments: string[]) => segments.join(pathSeparator)
export const dirname = (path: string) => path.slice(-path.lastIndexOf(pathSeparator)) || ''
