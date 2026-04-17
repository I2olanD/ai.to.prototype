/**
 * Motion categorizer — spec 001 T5.8, research §3.8.
 *
 * Splits motion-related RawStyleRecords into two DTCG buckets:
 *
 *   { duration: Token[], easing: Token[] }
 *
 * Categorization rules
 * --------------------
 *
 * Duration properties:
 *   - transition-duration
 *   - animation-duration
 *   → $type = 'duration', $value = original string (unit preserved verbatim)
 *   → `0s` is included; `none`, `initial`, `inherit` are skipped
 *
 * Easing properties:
 *   - transition-timing-function
 *   - animation-timing-function
 *   → Named keywords (ease, ease-in, ease-out, ease-in-out, linear,
 *     step-start, step-end)          → $type = 'other'
 *   → `cubic-bezier(...)`             → $type = 'cubicBezier' (string value;
 *                                       structured 4-number parse is deferred
 *                                       to a later pass; downstream code can
 *                                       reinterpret the verbatim string)
 *   → `steps(...)`                    → $type = 'other'
 *   → `none`, `initial`, `inherit`    → skipped
 *
 * Deduplication
 * -------------
 * Within a bucket, records that share the same `$value` string collapse into
 * a single Token. All source selectors are recorded under
 * `$extensions['com.dte.usage']`; duplicate selectors are de-duped, so the
 * recorded `count` reflects unique contributing selectors.
 *
 * Confidence and theme extensions are NOT populated here — T6.2 (scorer
 * application) fills `com.dte.confidence` from the usage count, and the
 * theme extension belongs to the theme classification pass. Source is set
 * when all contributing records agree on a single StyleSource; otherwise it
 * is omitted (the dedup pass in T6.1 owns cross-source tie-breaking).
 */
import type {
  RawStyleRecord,
  StyleSource,
  Token,
  TokenType,
} from '../types.ts';

/**
 * Two-bucket output shape for the motion categorizer.
 *
 * Matches the nested structure of `TokenSet.motion` (a SubcategoryCollection):
 * downstream namers slot these arrays into `motion.duration` and
 * `motion.easing` keyed by generated token names.
 */
export type MotionBuckets = {
  duration: Token[];
  easing: Token[];
};

const DURATION_PROPERTIES: ReadonlySet<string> = new Set([
  'transition-duration',
  'animation-duration',
]);

const EASING_PROPERTIES: ReadonlySet<string> = new Set([
  'transition-timing-function',
  'animation-timing-function',
]);

/**
 * Values that are structurally valid CSS but carry no design-token signal.
 * Skipped for both duration and easing properties.
 */
const SKIPPED_VALUES: ReadonlySet<string> = new Set([
  'none',
  'initial',
  'inherit',
]);

/**
 * Named easing keywords defined by the CSS Easing Functions spec. Kept as a
 * set so we can recognise them in O(1) without regex overhead.
 */
const EASING_KEYWORDS: ReadonlySet<string> = new Set([
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'linear',
  'step-start',
  'step-end',
]);

/**
 * Classify an easing value string into its DTCG $type.
 *
 * Per DTCG, `cubicBezier` expects a 4-number array. Since v1 stores the
 * verbatim CSS string (structured parse deferred), we still tag
 * `cubic-bezier(...)` as `cubicBezier` so downstream passes can reinterpret.
 * Keywords and `steps(...)` fall back to `other` — they are not representable
 * as a 4-number cubicBezier and have no dedicated DTCG type.
 */
function classifyEasing(value: string): TokenType {
  const lower = value.trim().toLowerCase();
  if (lower.startsWith('cubic-bezier(')) return 'cubicBezier';
  if (EASING_KEYWORDS.has(lower)) return 'other';
  // steps(...) and any other functional notation
  return 'other';
}

/**
 * Intermediate aggregation state for a single ($type, $value) entry within
 * a bucket. Collapses multiple RawStyleRecords that share a value into one
 * Token at emit time.
 */
type Aggregate = {
  $value: string;
  $type: TokenType;
  selectors: Set<string>;
  sources: Set<StyleSource>;
};

function upsert(
  map: Map<string, Aggregate>,
  key: string,
  type: TokenType,
  record: RawStyleRecord,
): void {
  const existing = map.get(key);
  if (existing) {
    existing.selectors.add(record.selector);
    existing.sources.add(record.source);
    return;
  }
  map.set(key, {
    $value: record.value,
    $type: type,
    selectors: new Set([record.selector]),
    sources: new Set([record.source]),
  });
}

function toToken(agg: Aggregate): Token {
  const selectors = [...agg.selectors];
  const token: Token = {
    $value: agg.$value,
    $type: agg.$type,
    $extensions: {
      'com.dte.usage': {
        selectors,
        count: selectors.length,
      },
      'com.dte.confidence': 0,
    },
  };
  if (agg.sources.size === 1) {
    const [onlySource] = agg.sources;
    token.$extensions['com.dte.source'] = onlySource;
  }
  return token;
}

/**
 * Split motion records into duration and easing Token buckets.
 *
 * Pure function: no I/O, no mutation of inputs.
 */
export function categorizeMotion(records: RawStyleRecord[]): MotionBuckets {
  const durationAgg = new Map<string, Aggregate>();
  const easingAgg = new Map<string, Aggregate>();

  for (const record of records) {
    const value = record.value.trim();
    if (SKIPPED_VALUES.has(value.toLowerCase())) continue;

    if (DURATION_PROPERTIES.has(record.property)) {
      // Key by raw value — `300ms` and `0.3s` remain distinct tokens even
      // though they denote the same duration; unit canonicalisation is a
      // separate (deferred) pass.
      upsert(durationAgg, value, 'duration', record);
      continue;
    }

    if (EASING_PROPERTIES.has(record.property)) {
      const type = classifyEasing(value);
      upsert(easingAgg, value, type, record);
      continue;
    }
    // Non-motion property: ignore.
  }

  return {
    duration: [...durationAgg.values()].map(toToken),
    easing: [...easingAgg.values()].map(toToken),
  };
}
