import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        crypto: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        process: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
