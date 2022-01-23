it('matching', () => {
  expect({ array: [1, 2, 3] }).toMatchSnapshot()
  expect(1).toMatchInlineSnapshot('1')
  expect(new Set(['one', 'two'])).toMatchSnapshot()
})

it('failing', () => {
  expect(1).toMatchSnapshot()
  expect([1, 2, 3]).toMatchSnapshot()
})

it.skip('skipped', () => {
  expect(1).toMatchSnapshot()
})

it('unused', () => {
  expect(true).toBeTruthy()
})
