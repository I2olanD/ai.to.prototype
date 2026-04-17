import type { RawStyleRecord, Token } from '../types.ts';

/**
 * Z-index categorizer (spec 001, T5.6 / Research §3.6).
 *
 * Filters `z-index` declarations from a stream of raw style records,
 * coerces numeric values to `number`, and emits one deduplicated Token
 * per distinct value.
 *
 * Rules:
 *   - Input property must be exactly `z-index`; everything else is ignored.
 *   - Values are parsed with `parseInt(value, 10)`. Any non-numeric input
 *     (including the `auto` keyword, `initial`, `inherit`, or empty) is
 *     skipped — NaN means "no token."
 *   - `0` and negatives are valid z-index values and are emitted.
 *   - Multiple records with the same numeric value collapse to a single
 *     Token; their `selector`s are accumulated in
 *     `$extensions['com.dte.usage'].selectors` (deduped) with `count`
 *     tracking total occurrences.
 *   - Confidence is left at `0` — the downstream score stage (ADR-4)
 *     fills it in based on usage count.
 */
export function categorizeZIndex(records: RawStyleRecord[]): Token[] {
  const tokensByValue = new Map<number, Token>();

  for (const record of records) {
    if (record.property !== 'z-index') continue;

    const numericValue = parseZIndexValue(record.value);
    if (numericValue === null) continue;

    const existing = tokensByValue.get(numericValue);
    if (existing) {
      appendUsage(existing, record.selector);
      continue;
    }

    tokensByValue.set(numericValue, buildToken(numericValue, record.selector));
  }

  return Array.from(tokensByValue.values());
}

/**
 * Parses a CSS z-index string to a finite integer.
 *
 * Returns `null` for any input that `parseInt` cannot convert to a finite
 * number (e.g. `auto`, `initial`, `inherit`, `foo`, empty string).
 */
function parseZIndexValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const parsed = parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return null;

  return parsed;
}

function buildToken(value: number, selector: string): Token {
  return {
    $value: value,
    $type: 'number',
    $extensions: {
      'com.dte.usage': { selectors: [selector], count: 1 },
      'com.dte.confidence': 0,
    },
  };
}

function appendUsage(token: Token, selector: string): void {
  const usage = token.$extensions['com.dte.usage'];
  usage.count += 1;
  if (!usage.selectors.includes(selector)) {
    usage.selectors.push(selector);
  }
}
