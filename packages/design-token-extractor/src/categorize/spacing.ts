/**
 * Spacing categorizer.
 *
 * Pure function mapping `RawStyleRecord[]` to spacing `Token[]`.
 * Spec references:
 *   - implementation-plan.md T5.3
 *   - research §3.3 (spacing scale extraction)
 *   - SDD §"Application Data Models"
 *
 * Rules:
 *   - Only records whose `property` is in SPACING_PROPERTIES are considered.
 *   - Values `auto`, `inherit` and empty strings are skipped.
 *   - `0px` and `0` collapse to a single canonical string `0`
 *     (zero is a valid spacing value and MUST be retained).
 *   - Negative values (e.g. `-8px`) are preserved verbatim.
 *   - Shorthand strings (e.g. `8px 16px`) are kept verbatim; splitting is
 *     a scoring/dedup concern handled in a later pipeline stage.
 *   - Tokens are deduped by their canonical value across selectors.
 *   - Confidence is initialized to 0; scoring happens in a later stage.
 */
import type { RawStyleRecord, Token, TokenExtensions, StyleSource } from '../types.ts';

export const SPACING_PROPERTIES: readonly string[] = [
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'gap',
  'row-gap',
  'column-gap',
] as const;

const SKIPPED_VALUES: ReadonlySet<string> = new Set(['auto', 'inherit']);

function isSpacingProperty(property: string): boolean {
  return SPACING_PROPERTIES.includes(property);
}

/**
 * Normalize a spacing value to its canonical form.
 * Returns `null` if the value is not a valid spacing token.
 *
 * Canonicalization rules:
 *   - Trim whitespace.
 *   - `0` / `0px` → `0`.
 *   - `auto`, `inherit`, empty string → rejected (`null`).
 *   - All other strings are returned as-is (including shorthand and negatives).
 */
function canonicalize(rawValue: string): string | null {
  const value = rawValue.trim();
  if (value === '') return null;

  const lowered = value.toLowerCase();
  if (SKIPPED_VALUES.has(lowered)) return null;

  if (value === '0' || lowered === '0px') return '0';

  return value;
}

type Bucket = {
  value: string;
  selectors: string[];
  count: number;
  source: StyleSource;
};

function buildToken(bucket: Bucket): Token {
  const extensions: TokenExtensions = {
    'com.dte.usage': {
      selectors: bucket.selectors.slice(),
      count: bucket.count,
    },
    'com.dte.confidence': 0,
    'com.dte.source': bucket.source,
  };

  return {
    $value: bucket.value,
    $type: 'dimension',
    $extensions: extensions,
  };
}

export function categorizeSpacing(records: RawStyleRecord[]): Token[] {
  const buckets = new Map<string, Bucket>();

  for (const record of records) {
    if (!isSpacingProperty(record.property)) continue;

    const canonicalValue = canonicalize(record.value);
    if (canonicalValue === null) continue;

    const existing = buckets.get(canonicalValue);
    if (existing === undefined) {
      buckets.set(canonicalValue, {
        value: canonicalValue,
        selectors: [record.selector],
        count: 1,
        source: record.source,
      });
      continue;
    }

    existing.count += 1;
    if (!existing.selectors.includes(record.selector)) {
      existing.selectors.push(record.selector);
    }
  }

  const tokens: Token[] = [];
  for (const bucket of buckets.values()) {
    tokens.push(buildToken(bucket));
  }
  return tokens;
}
