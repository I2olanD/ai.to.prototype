/**
 * Value-indexed token namer (spec 001, task T6.3).
 *
 * Per ADR-3 + SDD §"Deterministic naming", tokens are assigned numeric
 * names of the form `${prefix}-${i+1}`. Ordering within a bucket is:
 *
 *   1. `com.dte.usage.count` DESC (most-used first)
 *   2. `String($value)` ASC (lexicographic) — deterministic tie-break
 *
 * Running the same input through `nameBucket` twice must produce
 * identical output, hence the explicit tie-break on the stringified value.
 *
 * Pure functions: no mutation, no I/O, no framework dependencies.
 */

import type { Token } from './types.ts';

/**
 * Returns `String(v)` for the purposes of tie-break sorting. Object-valued
 * tokens (e.g. composite shadow) stringify via JSON with sorted keys so
 * two structurally equal values compare identically regardless of property
 * insertion order.
 */
function tieBreakKey(value: Token['$value']): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  const keys = Object.keys(value).sort();
  const ordered: Record<string, unknown> = {};
  for (const key of keys) {
    ordered[key] = value[key];
  }
  return JSON.stringify(ordered);
}

/**
 * Assigns names to a flat Token[] using `${prefix}-${i+1}`, ordered by
 * count DESC with lexicographic tie-break on the stringified value.
 */
export function nameBucket(
  tokens: Token[],
  prefix: string,
): Record<string, Token> {
  const sorted = tokens.slice().sort((a, b) => {
    const countDiff =
      b.$extensions['com.dte.usage'].count -
      a.$extensions['com.dte.usage'].count;
    if (countDiff !== 0) return countDiff;
    const aKey = tieBreakKey(a.$value);
    const bKey = tieBreakKey(b.$value);
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;
    return 0;
  });

  const named: Record<string, Token> = {};
  sorted.forEach((token, index) => {
    named[`${prefix}-${index + 1}`] = token;
  });
  return named;
}

/**
 * Names each sub-bucket in a category (e.g. typography → family / size /
 * weight / lineHeight / letterSpacing), using the provided prefix template
 * to form per-bucket prefixes like `font-family`, `font-size`, etc.
 */
export function nameSubcategory(
  buckets: Record<string, Token[]>,
  prefixTemplate: (subkey: string) => string,
): Record<string, Record<string, Token>> {
  const out: Record<string, Record<string, Token>> = {};
  for (const subkey of Object.keys(buckets)) {
    const sub = buckets[subkey];
    out[subkey] = nameBucket(sub ?? [], prefixTemplate(subkey));
  }
  return out;
}
