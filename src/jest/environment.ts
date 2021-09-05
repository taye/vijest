import NodeEnvironment from 'jest-environment-node'
import { INTERNAL } from '../constants'

export default class Environment extends NodeEnvironment {
  static __filename = __filename;
  // allow distinction of vitest environment
  [INTERNAL] = true

  constructor(...args: any[]) {
    // @ts-expect-error
    super(...args)
  }
}
