import { runTest } from '../runTest'

test('snapshots', () => {
  const results = runTest(__dirname)

  expect(results.testResults.map((r) => r.status)).toEqual(['failed'])
  expect(results.snapshot).toEqual({
    // ...emptyTestResult.snapshot,
    failure: true,
    didUpdate: false,
    added: 0,
    filesAdded: 0,
    matched: 3,
    total: 5,
    filesRemoved: 0,
    filesRemovedList: [],
    filesUnmatched: 1,
    filesUpdated: 0,
    unchecked: 2,
    uncheckedKeysByFile: [
      {
        filePath: '/home/taye/proj/vitest/test/snapshots/web_spec.ts',
        keys: ['unused 1', 'unused 4'],
      },
    ],
    unmatched: 2,
    updated: 0,
  })
})
