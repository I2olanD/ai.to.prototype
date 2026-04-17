import type { RawStyleRecord, Token } from '../types.ts';

/**
 * Shadow categorizer (spec 001 T5.5, Research §3.5).
 *
 * Scans RawStyleRecords for `box-shadow` and `text-shadow` declarations
 * and emits one Token per distinct shadow string.
 *
 * Policy:
 *   - Stores the shadow value verbatim as a string. Multi-shadow lists
 *     (e.g. "0 1px 2px #000, 0 4px 8px #333") are kept as a single token;
 *     we do NOT split them into parts.
 *   - Dedup is exact-string match: two records collapse to one Token
 *     only if their values are byte-for-byte identical.
 *   - CSS-wide keywords {none, inherit, initial, unset} are skipped.
 *   - $type is 'shadow'. DTCG normally expects a structured object here;
 *     for v1 we emit the verbatim string so downstream tooling can parse.
 *   - $extensions.com.dte.confidence is 0 — the confidence scorer
 *     (src/score.ts) runs later in the pipeline.
 */

const SHADOW_PROPERTIES: ReadonlySet<string> = new Set([
  'box-shadow',
  'text-shadow',
]);

const SKIPPED_VALUES: ReadonlySet<string> = new Set([
  'none',
  'inherit',
  'initial',
  'unset',
]);

type Bucket = {
  value: string;
  selectors: string[];
  firstRecord: RawStyleRecord;
};

/**
 * Whether a record contributes to shadow token extraction.
 * Defensive against records whose value is already a CSS-wide keyword
 * or the `none` keyword (meaning "no shadow").
 */
function isShadowRecord(record: RawStyleRecord): boolean {
  if (!SHADOW_PROPERTIES.has(record.property)) return false;
  if (SKIPPED_VALUES.has(record.value)) return false;
  return true;
}

/**
 * Builds a Token from a dedup bucket. Source/theme come from the FIRST
 * record observed for the value, matching the convention used by
 * categorizeColors (see color.test.ts).
 */
function bucketToToken(bucket: Bucket): Token {
  return {
    $value: bucket.value,
    $type: 'shadow',
    $extensions: {
      'com.dte.usage': {
        selectors: bucket.selectors,
        count: bucket.selectors.length,
      },
      'com.dte.confidence': 0,
      'com.dte.source': bucket.firstRecord.source,
      'com.dte.theme': bucket.firstRecord.theme,
    },
  };
}

export function categorizeShadow(records: RawStyleRecord[]): Token[] {
  const buckets = new Map<string, Bucket>();

  for (const record of records) {
    if (!isShadowRecord(record)) continue;

    const existing = buckets.get(record.value);
    if (existing) {
      existing.selectors.push(record.selector);
      continue;
    }

    buckets.set(record.value, {
      value: record.value,
      selectors: [record.selector],
      firstRecord: record,
    });
  }

  return Array.from(buckets.values(), bucketToToken);
}
