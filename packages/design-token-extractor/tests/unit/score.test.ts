import { describe, expect, it } from 'vitest';
import { scoreConfidence } from '../../src/score.ts';

/**
 * Boundary table per ADR-4 (SDD §"ADR-4 Confidence formula").
 *
 *   count >= 10 → 0.9
 *   count >=  5 → 0.7
 *   count >=  2 → 0.5
 *   else        → 0.2
 */
describe('scoreConfidence (ADR-4 boundary table)', () => {
  it('returns 0.2 for usageCount 0', () => {
    expect(scoreConfidence(0)).toBe(0.2);
  });

  it('returns 0.2 for usageCount 1 (single observation)', () => {
    expect(scoreConfidence(1)).toBe(0.2);
  });

  it('returns 0.5 at the lower bound of the low-confidence tier (2)', () => {
    expect(scoreConfidence(2)).toBe(0.5);
  });

  it('returns 0.5 at the upper bound of the low-confidence tier (4)', () => {
    expect(scoreConfidence(4)).toBe(0.5);
  });

  it('returns 0.7 at the lower bound of the medium-confidence tier (5)', () => {
    expect(scoreConfidence(5)).toBe(0.7);
  });

  it('returns 0.7 at the upper bound of the medium-confidence tier (9)', () => {
    expect(scoreConfidence(9)).toBe(0.7);
  });

  it('returns 0.9 at the lower bound of the high-confidence tier (10)', () => {
    expect(scoreConfidence(10)).toBe(0.9);
  });

  it('returns 0.9 for usageCount 100', () => {
    expect(scoreConfidence(100)).toBe(0.9);
  });

  it('returns 0.9 for usageCount 1000', () => {
    expect(scoreConfidence(1000)).toBe(0.9);
  });
});

describe('scoreConfidence (defensive inputs)', () => {
  it('treats negative counts as zero/low confidence', () => {
    expect(scoreConfidence(-1)).toBe(0.2);
  });

  it('uses the >= 2 threshold for non-integer counts (2.5 → 0.5)', () => {
    expect(scoreConfidence(2.5)).toBe(0.5);
  });
});
