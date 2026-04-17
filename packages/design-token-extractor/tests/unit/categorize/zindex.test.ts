import { describe, expect, it } from 'vitest';
import { categorizeZIndex } from '../../../src/categorize/zindex.ts';
import type { RawStyleRecord, Token } from '../../../src/types.ts';

/**
 * Tests for the z-index categorizer (spec 001, T5.6 / Research §3.6).
 *
 * Rules under test:
 *   - Only records with `property === 'z-index'` are considered.
 *   - Numeric values (including 0 and negatives) produce number tokens.
 *   - The keyword `auto` is skipped.
 *   - Non-numeric garbage (unparseable strings) is skipped.
 *   - Duplicate numeric values deduplicate to a single token.
 *   - Unrelated properties are ignored (property filter).
 */

function makeRecord(
  overrides: Partial<RawStyleRecord> & Pick<RawStyleRecord, 'property' | 'value'>,
): RawStyleRecord {
  return {
    selector: '.element',
    source: 'stylesheet',
    theme: 'light',
    scope: ':root',
    ...overrides,
  };
}

describe('categorizeZIndex — empty input', () => {
  it('returns an empty array for an empty record list', () => {
    expect(categorizeZIndex([])).toEqual([]);
  });
});

describe('categorizeZIndex — property filtering', () => {
  it('ignores records whose property is not z-index', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'color', value: '#000' }),
      makeRecord({ property: 'opacity', value: '0.5' }),
      makeRecord({ property: 'order', value: '10' }),
    ];

    expect(categorizeZIndex(records)).toEqual([]);
  });
});

describe('categorizeZIndex — numeric values', () => {
  it('emits a number token for a positive integer value', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'z-index', value: '100', selector: '.modal' }),
    ];

    const tokens = categorizeZIndex(records);

    expect(tokens).toHaveLength(1);
    const token = tokens[0] as Token;
    expect(token.$type).toBe('number');
    expect(token.$value).toBe(100);
    expect(typeof token.$value).toBe('number');
  });

  it('includes a zero value as a valid number token', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'z-index', value: '0', selector: '.base' }),
    ];

    const tokens = categorizeZIndex(records);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.$value).toBe(0);
    expect(tokens[0]!.$type).toBe('number');
  });

  it('includes a negative integer value as a valid number token', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'z-index', value: '-1', selector: '.behind' }),
    ];

    const tokens = categorizeZIndex(records);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.$value).toBe(-1);
    expect(tokens[0]!.$type).toBe('number');
  });
});

describe('categorizeZIndex — skipped values', () => {
  it('skips the `auto` keyword', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'z-index', value: 'auto' }),
    ];

    expect(categorizeZIndex(records)).toEqual([]);
  });

  it('skips non-numeric garbage values', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'z-index', value: 'foo' }),
      makeRecord({ property: 'z-index', value: '' }),
      makeRecord({ property: 'z-index', value: 'initial' }),
      makeRecord({ property: 'z-index', value: 'inherit' }),
    ];

    expect(categorizeZIndex(records)).toEqual([]);
  });
});

describe('categorizeZIndex — deduplication', () => {
  it('collapses multiple selectors with the same numeric z-index into one token', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'z-index', value: '100', selector: '.modal' }),
      makeRecord({ property: 'z-index', value: '100', selector: '.drawer' }),
      makeRecord({ property: 'z-index', value: '100', selector: '.dialog' }),
    ];

    const tokens = categorizeZIndex(records);

    expect(tokens).toHaveLength(1);
    const token = tokens[0] as Token;
    expect(token.$value).toBe(100);
  });

  it('emits distinct tokens for distinct numeric values', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'z-index', value: '1', selector: '.a' }),
      makeRecord({ property: 'z-index', value: '10', selector: '.b' }),
      makeRecord({ property: 'z-index', value: '100', selector: '.c' }),
    ];

    const tokens = categorizeZIndex(records);

    expect(tokens).toHaveLength(3);
    const values = tokens.map((t) => t.$value).sort((a, b) => (a as number) - (b as number));
    expect(values).toEqual([1, 10, 100]);
  });
});

describe('categorizeZIndex — extensions metadata', () => {
  it('records usage selectors and count on the $extensions payload', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'z-index', value: '100', selector: '.modal' }),
      makeRecord({ property: 'z-index', value: '100', selector: '.drawer' }),
    ];

    const tokens = categorizeZIndex(records);

    expect(tokens).toHaveLength(1);
    const usage = tokens[0]!.$extensions['com.dte.usage'];
    expect(usage.count).toBe(2);
    expect(usage.selectors).toEqual(expect.arrayContaining(['.modal', '.drawer']));
    expect(usage.selectors).toHaveLength(2);
  });

  it('sets confidence to 0 on the $extensions payload (scoring happens later)', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ property: 'z-index', value: '5', selector: '.x' }),
    ];

    const tokens = categorizeZIndex(records);

    expect(tokens[0]!.$extensions['com.dte.confidence']).toBe(0);
  });
});
