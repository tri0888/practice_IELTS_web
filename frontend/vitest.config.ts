import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Real unit tests (e.g. lib/grading.ts) land in M2; harness proven in M0.
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    environment: 'node',
  },
})
