test('snapshots', () => {
  expect(1).toMatchSnapshot()

  jest.useFakeTimers()

  const callback = jest.fn(() => {
    vt.debugger()
  })

  setTimeout(callback, 4000)
  expect(callback).not.toHaveBeenCalled()
  jest.runAllTimers()

  expect(callback).toHaveBeenCalled()

  expect(100).toMatchInlineSnapshot('100')
  // expect([100]).toMatchInlineSnapshot('Array [\n   100,\n]')
})
