import { stripAnsi } from '../../src/utils'
import { runTest } from '../runTest'

describe('soucemaps and coverage', () => {
  const results = runTest(
    __dirname,
    `/*
 * comment
 * will
 * be
 * stripped
 * by
 * esbuild
 */
test('one', () => {
  expect(() => {
    throw 'Thrown intentinally!'
  }).not.toThrow()
})`,
  )

  test('stack traces', async () => {
    expect(stripAnsi(results.testResults[0].message)).toContain('/test/sourceMaps/.tmp/web_spec.ts:12:10')
  })
})

//, ['--coverage=true']
