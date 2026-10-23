'use strict';

const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'gen/**', 'coverage/**', 'app/**'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        SELECT: 'readonly',
        INSERT: 'readonly',
        UPDATE: 'readonly',
        DELETE: 'readonly',
        cds: 'readonly',
      },
      ecmaVersion: 2022,
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },
];
