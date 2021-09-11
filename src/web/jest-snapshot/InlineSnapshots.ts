import { postSync } from '../utils'

export type InlineSnapshot = {
  snapshot: string
  frame: any
  node?: any
}

export function saveInlineSnapshots (...args: unknown[]) {
  postSync('fs', { method: 'saveInlineSnapshots', args })
}
