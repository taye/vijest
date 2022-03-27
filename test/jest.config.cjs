const { resolve } = require('path')

module.exports = {
  preset: resolve(__dirname, '..', '..', '..'),
  testMatch: ["./**/*_spec.ts"],
  coverageReporters: []
}
