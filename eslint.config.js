import neostandard from 'neostandard'

export default [
  ...neostandard({}),
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly'
      }
    }
  }
]
