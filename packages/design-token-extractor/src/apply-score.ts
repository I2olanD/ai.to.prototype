/**
 * Applies the ADR-4 confidence scorer across a Token list (spec 001, T6.2).
 *
 * Each token's `com.dte.confidence` is replaced with the result of
 * `scoreConfidence(usage.count)`. The input array and its tokens are not
 * mutated; a new array of new tokens is returned.
 *
 * Pure: no I/O, no external side effects.
 */

import { scoreConfidence } from './score';
import type { Token } from './types.ts';

/**
 * Returns a new Token list where each token's confidence reflects its
 * current usage count per the ADR-4 thresholds.
 */
export function applyScores(tokens: Token[]): Token[] {
  return tokens.map((token) => ({
    ...token,
    $extensions: {
      ...token.$extensions,
      'com.dte.confidence': scoreConfidence(
        token.$extensions['com.dte.usage'].count,
      ),
    },
  }));
}
