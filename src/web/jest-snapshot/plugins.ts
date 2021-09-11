import type { Plugin as PrettyFormatPlugin, Plugins as PrettyFormatPlugins } from 'pretty-format'
import { plugins as prettyFormatPlugins } from 'pretty-format'

import jestMockSerializer from './mockSerializer'

const { DOMCollection, DOMElement, Immutable, ReactElement, ReactTestComponent, AsymmetricMatcher } =
  prettyFormatPlugins

let PLUGINS: PrettyFormatPlugins = [
  ReactTestComponent,
  ReactElement,
  DOMElement,
  DOMCollection,
  Immutable,
  jestMockSerializer,
  AsymmetricMatcher,
]

// Prepend to list so the last added is the first tested.
export const addSerializer = (plugin: PrettyFormatPlugin): void => {
  PLUGINS = [plugin].concat(PLUGINS)
}

export const getSerializers = (): PrettyFormatPlugins => PLUGINS
