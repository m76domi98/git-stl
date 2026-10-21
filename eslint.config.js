import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'packages/geometry/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/backend/**', 'packages/cli/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/frontend/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
)
