/**
 * Vitest Configuration for Epic 015 Console Migration Tests
 * Specialized configuration for testing the debug system migration
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test files specific to Epic 015
    include: [
      'src/lib/utils/debug/__tests__/epic-015-*.test.ts'
    ],
    
    // Environment setup
    environment: 'jsdom',
    
    // Global setup
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/utils/debug/**/*.ts',
        'src/lib/api/auth.ts',
        'src/lib/zero/**/*.ts',
        'src/lib/models/**/*.ts',
        'src/lib/components/**/*.svelte',
        'src/lib/utils/popover-utils.ts'
      ],
      exclude: [
        'src/lib/utils/debug/__tests__/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**'
      ],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Setup files
    setupFiles: ['./src/lib/utils/debug/__tests__/setup.ts'],
    
    // Mock configuration
    server: {
      deps: {
        inline: ['debug']
      }
    },
    
    // Reporter configuration
    reporter: ['verbose'],
    
    // Parallel execution
    maxConcurrency: 4,
    
    // Retry configuration
    retry: 2,
    
    // Watch configuration
    watch: false
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '$lib': resolve(__dirname, './src/lib'),
      '$app': resolve(__dirname, './src/app')
    }
  },
  
  // Define configuration
  define: {
    'import.meta.env.DEV': 'true',
    'import.meta.env.PROD': 'false'
  }
});