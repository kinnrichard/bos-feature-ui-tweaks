import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';
import svelteConfig from './svelte.config.js';
import namingConventionRule from './eslint-custom-rules/naming-convention-simple.js';

export default [
  js.configs.recommended,

  // Global ignores
  {
    ignores: [
      '.DS_Store',
      'node_modules/**',
      'build/**',
      '.svelte-kit/**',
      'package/**',
      '.env',
      '.env.*',
      '!.env.example',
      'vite.config.ts.timestamp-*',
      'vite.config.js.timestamp-*',
      'tmp/**',
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.js',
      '**/polymorphic/__tests__/**',
      'src/lib/zero/polymorphic/__tests__/**',
    ],
  },

  // Base configuration for all files
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'epic-007': {
        rules: {
          'naming-convention': namingConventionRule,
        },
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'epic-007/naming-convention': 'warn', // ✅ ENABLED: EPIC-007 Phase 2 naming convention
      'no-unused-vars': 'off', // Turn off base rule to avoid conflicts with TypeScript version
    },
  },

  // TypeScript configuration for .ts and .js files
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    ignores: ['eslint.config.js'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        extraFileExtensions: ['.svelte'],
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Svelte 5 runes for .svelte.ts files
        $state: 'readonly',
        $derived: 'readonly',
        $effect: 'readonly',
        $props: 'readonly',
        $bindable: 'readonly',
        $inspect: 'readonly',
        $host: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Service Worker configuration
  {
    files: ['**/service-worker.ts', '**/service-worker.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ServiceWorkerGlobalScope: 'readonly',
      },
    },
  },

  // Svelte-specific configuration with improved parser setup
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: typescriptParser,
        extraFileExtensions: ['.svelte'],
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
        svelteConfig,
      },
      globals: {
        // Svelte 5 runes
        $state: 'readonly',
        $derived: 'readonly',
        $effect: 'readonly',
        $props: 'readonly',
        $bindable: 'readonly',
        $inspect: 'readonly',
        $host: 'readonly',
      },
    },
    plugins: {
      svelte,
      '@typescript-eslint': typescript,
    },
    rules: {
      // Include Svelte recommended rules
      ...svelte.configs.recommended.rules,
      // Svelte-specific rules will be properly applied
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
