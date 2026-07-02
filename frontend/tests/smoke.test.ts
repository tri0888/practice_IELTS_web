import { describe, it, expect } from 'vitest'

// M0 harness smoke test: proves the Vitest runner works.
// Real grading tests (ported from the backend characterization suite)
// arrive in M2 once lib/grading.ts exists.
describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
