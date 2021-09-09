# Vitest

A Jest test runner for modern single-page web apps built with Vite. Run your tests directly
in a headless browser with a straight forward async API.

```shell
npm install --save-dev vitest jest
```

```js
// jest.config.json
{
  "preset": "vitest",
}
```

```js
// login.spec.ts
test('login', async () => {
  await vt.byTestId('login-link').click()

  await expect(vt.byTestId('login-button')).toBeDisabled()

  vt.byTestId('login-button').click()

  await vt.byTestId('username-input').type('test@example.com')
  await vt.byTestId('password-input').type('test-password')

  vt.byTestId('login-button').click()

  expect(vt.location.path()).toBe('/dashboard')
})
```

```shell
# start tests with jest cli
npx jest
```
