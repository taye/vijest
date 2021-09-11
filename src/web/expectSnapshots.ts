import expect, { setState } from 'expect'

import { SnapshotState } from './jest-snapshot'
import {
  toMatchInlineSnapshot,
  toMatchSnapshot,
  toThrowErrorMatchingInlineSnapshot,
  toThrowErrorMatchingSnapshot,
} from './jest-snapshot'

export async function expectSnapshots () {
  expect.extend({
    toMatchInlineSnapshot,
    toMatchSnapshot,
    toThrowErrorMatchingInlineSnapshot,
    toThrowErrorMatchingSnapshot,
  })

  // Jest tests snapshotSerializers in order preceding built-in serializers.
  // Therefore, add in reverse because the last added is the first tested.
  // for (const path of config.snapshotSerializers .concat() .reverse()) {
  // addSerializer(( await import(path) ).default);
  // }

  // const {expand, updateSnapshot} = globalConfig;
  // const {prettierPath, snapshotFormat} = config;
  // const snapshotResolver = buildSnapshotResolver()
  // TODO
  // const snapshotPath = snapshotResolver.resolveSnapshotPath(testPath)
  const snapshotState = await new SnapshotState().init()

  // @ts-expect-error: snapshotState is a jest extension of `expect`
  setState({ snapshotState })
  // Return it back to the outer scope (test runner outside the VM).
  return snapshotState
}
