import { describe, expect, it } from 'vitest';
import { categorizeRadius, RADIUS_PROPERTIES } from '../../../src/categorize/radius.ts';
import type { RawStyleRecord } from '../../../src/types.ts';

/**
 * Tests for categorizeRadius (implementation-plan T5.4, research §3.4).
 *
 * Scope:
 *   - Recognizes the border-radius family of properties.
 *   - Emits DTCG `dimension` tokens preserving px/% units.
 *   - Normalizes bare `0` / `0px` to `"0"` (never dropped — `0` is a meaningful
 *     radius expressing "no rounding").
 *   - Large pill-like values (>= 9999px) are included verbatim as dimensions
 *     (no special $extensions flag; types.ts is owned by another agent and the
 *     'com.dte.isPill' key is intentionally out of scope per the task brief).
 *   - Deduplicates the same (property, normalized-value) across selectors,
 *     aggregating selectors into `com.dte.usage.selectors`.
 *   - Sets `com.dte.usage.count` to 0 and `com.dte.confidence` to 0
 *     (scoring happens later in the pipeline).
 */

function record(
  selector: string,
  property: string,
  value: string,
  overrides: Partial<RawStyleRecord> = {},
): RawStyleRecord {
  return {
    selector,
    property,
    value,
    source: 'stylesheet',
    theme: 'light',
    scope: ':root',
    ...overrides,
  };
}

describe('categorizeRadius — empty input', () => {
  it('returns an empty array when given no records', () => {
    expect(categorizeRadius([])).toEqual([]);
  });

  it('returns an empty array when no records match radius properties', () => {
    const records: RawStyleRecord[] = [
      record('.btn', 'color', '#fff'),
      record('.btn', 'padding', '8px'),
      record('.btn', 'font-size', '16px'),
    ];
    expect(categorizeRadius(records)).toEqual([]);
  });
});

describe('categorizeRadius — property recognition', () => {
  it('exports the full border-radius property family', () => {
    expect(RADIUS_PROPERTIES).toEqual([
      'border-radius',
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-right-radius',
      'border-bottom-left-radius',
    ]);
  });

  it.each([
    'border-radius',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ])('emits a dimension token for %s', (property) => {
    const tokens = categorizeRadius([record('.card', property, '4px')]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$type).toBe('dimension');
    expect(tokens[0]?.$value).toBe('4px');
  });

  it('ignores non-radius properties that merely contain the word "radius"', () => {
    // There are no standard CSS properties by this name, but the filter must
    // be an exact match against the allowlist — not a substring test.
    const tokens = categorizeRadius([record('.x', 'radius-custom', '4px')]);
    expect(tokens).toEqual([]);
  });
});

describe('categorizeRadius — value handling', () => {
  it('emits a pixel dimension token verbatim', () => {
    const [token] = categorizeRadius([record('.card', 'border-radius', '4px')]);
    expect(token).toBeDefined();
    expect(token?.$type).toBe('dimension');
    expect(token?.$value).toBe('4px');
  });

  it('normalizes bare "0" to "0" (no unit) and keeps the token', () => {
    const [token] = categorizeRadius([record('.card', 'border-radius', '0')]);
    expect(token).toBeDefined();
    expect(token?.$type).toBe('dimension');
    expect(token?.$value).toBe('0');
  });

  it('normalizes "0px" to "0" and keeps the token', () => {
    const [token] = categorizeRadius([record('.card', 'border-radius', '0px')]);
    expect(token).toBeDefined();
    expect(token?.$value).toBe('0');
  });

  it('deduplicates "0" and "0px" into a single token', () => {
    const tokens = categorizeRadius([
      record('.a', 'border-radius', '0'),
      record('.b', 'border-radius', '0px'),
    ]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$value).toBe('0');
    expect(tokens[0]?.$extensions['com.dte.usage'].selectors).toEqual(['.a', '.b']);
  });

  it('includes very large (pill-like) values as dimensions without special flags', () => {
    const [token] = categorizeRadius([record('.pill', 'border-radius', '9999px')]);
    expect(token).toBeDefined();
    expect(token?.$type).toBe('dimension');
    expect(token?.$value).toBe('9999px');
    // No 'com.dte.isPill' or other ad-hoc keys — types.ts is not extended.
    expect(token?.$extensions).not.toHaveProperty('com.dte.isPill');
  });

  it('includes percentage values verbatim as dimensions', () => {
    const [token] = categorizeRadius([record('.circle', 'border-radius', '50%')]);
    expect(token).toBeDefined();
    expect(token?.$type).toBe('dimension');
    expect(token?.$value).toBe('50%');
  });

  it('trims surrounding whitespace in values', () => {
    const [token] = categorizeRadius([record('.card', 'border-radius', '  8px  ')]);
    expect(token?.$value).toBe('8px');
  });

  it('skips empty or whitespace-only values', () => {
    const tokens = categorizeRadius([
      record('.a', 'border-radius', ''),
      record('.b', 'border-radius', '   '),
    ]);
    expect(tokens).toEqual([]);
  });
});

describe('categorizeRadius — deduplication across selectors', () => {
  it('merges repeated (property, value) pairs into one token and aggregates selectors', () => {
    const tokens = categorizeRadius([
      record('.a', 'border-radius', '4px'),
      record('.b', 'border-radius', '4px'),
      record('.c', 'border-radius', '4px'),
    ]);
    expect(tokens).toHaveLength(1);
    const [token] = tokens;
    expect(token?.$value).toBe('4px');
    expect(token?.$extensions['com.dte.usage'].selectors).toEqual(['.a', '.b', '.c']);
  });

  it('does not duplicate the same selector when observed multiple times', () => {
    const tokens = categorizeRadius([
      record('.a', 'border-radius', '4px'),
      record('.a', 'border-radius', '4px'),
    ]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$extensions['com.dte.usage'].selectors).toEqual(['.a']);
  });

  it('keeps distinct values as separate tokens', () => {
    const tokens = categorizeRadius([
      record('.a', 'border-radius', '4px'),
      record('.b', 'border-radius', '8px'),
    ]);
    expect(tokens).toHaveLength(2);
    const values = tokens.map((t) => t.$value).sort();
    expect(values).toEqual(['4px', '8px']);
  });

  it('treats different radius properties with the same value as distinct tokens', () => {
    // A top-left 4px radius is not the same design decision as a uniform 4px
    // radius; preserving the property distinction avoids silent collapse.
    const tokens = categorizeRadius([
      record('.a', 'border-radius', '4px'),
      record('.b', 'border-top-left-radius', '4px'),
    ]);
    expect(tokens).toHaveLength(2);
  });
});

describe('categorizeRadius — token extensions', () => {
  it('initializes usage.count and confidence to 0 (scored downstream)', () => {
    const [token] = categorizeRadius([record('.card', 'border-radius', '4px')]);
    expect(token?.$extensions['com.dte.usage'].count).toBe(0);
    expect(token?.$extensions['com.dte.confidence']).toBe(0);
  });

  it('records selectors in insertion order (stable ordering downstream)', () => {
    const tokens = categorizeRadius([
      record('.z', 'border-radius', '4px'),
      record('.a', 'border-radius', '4px'),
      record('.m', 'border-radius', '4px'),
    ]);
    expect(tokens[0]?.$extensions['com.dte.usage'].selectors).toEqual(['.z', '.a', '.m']);
  });
});
