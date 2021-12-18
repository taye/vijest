import '@testing-library/jest-dom'

test('snapshots', async () => {
  expect(1).toMatchSnapshot()

  jest.useFakeTimers()

  const callback = jest.fn(() => {
    vt.debugger()
  })

  setTimeout(callback, 4000)
  expect(callback).not.toHaveBeenCalled()
  jest.runAllTimers()

  expect(callback).toHaveBeenCalled()

  const input = document.body.appendChild(document.createElement('input'))

  await vt.type('input', 'Lorem ')
  await vt.keyboard.type('ipsum')

  expect(input).toHaveValue('Lorem ipsum')

  expect(100).toMatchInlineSnapshot('100')
  expect([100]).toMatchInlineSnapshot({ length: 1, 0: 100 } as unknown as Array<number>)
})
