import { spawnSync } from 'child_process'
import { resolve } from 'path'

const runTest = (dir: string) => {
  let result
  const cwd = resolve(__dirname, '..')

  expect(() => {
    const { stdout, error } = spawnSync(
      'jest',
      ['--ci', '--json', '--bail=-1', '--config=jest.config.cjs', resolve(dir, 'web_spec.ts')],
      { cwd, stdio: ['ignore', 'pipe', 'ignore'] },
    )

    if (error) throw error

    result = JSON.parse(stdout.toString())
  }).not.toThrow()

  return result
}

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
