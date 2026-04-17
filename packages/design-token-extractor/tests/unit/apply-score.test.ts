import { describe, expect, it } from 'vitest';
import { applyScores } from '../../src/apply-score.ts';
import type { Token } from '../../src/types.ts';

/**
 * T6.2 — Applies scoreConfidence() to each token's com.dte.confidence
 * based on the token's usage count. Must be a pure function: input array
 * and its tokens are not mutated.
 *
 * Boundary table (ADR-4):
 *   count >= 10 → 0.9
 *   count >=  5 → 0.7
 *   count >=  2 → 0.5
 *   else        → 0.2
 */

function tokenWithCount(count: number): Token {
  return {
    $value: '#ff0000',
    $type: 'color',
    $extensions: {
      'com.dte.usage': { selectors: ['.x'], count },
      'com.dte.confidence': 0,
      'com.dte.source': 'stylesheet',
      'com.dte.theme': 'light',
    },
  };
}

describe('applyScores (empty input)', () => {
  it('returns [] for an empty token list', () => {
    expect(applyScores([])).toEqual([]);
  });
});

describe('applyScores (scores each token by usage count)', () => {
  it('sets confidence to 0.2 when usage count is 1', () => {
    const result = applyScores([tokenWithCount(1)]);
    expect(result[0]!.$extensions['com.dte.confidence']).toBe(0.2);
  });

  it('sets confidence to 0.5 when usage count is 2', () => {
    const result = applyScores([tokenWithCount(2)]);
    expect(result[0]!.$extensions['com.dte.confidence']).toBe(0.5);
  });

  it('sets confidence to 0.7 when usage count is 5', () => {
    const result = applyScores([tokenWithCount(5)]);
    expect(result[0]!.$extensions['com.dte.confidence']).toBe(0.7);
  });

  it('sets confidence to 0.9 when usage count is 10', () => {
    const result = applyScores([tokenWithCount(10)]);
    expect(result[0]!.$extensions['com.dte.confidence']).toBe(0.9);
  });

  it('scores every token in a multi-token list', () => {
    const result = applyScores([
      tokenWithCount(1),
      tokenWithCount(5),
      tokenWithCount(10),
    ]);

    expect(result.map((t) => t.$extensions['com.dte.confidence'])).toEqual([
      0.2, 0.7, 0.9,
    ]);
  });
});

describe('applyScores (purity)', () => {
  it('does not mutate the input array', () => {
    const tokens: Token[] = [tokenWithCount(1)];
    const snapshot = JSON.parse(JSON.stringify(tokens));

    applyScores(tokens);

    expect(tokens).toEqual(snapshot);
  });

  it('does not mutate individual input tokens', () => {
    const token = tokenWithCount(10);
    const snapshot = JSON.parse(JSON.stringify(token));

    applyScores([token]);

    expect(token).toEqual(snapshot);
    expect(token.$extensions['com.dte.confidence']).toBe(0);
  });

  it('returns a new array instance', () => {
    const tokens: Token[] = [tokenWithCount(1)];
    const result = applyScores(tokens);

    expect(result).not.toBe(tokens);
  });
});
