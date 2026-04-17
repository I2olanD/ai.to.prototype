import type { RawStyleRecord, Token, TokenType } from '../types';

/**
 * Typography categorizer (spec 001 T5.2, Research §3.2).
 *
 * Groups RawStyleRecord items into five typography sub-buckets. Pure
 * function: same input → same output, no I/O, no side effects. Confidence
 * is left at 0; the Phase 6 scorer fills it in based on usage counts.
 *
 * Property → bucket mapping:
 *   font-family     → family         ($type 'fontFamily', verbatim string)
 *   font-size       → size           ($type 'dimension',  verbatim string)
 *   font-weight     → weight         ($type 'fontWeight', number or string)
 *   line-height     → lineHeight     ($type 'number' if unit-less, else 'dimension')
 *   letter-spacing  → letterSpacing  ($type 'dimension',  verbatim string)
 *
 * Keywords `normal`, `inherit`, `initial` are skipped: they carry no
 * design-token payload on their own and would otherwise collide with real
 * values during deduplication.
 */

export type TypographyBuckets = {
  family: Token[];
  size: Token[];
  weight: Token[];
  lineHeight: Token[];
  letterSpacing: Token[];
};

type BucketKey = keyof TypographyBuckets;

type NormalizedEntry = {
  bucket: BucketKey;
  value: string | number;
  type: TokenType;
};

const SKIP_KEYWORDS = new Set(['normal', 'inherit', 'initial']);

/**
 * Numeric parse that rejects any value with unit suffixes. We use a strict
 * regex instead of `Number(trimmed)` because `Number('16px')` is `NaN`
 * (fine) but `Number('')` is `0` and `Number(' 1.5 ')` is `1.5` — both
 * footguns for CSS input.
 */
function parsePlainNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalize(record: RawStyleRecord): NormalizedEntry | undefined {
  const { property, value } = record;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (SKIP_KEYWORDS.has(trimmed.toLowerCase())) return undefined;

  switch (property) {
    case 'font-family':
      return { bucket: 'family', value: trimmed, type: 'fontFamily' };
    case 'font-size':
      return { bucket: 'size', value: trimmed, type: 'dimension' };
    case 'font-weight': {
      const numeric = parsePlainNumber(trimmed);
      if (numeric !== undefined) {
        return { bucket: 'weight', value: numeric, type: 'fontWeight' };
      }
      return { bucket: 'weight', value: trimmed, type: 'fontWeight' };
    }
    case 'line-height': {
      const numeric = parsePlainNumber(trimmed);
      if (numeric !== undefined) {
        return { bucket: 'lineHeight', value: numeric, type: 'number' };
      }
      return { bucket: 'lineHeight', value: trimmed, type: 'dimension' };
    }
    case 'letter-spacing':
      return { bucket: 'letterSpacing', value: trimmed, type: 'dimension' };
    default:
      return undefined;
  }
}

function makeToken(entry: NormalizedEntry, record: RawStyleRecord): Token {
  const token: Token = {
    $value: entry.value,
    $type: entry.type,
    $extensions: {
      'com.dte.usage': { selectors: [record.selector], count: 1 },
      'com.dte.confidence': 0,
    },
  };
  // Only attach optional metadata when meaningfully set by the record.
  token.$extensions['com.dte.source'] = record.source;
  token.$extensions['com.dte.theme'] = record.theme;
  if (record.originalVar !== undefined) {
    token.$extensions['com.dte.unresolvedVar'] = record.originalVar;
  }
  return token;
}

function accumulate(existing: Token, record: RawStyleRecord): void {
  const usage = existing.$extensions['com.dte.usage'];
  usage.selectors.push(record.selector);
  usage.count += 1;
}

export function categorizeTypography(
  records: RawStyleRecord[],
): TypographyBuckets {
  const buckets: TypographyBuckets = {
    family: [],
    size: [],
    weight: [],
    lineHeight: [],
    letterSpacing: [],
  };

  // One dedup map per bucket; key is JSON-ish composite to keep string "400"
  // and number 400 separate (current inputs can't produce this collision,
  // but the key stays robust to future additions).
  const dedup: Record<BucketKey, Map<string, Token>> = {
    family: new Map(),
    size: new Map(),
    weight: new Map(),
    lineHeight: new Map(),
    letterSpacing: new Map(),
  };

  for (const record of records) {
    const entry = normalize(record);
    if (entry === undefined) continue;

    const key = `${typeof entry.value}:${String(entry.value)}`;
    const bucketMap = dedup[entry.bucket];
    const existing = bucketMap.get(key);
    if (existing !== undefined) {
      accumulate(existing, record);
      continue;
    }
    const token = makeToken(entry, record);
    bucketMap.set(key, token);
    buckets[entry.bucket].push(token);
  }

  return buckets;
}
