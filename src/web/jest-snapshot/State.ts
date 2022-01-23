import type { Config } from '@jest/types'
import { getStackTraceLines, getTopFrame } from 'jest-message-util'
import type { SnapshotMatchOptions } from 'jest-snapshot/build/State'
import type { SnapshotData } from 'jest-snapshot/build/types'
import type { OptionsReceived as PrettyFormatOptions } from 'pretty-format'

import * as fs from '../remoteFs'
import reporter from '../remoteReporter'

import type { InlineSnapshot } from './InlineSnapshots'
import {
  addExtraLineBreaks,
  removeExtraLineBreaks,
  removeLinesBeforeExternalMatcherTrap,
  serialize,
  testNameToKey,
} from './utils'

export type SnapshotInit = Partial<SnapshotState> & {
  _uncheckedKeys: string[]
  _counters: Array<[string, number]>
}

export class SnapshotState {
  _counters!: Map<string, number>
  private _updateSnapshot!: Config.SnapshotUpdateState
  private _snapshotData!: SnapshotData
  private _initialData!: SnapshotData
  private _snapshotPath!: Config.Path
  private _inlineSnapshots!: Array<InlineSnapshot>
  _uncheckedKeys!: Set<string>
  private _snapshotFormat!: PrettyFormatOptions

  added!: number
  expand!: boolean
  matched!: number
  unmatched!: number
  updated!: number

  constructor (state: SnapshotInit) {
    this.clear()
    Object.assign(this, state, {
      _uncheckedKeys: new Set(state._uncheckedKeys),
      _counters: new Map(state._counters),
    })
  }

  private _addSnapshot (
    key: string,
    receivedSerialized: string,
    options: { isInline: boolean; error?: Error },
  ): void {
    if (options.isInline) {
      const error = options.error || new Error()
      const lines = getStackTraceLines(removeLinesBeforeExternalMatcherTrap(error.stack || ''))
      const frame = getTopFrame(lines)
      if (!frame) {
        throw new Error("Jest: Couldn't infer stack frame for inline snapshot.")
      }
      this._inlineSnapshots.push({
        frame,
        snapshot: receivedSerialized,
      })
    } else {
      this._snapshotData[key] = receivedSerialized
      reporter.snapshot({ method: '_addSnapshot', args: [key, receivedSerialized, options] })
    }
  }

  clear (): void {
    this._snapshotData = this._initialData
    this._inlineSnapshots = []
    this._counters = new Map()
    this.added = 0
    this.matched = 0
    this.unmatched = 0
    this.updated = 0
  }

  match (arg: SnapshotMatchOptions) {
    const res = this._match(arg)
    const { added, matched, unmatched, updated } = this
    const updateData = { added, matched, unmatched, updated, uncheckedKeys: Array.from(this._uncheckedKeys) }

    reporter.snapshot({ method: '__update', args: [updateData] })

    return res
  }

  _match ({ testName, received, key, inlineSnapshot, isInline, error }: SnapshotMatchOptions) {
    this._counters.set(testName, (this._counters.get(testName) || 0) + 1)
    const count = Number(this._counters.get(testName))

    if (!key) {
      key = testNameToKey(testName, count)
    }

    // Do not mark the snapshot as "checked" if the snapshot is inline and
    // there's an external snapshot. This way the external snapshot can be
    // removed with `--updateSnapshot`.
    if (!(isInline && this._snapshotData[key] !== undefined)) {
      this._uncheckedKeys.delete(key)
    }

    const receivedSerialized = addExtraLineBreaks(serialize(received, undefined, this._snapshotFormat))
    const expected = isInline ? inlineSnapshot : this._snapshotData[key]
    const pass = expected === receivedSerialized
    const hasSnapshot = expected !== undefined
    const snapshotIsPersisted = isInline || fs.existsSync(this._snapshotPath)

    if (pass && !isInline) {
      // Executing a snapshot file as JavaScript and writing the strings back
      // when other snapshots have changed loses the proper escaping for some
      // characters. Since we check every snapshot in every test, use the newly
      // generated formatted string.
      // Note that this is only relevant when a snapshot is added and the dirty
      // flag is set.
      this._snapshotData[key] = receivedSerialized
    }

    // These are the conditions on when to write snapshots:
    //  * There's no snapshot file in a non-CI environment.
    //  * There is a snapshot file and we decided to update the snapshot.
    //  * There is a snapshot file, but it doesn't have this snaphsot.
    // These are the conditions on when not to write snapshots:
    //  * The update flag is set to 'none'.
    //  * There's no snapshot file or a file without this snapshot on a CI environment.
    if (
      (hasSnapshot && this._updateSnapshot === 'all') ||
      ((!hasSnapshot || !snapshotIsPersisted) &&
        (this._updateSnapshot === 'new' || this._updateSnapshot === 'all'))
    ) {
      if (this._updateSnapshot === 'all') {
        if (!pass) {
          if (hasSnapshot) {
            this.updated++
          } else {
            this.added++
          }
          this._addSnapshot(key, receivedSerialized, { error, isInline })
        } else {
          this.matched++
        }
      } else {
        this._addSnapshot(key, receivedSerialized, { error, isInline })
        this.added++
      }

      return {
        actual: '',
        count,
        expected: '',
        key,
        pass: true,
      }
    } else {
      if (!pass) {
        this.unmatched++
        return {
          actual: removeExtraLineBreaks(receivedSerialized),
          count,
          expected: expected !== undefined ? removeExtraLineBreaks(expected) : undefined,
          key,
          pass: false,
        }
      } else {
        this.matched++
        return {
          actual: '',
          count,
          expected: '',
          key,
          pass: true,
        }
      }
    }
  }

  fail (testName: string, _received: unknown, key?: string): string {
    this._counters.set(testName, (this._counters.get(testName) || 0) + 1)
    const count = Number(this._counters.get(testName))

    if (!key) {
      key = testNameToKey(testName, count)
    }

    this._uncheckedKeys.delete(key)
    this.unmatched++

    reporter.snapshot({ method: 'fail', args: [testName, _received, key] })

    return key
  }
}
