/*
 * comment
 * will
 * be
 * stripped
 * by
 * esbuild
 */
test('one', () => {
  expect(() => {
    throw 'test error'
  }).not.toThrow()
})
