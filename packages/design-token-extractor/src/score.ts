/**
 * Confidence scorer for extracted design tokens.
 *
 * Implements the stepwise formula from ADR-4 (solution-design.md):
 *
 *   count >= 10 → 0.9
 *   count >=  5 → 0.7
 *   count >=  2 → 0.5
 *   else        → 0.2
 *
 * Pure function: no imports, no side effects, input-independent output.
 * Negative or non-integer counts are handled by the same threshold chain;
 * a negative count falls through to the `else` branch (0.2).
 */
export function scoreConfidence(usageCount: number): number {
  if (usageCount >= 10) return 0.9;
  if (usageCount >= 5) return 0.7;
  if (usageCount >= 2) return 0.5;
  return 0.2;
}
