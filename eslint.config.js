import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '.*/**', 'packages/geometry/**'] },
  { files: ['**/*.{js,jsx,ts,tsx}'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/backend/**', 'packages/cli/**', '**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/frontend/src/**'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The CLI writes its output to stdout.
    files: ['packages/cli/**'],
    rules: { 'no-console': 'off' },
  },
  prettier,
)
