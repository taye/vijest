import { runTest } from '../runTest'

test('snapshots', () => {
  const results = runTest(__dirname, () => {
    it('matching', () => {
      expect({ array: [1, 2, 3] }).toMatchSnapshot()
      expect(1).toMatchInlineSnapshot('1')
      expect(new Set(['one', 'two'])).toMatchSnapshot()
    })

    it('failing', () => {
      expect(1).toMatchSnapshot()
      expect([1, 2, 3]).toMatchSnapshot()
    })

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('skipped', () => {
      expect(1).toMatchSnapshot()
    })

    it('unused', () => {
      expect(true).toBeTruthy()
    })
  })

  expect(results.testResults.map((r) => r.status)).toEqual(['failed'])
  expect(results.snapshot).toEqual({
    // ...emptyTestResult.snapshot,
    failure: true,
    didUpdate: false,
    added: 0,
    filesAdded: 0,
    matched: 3,
    total: 5,
    filesRemoved: 1,
    filesRemovedList: [`${__dirname}/.tmp/__snapshots__/not-used.ts.snap`],
    filesUnmatched: 1,
    filesUpdated: 0,
    unchecked: 2,
    uncheckedKeysByFile: [
      {
        filePath: `${__dirname}/.tmp/web_spec.ts`,
        keys: ['unused 1', 'unused 4'],
      },
    ],
    unmatched: 2,
    updated: 0,
  })
})
