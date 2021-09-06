import { HOST_BASE_PATH } from '../constants'

// get pre-mock globals
const { fetch, XMLHttpRequest } = window

export async function post(path: string, body?: any) {
  const r = await fetch(`${HOST_BASE_PATH}/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return await r.json()
}

export function postSync(path: string, body?: any) {
  const xhr = new XMLHttpRequest()

  xhr.open('POST', `${HOST_BASE_PATH}/${path}`, false)
  xhr.send(body && JSON.stringify(body))

  return JSON.parse(xhr.responseText || 'null')
}
