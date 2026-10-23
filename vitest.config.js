'use strict';

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['srv/domain/**/*.js'],
      thresholds: { lines: 80, functions: 80, statements: 80 },
    },
  },
});
