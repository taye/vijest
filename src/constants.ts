export const PLUGIN_NAME = 'vite-jasmine'
export const INTERNAL = Symbol(PLUGIN_NAME + '-internal')
export const DEFAULT_SPEC_PATTERN = '**/*.spec.{t,j}s{,x}'
export const HOST_BASE_PATH = '/@jasmine'
export const URL_RE = RegExp(`^${HOST_BASE_PATH.replace(/\//g, '[/]')}[/]?([^?]*)`)
