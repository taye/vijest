import { createContext } from 'vm'

import type { Config } from '@jest/types'
import { ModuleMocker } from 'jest-mock'

import { INTERNAL } from '../constants'

export default class Environment {
  static __filename = __filename;

  // allow distinction of vijest environment
  [INTERNAL] = true

  global? = {} as typeof globalThis
  moduleMocker? = new ModuleMocker(this.global!)
  context? = createContext(this.global)

  constructor (public config: Config.ProjectConfig) {}

  getVmContext () {
    return this.global
  }

  setup () {}
  teardown () {
    this.global = undefined
    this.moduleMocker = undefined
    this.context = undefined
  }
}
