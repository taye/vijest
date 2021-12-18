# Vitest

A Jest test runner for modern single-page web apps built with Vite. Run your tests directly
in a headless browser with a straight forward async API.

```shell
npm install --save-dev vitest jest
```

```js
// jest.config.json
{
  "preset": "vitest"
}
```

```js
// login.spec.ts
import '@testing-library/jest-dom'

test('login', async () => {
  getByTestId('login-button').click()

  expect(getByTestId('login-submit')).toBeDisabled()

  await vt.type('#username-input', 'test@example.com')
  await vt.type('#password-input', 'test-password')

  vt.debugger()

  findByTestId('login-button').click()

  await waitFor(() => expect(location.pathname).toBe('/dashboard'))
})
```

```shell
# start tests with jest cli
npx jest
```
