import NodeEnvironment from 'jest-environment-node'
import { INTERNAL, LAUNCH_SYMBOL } from '../constants'
import { launch } from '../launcher'
import { getLaunch } from '../utils'

export default class Environment extends NodeEnvironment {
  static __filename = __filename;
  [INTERNAL] = true

  constructor(...args: any[]) {
    getLaunch(() =>
      launch({
        // headless: false,
        // devtools: true,
        // slowMo: 500,
      }),
    )

    // @ts-expect-error
    super(...args)
  }

  async setup() {
    await super.setup()
    await this.global[LAUNCH_SYMBOL as any]
  }
}
