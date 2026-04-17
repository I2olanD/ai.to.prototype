/**
 * Border-radius categorizer (implementation-plan T5.4, research §3.4).
 *
 * Input : flat RawStyleRecord stream from the DOM walker / resolver.
 * Output: DTCG `dimension` tokens (one per unique (property, normalized-value)
 *         pair) with usage selectors aggregated under `com.dte.usage`.
 *
 * Behavior notes:
 *   - Recognized properties are exactly the W3C border-radius shorthand +
 *     per-corner longhands (no `border-*-*-radius` two-value elliptical
 *     longhands; those are out of scope for v1).
 *   - `0` and `0px` both normalize to the canonical string `"0"`. `0` is a
 *     meaningful design decision ("no rounding") so it is emitted, not
 *     skipped — consistent with spacing/radius treatment elsewhere in the
 *     pipeline.
 *   - Values are otherwise preserved verbatim (after trimming). Pixel, rem,
 *     em, %, and pill-sized values flow through untouched. No synthetic
 *     `com.dte.isPill` flag is attached: `TokenExtensions` in src/types.ts is
 *     a closed shape owned by a different task, and adding keys here would
 *     require extending that type. Downstream renderers can detect pill
 *     radii from the value string itself (>= 9999px) if ever needed.
 *   - Confidence and usage count are initialized to 0; score.ts applies the
 *     ADR-4 formula in a later pipeline stage.
 *
 * Pure function: deterministic, side-effect free.
 */

import type { RawStyleRecord, Token } from '../types.ts';

export const RADIUS_PROPERTIES: readonly string[] = [
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
];

const RADIUS_PROPERTY_SET = new Set<string>(RADIUS_PROPERTIES);

/**
 * Normalize a radius value for dedup and output.
 *
 * Returns `null` for values that should be skipped (empty / whitespace).
 * Returns `"0"` for any zero-ish pixel value (`"0"`, `"0px"`, `"  0px "`).
 * Otherwise returns the trimmed value unchanged.
 */
function normalizeRadiusValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Collapse "0" and "0px" to the unitless canonical form "0". This is the
  // one normalization radius needs — everything else is preserved verbatim.
  if (trimmed === '0' || trimmed === '0px') return '0';

  return trimmed;
}

/**
 * Build the dedup key for a (property, normalized-value) pair.
 *
 * Using the property in the key keeps `border-top-left-radius: 4px` distinct
 * from `border-radius: 4px` — the same value expresses different design
 * decisions on different properties.
 */
function dedupKey(property: string, normalizedValue: string): string {
  return `${property}::${normalizedValue}`;
}

export function categorizeRadius(records: RawStyleRecord[]): Token[] {
  // Map preserves insertion order, which gives us stable output ordering
  // without a separate sort step.
  const byKey = new Map<string, Token>();

  for (const record of records) {
    if (!RADIUS_PROPERTY_SET.has(record.property)) continue;

    const normalized = normalizeRadiusValue(record.value);
    if (normalized === null) continue;

    const key = dedupKey(record.property, normalized);
    const existing = byKey.get(key);

    if (existing) {
      const selectors = existing.$extensions['com.dte.usage'].selectors;
      if (!selectors.includes(record.selector)) {
        selectors.push(record.selector);
      }
      continue;
    }

    byKey.set(key, {
      $value: normalized,
      $type: 'dimension',
      $extensions: {
        'com.dte.usage': {
          selectors: [record.selector],
          count: 0,
        },
        'com.dte.confidence': 0,
      },
    });
  }

  return Array.from(byKey.values());
}
