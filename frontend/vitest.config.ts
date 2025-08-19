import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    // Only include Vitest-specific tests to avoid conflicts with Playwright
    include: ['src/**/*.{test,spec}.{js,ts}', 'tests/generator/**/*.{test,spec}.{js,ts}'],
    // Exclude all Playwright test directories
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/drag-drop/**', // Playwright tests
      '**/tests/pages/**',     // Playwright tests
      '**/tests/components/**', // Playwright tests
      '**/tests/helpers/**',   // Playwright test helpers
      '**/tests/*.spec.ts',    // Root level Playwright tests
      'tests/**/*.spec.ts'     // All test spec files in tests/ (reserved for Playwright)
    ],
    environment: 'jsdom',
    globals: false, // Don't use globals to avoid conflicts
    setupFiles: ['src/test-setup.ts'],
  },
});
