import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'public/', 'src/api/'],
  },

  // TypeScript strictest configs
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  // Vue strictest (all recommended rules promoted to error)
  ...pluginVue.configs['flat/recommended-error'],
  {
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
      },
    },
  },

  // Extra strict rules beyond the preset configs
  {
    rules: {
      // ── JS quality ──
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: 'error',
      curly: 'error',
      'no-eval': 'error',
      radix: 'error',
      'no-throw-literal': 'error',
      'no-new': 'warn',
      'no-implied-eval': 'error',
      'no-param-reassign': 'warn',

      // ── TypeScript extras ──
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/prefer-readonly': 'off',

      // ── Vue extras ──
      'vue/max-attributes-per-line': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-indent': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/block-order': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-self-closing': [
        'error',
        {
          html: { void: 'any', normal: 'never', component: 'any' },
        },
      ],
    },
  },
];
