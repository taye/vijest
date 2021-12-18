export const PLUGIN_NAME = 'vitest'
export const INTERNAL_SYMBOL_NAME = PLUGIN_NAME + '-internal'
export const INTERNAL = Symbol.for(INTERNAL_SYMBOL_NAME)
export const DEFAULT_SPEC_PATTERN = '**/*.spec.{t,j}s{,x}'
export const HOST_BASE_PATH = '/@vitest'
export const URL_RE = RegExp(`^${HOST_BASE_PATH.replace(/\//g, '[/]')}[/]?([^?]*)([?].*)?`)
export const LAUNCH_SYMBOL = Symbol.for(PLUGIN_NAME + '-launch')

export const CONSOLE_METHODS = [
  'count',
  'countReset',
  'debug',
  'error',
  'info',
  'log',
  'table',
  'warn',
  'dir',
  'dirxml',
] as const

export const STUBBED_WEB_DEPS = new Set([])

export const SYNC_REQUESTS = new Set(['fs', 'init', 'debugger'])

export const ALLOWED_FS_METHODS = new Set([
  'existsSync',
  'mkdirSync',
  'readFileSync',
  'realPathSync',
  'unlinkSync',
  'writeFileSync',
] as const)

export const PAGE_METHODS = new Set([
  'hover',
  'select',
  'tap',
  'type',
  'mouse.click',
  'mouse.down',
  'mouse.move',
  'mouse.up',
  'mouse.wheel',
  'touchscreen.tap',
  'keyboard.down',
  'keyboard.press',
  'keyboard.sendCharacter',
  'keyboard.type',
  'keyboard.up',
])
