import { stripAnsi } from '../../src/utils'
import { runTest } from '../runTest'

describe('soucemaps and coverage', () => {
  const results = runTest(__dirname, ['--coverage=true'])

  test('stack traces', async () => {
    expect(stripAnsi(results.testResults[0].message)).toContain('/test/coverage/web_spec.ts:10:44')
  })
})
