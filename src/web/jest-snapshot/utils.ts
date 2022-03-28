import type { Config } from '@jest/types'
import chalk from 'chalk'
import * as fs from 'graceful-fs'
import type { SnapshotData } from 'jest-snapshot/build/types'
import naturalCompare from 'natural-compare'
import type { OptionsReceived as PrettyFormatOptions } from 'pretty-format'
import { format as prettyFormat } from 'pretty-format'

import { join, dirname } from '../utils'

import { getSerializers } from './plugins'

export const SNAPSHOT_VERSION = '1'
export const SNAPSHOT_GUIDE_LINK = 'https://goo.gl/fbAQLP'
export const SNAPSHOT_VERSION_WARNING = chalk.yellow(
  `${chalk.bold('Warning')}: Before you upgrade snapshots, ` +
    `we recommend that you revert any local changes to tests or other code, ` +
    `to ensure that you do not store invalid state.`,
)

const writeSnapshotVersion = () => `// Jest Snapshot v${SNAPSHOT_VERSION}, ${SNAPSHOT_GUIDE_LINK}`

function isObject (item: unknown): boolean {
  return item != null && typeof item === 'object' && !Array.isArray(item)
}

export const testNameToKey = (testName: Config.Path, count: number): string => testName + ' ' + count

export const keyToTestName = (key: string): string => {
  if (!/ \d+$/.test(key)) {
    throw new Error('Snapshot keys must end with a number.')
  }

  return key.replace(/ \d+$/, '')
}

// Add extra line breaks at beginning and end of multiline snapshot
// to make the content easier to read.
export const addExtraLineBreaks = (string: string): string =>
  string.includes('\n') ? `\n${string}\n` : string

// Remove extra line breaks at beginning and end of multiline snapshot.
// Instead of trim, which can remove additional newlines or spaces
// at beginning or end of the content from a custom serializer.
export const removeExtraLineBreaks = (string: string): string =>
  string.length > 2 && string.startsWith('\n') && string.endsWith('\n') ? string.slice(1, -1) : string

export const removeLinesBeforeExternalMatcherTrap = (stack: string): string => {
  const lines = stack.split('\n')

  for (let i = 0; i < lines.length; i += 1) {
    // It's a function name specified in `packages/expect/src/index.ts`
    // for external custom matchers.
    if (lines[i].includes('__EXTERNAL_MATCHER_TRAP__')) {
      return lines.slice(i + 1).join('\n')
    }
  }

  return stack
}

const escapeRegex = true
const printFunctionName = false

export const serialize = (val: unknown, indent = 2, formatOverrides: PrettyFormatOptions = {}): string =>
  normalizeNewlines(
    prettyFormat(val, {
      escapeRegex,
      indent,
      plugins: getSerializers(),
      printFunctionName,
      ...formatOverrides,
    }),
  )

export const minify = (val: unknown): string =>
  prettyFormat(val, {
    escapeRegex,
    min: true,
    plugins: getSerializers(),
    printFunctionName,
  })

// Remove double quote marks and unescape double quotes and backslashes.
export const deserializeString = (stringified: string): string =>
  stringified.slice(1, -1).replace(/\\("|\\)/g, '$1')

export const escapeBacktickString = (str: string): string => str.replace(/`|\\|\${/g, '\\$&')

const printBacktickString = (str: string): string => '`' + escapeBacktickString(str) + '`'

export const ensureDirectoryExists = (filePath: Config.Path): void => {
  try {
    fs.mkdirSync(join(dirname(filePath)), { recursive: true })
  } catch {}
}

const normalizeNewlines = (string: string) => string.replace(/\r\n|\r/g, '\n')

export const saveSnapshotFile = (snapshotData: SnapshotData, snapshotPath: Config.Path): void => {
  const snapshots = Object.keys(snapshotData)
    .sort(naturalCompare)
    .map(
      (key) =>
        'exports[' +
        printBacktickString(key) +
        '] = ' +
        printBacktickString(normalizeNewlines(snapshotData[key])) +
        ';',
    )

  ensureDirectoryExists(snapshotPath)
  fs.writeFileSync(snapshotPath, writeSnapshotVersion() + '\n\n' + snapshots.join('\n\n') + '\n')
}

const deepMergeArray = (target: Array<any>, source: Array<any>) => {
  const mergedOutput = Array.from(target)

  source.forEach((sourceElement, index) => {
    const targetElement = mergedOutput[index]

    if (Array.isArray(target[index])) {
      mergedOutput[index] = deepMergeArray(target[index], sourceElement)
    } else if (isObject(targetElement)) {
      mergedOutput[index] = deepMerge(target[index], sourceElement)
    } else {
      // Source does not exist in target or target is primitive and cannot be deep merged
      mergedOutput[index] = sourceElement
    }
  })

  return mergedOutput
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const deepMerge = (target: any, source: any): any => {
  if (isObject(target) && isObject(source)) {
    const mergedOutput = { ...target }

    Object.keys(source).forEach((key) => {
      if (isObject(source[key]) && !source[key].$$typeof) {
        if (!(key in target)) Object.assign(mergedOutput, { [key]: source[key] })
        else mergedOutput[key] = deepMerge(target[key], source[key])
      } else if (Array.isArray(source[key])) {
        mergedOutput[key] = deepMergeArray(target[key], source[key])
      } else {
        Object.assign(mergedOutput, { [key]: source[key] })
      }
    })

    return mergedOutput
  } else if (Array.isArray(target) && Array.isArray(source)) {
    return deepMergeArray(target, source)
  }

  return target
}
