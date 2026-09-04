import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/release/**',
      'apps/desktop/**',
      '.agents/**'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended
)
