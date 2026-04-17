import { describe, expect, it } from 'vitest';
import { categorizeShadow } from '../../../src/categorize/shadow.ts';
import type { RawStyleRecord } from '../../../src/types.ts';

/**
 * Tests for src/categorize/shadow.ts (spec 001 T5.5, Research §3.5).
 *
 * Contract:
 *   categorizeShadow(records: RawStyleRecord[]): Token[]
 *
 * Behaviour:
 *   - Only records whose property is `box-shadow` or `text-shadow` are processed.
 *   - Values {none, inherit, initial, unset} are skipped (CSS-wide keywords).
 *   - Shadow strings are stored verbatim, including multi-shadow comma-lists;
 *     we do NOT split the list into parts. Dedup is exact-string match.
 *   - $type is 'shadow' and $value is a string. DTCG normally expects a
 *     structured object; for v1 we emit the verbatim string so downstream
 *     tooling can parse it.
 *   - $extensions['com.dte.usage'] carries selectors (in input order) and
 *     a count equal to the number of records that shared the exact string.
 *   - $extensions['com.dte.confidence'] is 0 (scoring happens later in the
 *     pipeline, per ADR-4).
 */

function makeRecord(overrides: Partial<RawStyleRecord> = {}): RawStyleRecord {
  return {
    selector: '.default',
    property: 'box-shadow',
    value: '0 1px 2px rgba(0,0,0,0.05)',
    source: 'stylesheet',
    theme: 'light',
    scope: ':root',
    ...overrides,
  };
}

describe('categorizeShadow (empty input)', () => {
  it('returns [] for an empty record list', () => {
    expect(categorizeShadow([])).toEqual([]);
  });
});

describe('categorizeShadow (basic extraction)', () => {
  it('emits a single shadow Token for a box-shadow record', () => {
    const tokens = categorizeShadow([
      makeRecord({
        selector: '.card',
        property: 'box-shadow',
        value: '0 1px 2px rgba(0,0,0,0.05)',
      }),
    ]);

    expect(tokens).toHaveLength(1);
    const token = tokens[0]!;
    expect(token.$type).toBe('shadow');
    expect(token.$value).toBe('0 1px 2px rgba(0,0,0,0.05)');
    expect(typeof token.$value).toBe('string');
  });

  it('emits a single shadow Token for a text-shadow record', () => {
    const tokens = categorizeShadow([
      makeRecord({
        selector: '.headline',
        property: 'text-shadow',
        value: '1px 1px 2px #000',
      }),
    ]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.$type).toBe('shadow');
    expect(tokens[0]!.$value).toBe('1px 1px 2px #000');
  });

  it('attaches $extensions.com.dte.usage with selectors and count', () => {
    const tokens = categorizeShadow([
      makeRecord({
        selector: '.card',
        property: 'box-shadow',
        value: '0 1px 2px rgba(0,0,0,0.05)',
      }),
    ]);

    expect(tokens[0]!.$extensions['com.dte.usage']).toEqual({
      selectors: ['.card'],
      count: 1,
    });
  });

  it('sets com.dte.confidence to 0 (scoring happens later)', () => {
    const tokens = categorizeShadow([
      makeRecord({
        selector: '.card',
        property: 'box-shadow',
        value: '0 1px 2px rgba(0,0,0,0.05)',
      }),
    ]);

    expect(tokens[0]!.$extensions['com.dte.confidence']).toBe(0);
  });

  it('propagates source and theme from the first record of each group', () => {
    const tokens = categorizeShadow([
      makeRecord({
        selector: '.card',
        property: 'box-shadow',
        value: '0 1px 2px rgba(0,0,0,0.05)',
        source: 'inline',
        theme: 'dark',
      }),
    ]);

    expect(tokens[0]!.$extensions['com.dte.source']).toBe('inline');
    expect(tokens[0]!.$extensions['com.dte.theme']).toBe('dark');
  });
});

describe('categorizeShadow (multi-shadow preserved verbatim)', () => {
  it('stores a multi-shadow comma list as ONE Token with the full string', () => {
    const multi = '0 1px 2px #000, 0 4px 8px #333';
    const tokens = categorizeShadow([
      makeRecord({ selector: '.layer', property: 'box-shadow', value: multi }),
    ]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.$value).toBe(multi);
    expect(typeof tokens[0]!.$value).toBe('string');
  });

  it('does not split multi-shadows into separate tokens', () => {
    const multi = '0 1px 2px #000, 0 4px 8px #333';
    const tokens = categorizeShadow([
      makeRecord({ property: 'box-shadow', value: multi }),
    ]);

    // One token for the whole comma-separated string — not two.
    expect(tokens).toHaveLength(1);
  });
});

describe('categorizeShadow (skipped values)', () => {
  it('skips `none`', () => {
    const tokens = categorizeShadow([
      makeRecord({ value: 'none' }),
    ]);

    expect(tokens).toEqual([]);
  });

  it('skips `inherit`', () => {
    expect(categorizeShadow([makeRecord({ value: 'inherit' })])).toEqual([]);
  });

  it('skips `initial`', () => {
    expect(categorizeShadow([makeRecord({ value: 'initial' })])).toEqual([]);
  });

  it('skips `unset`', () => {
    expect(categorizeShadow([makeRecord({ value: 'unset' })])).toEqual([]);
  });
});

describe('categorizeShadow (property filtering)', () => {
  it('ignores records whose property is not box-shadow or text-shadow', () => {
    const tokens = categorizeShadow([
      makeRecord({
        property: 'color',
        value: '0 1px 2px #000',
      }),
    ]);

    expect(tokens).toEqual([]);
  });

  it('accepts both box-shadow and text-shadow properties', () => {
    const tokens = categorizeShadow([
      makeRecord({
        selector: '.a',
        property: 'box-shadow',
        value: '0 1px 2px #000',
      }),
      makeRecord({
        selector: '.b',
        property: 'text-shadow',
        value: '1px 1px 2px #111',
      }),
    ]);

    expect(tokens).toHaveLength(2);
  });
});

describe('categorizeShadow (dedup by exact string)', () => {
  it('merges identical shadow strings across selectors into one Token', () => {
    const value = '0 1px 2px rgba(0,0,0,0.05)';
    const tokens = categorizeShadow([
      makeRecord({ selector: '.a', property: 'box-shadow', value }),
      makeRecord({ selector: '.b', property: 'box-shadow', value }),
      makeRecord({ selector: '.c', property: 'box-shadow', value }),
    ]);

    expect(tokens).toHaveLength(1);
    const usage = tokens[0]!.$extensions['com.dte.usage'];
    expect(usage.count).toBe(3);
    expect(usage.selectors).toEqual(['.a', '.b', '.c']);
  });

  it('merges identical multi-shadow strings across selectors into one Token', () => {
    const multi = '0 1px 2px #000, 0 4px 8px #333';
    const tokens = categorizeShadow([
      makeRecord({ selector: '.a', property: 'box-shadow', value: multi }),
      makeRecord({ selector: '.b', property: 'box-shadow', value: multi }),
    ]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.$value).toBe(multi);
    expect(tokens[0]!.$extensions['com.dte.usage'].count).toBe(2);
  });

  it('emits separate Tokens for distinct shadow strings', () => {
    const tokens = categorizeShadow([
      makeRecord({ selector: '.a', value: '0 1px 2px #000' }),
      makeRecord({ selector: '.b', value: '0 4px 8px #333' }),
    ]);

    expect(tokens).toHaveLength(2);
    const values = tokens.map((t) => t.$value);
    expect(values).toContain('0 1px 2px #000');
    expect(values).toContain('0 4px 8px #333');
  });

  it('treats strings differing only in whitespace/order as distinct (exact match)', () => {
    // Dedup is exact-string match; "0 1px 2px #000" and "0 1px  2px #000"
    // (double space) are two different tokens.
    const tokens = categorizeShadow([
      makeRecord({ selector: '.a', value: '0 1px 2px #000' }),
      makeRecord({ selector: '.b', value: '0 1px  2px #000' }),
    ]);

    expect(tokens).toHaveLength(2);
  });
});
