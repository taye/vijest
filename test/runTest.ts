import { spawnSync } from 'child_process'
import { join } from 'path'

import type { TestResult } from '@jest/test-result'
import { writeFileSync, existsSync, copySync, moveSync, mkdirpSync } from 'fs-extra'
import rimraf from 'rimraf'

import { stripAnsi } from '../src/utils'

const DEFAULT_FLAGS = ['--ci=true', '--json', '--bail=-1', '--config=jest.config.cjs']

export const runTest = (specDir: string, spec: () => void | string, flags: string[] = []) => {
  const tmpDir = join(specDir, '.tmp')
  const fixturesSourceDir = join(specDir, '__fixtures__')
  const specContents = typeof spec === 'string' ? spec : getFunctionBody(spec)
  const specDestFile = join(tmpDir, 'web_spec.ts')
  let result: TestResult

  rimraf.sync(tmpDir)
  mkdirpSync(tmpDir)
  ;['vijest.config.js', 'jest.config.cjs'].forEach((filename) =>
    copySync(...[__dirname, tmpDir].map((sourceDir) => join(sourceDir, filename))),
  )
  writeFileSync(specDestFile, specContents)
  existsSync(fixturesSourceDir) && copySync(fixturesSourceDir, tmpDir)

  expect(() => {
    const { stdout, stderr, error, status } = spawnSync('jest', [...DEFAULT_FLAGS, ...flags, specDestFile], {
      cwd: tmpDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    if (error) throw error

    if (status !== 0 && !stdout.length) {
      throw new Error(`jest command exited with code ${status}.\n\n${stderr}`)
    }

    const output = stripAnsi(stdout.toString())
    const outputWithoutViteLog = output.replace(/Pre-bundling[^{]+/, '')

    result = JSON.parse(outputWithoutViteLog)
  }).not.toThrow()

  return result
}

function getFunctionBody (fn: () => unknown) {
  const match = fn.toString().match(/^\(\)\s*=>\s*{?([\s\S]+)\s+?\}?$/)

  if (!match) {
    throw new Error('`runTest(() => {...})` must be given an arrow function')
  }

  const [, body] = match
  const [firstIndent] = body.match(/^[ \t]*/)

  if (!firstIndent) return body

  const lines = body.split('\n')

  if (!lines.every((line) => line.startsWith(firstIndent))) return body

  const reindented = lines.map((line) => line.replace(firstIndent, '')).join('\n')

  return reindented
}
