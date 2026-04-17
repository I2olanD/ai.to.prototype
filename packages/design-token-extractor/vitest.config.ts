import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/e2e/**/*.test.ts'],
    testTimeout: 30000,
    setupFiles: ['tests/setup.ts'],
    passWithNoTests: true,
  },
});
