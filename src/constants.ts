export const PLUGIN_NAME = 'vite-jasmine'
export const INTERNAL_SYMBOL_NAME = PLUGIN_NAME + '-internal'
export const INTERNAL = Symbol.for(INTERNAL_SYMBOL_NAME)
export const DEFAULT_SPEC_PATTERN = '**/*.spec.{t,j}s{,x}'
export const HOST_BASE_PATH = '/@jasmine'
export const URL_RE = RegExp(`^${HOST_BASE_PATH.replace(/\//g, '[/]')}[/]?([^?]*)([?].*)?`)
export const LAUNCH_SYMBOL = Symbol.for(PLUGIN_NAME + '-launch')
