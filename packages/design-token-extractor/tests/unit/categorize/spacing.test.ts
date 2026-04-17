import { describe, expect, it } from 'vitest';
import { categorizeSpacing } from '../../../src/categorize/spacing.ts';
import type { RawStyleRecord, Token } from '../../../src/types.ts';

/**
 * Tests for the spacing categorizer.
 *
 * Spec references:
 *   - implementation-plan.md T5.3
 *   - research §3.3 (spacing scale extraction)
 *   - SDD §"Application Data Models" (Token shape, $extensions)
 *
 * Contract:
 *   - Input: RawStyleRecord[] (arbitrary properties, filtered inside).
 *   - Output: Token[] with `$type: 'dimension'`, deduped by canonical value.
 *   - `0px` and `0` normalize to canonical `0` (single form).
 *   - `auto` and `inherit` are skipped.
 *   - Negative values (e.g. `-8px`) are preserved.
 *   - Shorthand strings (e.g. `8px 16px`) are kept verbatim as one token.
 *   - Confidence is initialized to 0 — scoring happens in a later phase.
 */

// Helper to build RawStyleRecord fixtures with sensible defaults.
function record(partial: Partial<RawStyleRecord> & Pick<RawStyleRecord, 'property' | 'value'>): RawStyleRecord {
  return {
    selector: '.button',
    source: 'stylesheet',
    theme: 'light',
    scope: ':root',
    ...partial,
  };
}

describe('categorizeSpacing — input boundaries', () => {
  it('returns [] for an empty input array', () => {
    expect(categorizeSpacing([])).toEqual([]);
  });

  it('ignores records whose property is not a spacing property', () => {
    const records: RawStyleRecord[] = [
      record({ property: 'color', value: '#ff0000' }),
      record({ property: 'background', value: '#fff' }),
      record({ property: 'font-size', value: '16px' }),
    ];

    expect(categorizeSpacing(records)).toEqual([]);
  });
});

describe('categorizeSpacing — spacing property coverage', () => {
  const spacingProperties = [
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
  ];

  it.each(spacingProperties)('accepts %s as a spacing property', (property) => {
    const tokens = categorizeSpacing([record({ property, value: '16px' })]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$value).toBe('16px');
    expect(tokens[0]?.$type).toBe('dimension');
  });
});

describe('categorizeSpacing — value handling', () => {
  it('emits a dimension token for a simple px value', () => {
    const tokens = categorizeSpacing([record({ property: 'padding', value: '16px' })]);

    expect(tokens).toHaveLength(1);
    const [token] = tokens as [Token];
    expect(token.$type).toBe('dimension');
    expect(token.$value).toBe('16px');
  });

  it('normalizes `0px` to canonical `0`', () => {
    const tokens = categorizeSpacing([record({ property: 'margin', value: '0px' })]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$value).toBe('0');
  });

  it('keeps `0` as canonical `0` (no change)', () => {
    const tokens = categorizeSpacing([record({ property: 'margin', value: '0' })]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$value).toBe('0');
  });

  it('collapses `0px` and `0` into a single token (same canonical form)', () => {
    const tokens = categorizeSpacing([
      record({ selector: '.a', property: 'margin', value: '0px' }),
      record({ selector: '.b', property: 'padding', value: '0' }),
    ]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$value).toBe('0');
    expect(tokens[0]?.$extensions['com.dte.usage'].count).toBe(2);
    expect(tokens[0]?.$extensions['com.dte.usage'].selectors).toEqual(
      expect.arrayContaining(['.a', '.b'])
    );
  });

  it('includes negative margins verbatim', () => {
    const tokens = categorizeSpacing([record({ property: 'margin-left', value: '-8px' })]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$value).toBe('-8px');
  });

  it('skips `auto` values', () => {
    const tokens = categorizeSpacing([
      record({ property: 'margin', value: 'auto' }),
      record({ property: 'margin-left', value: 'auto' }),
    ]);

    expect(tokens).toEqual([]);
  });

  it('skips `inherit` values', () => {
    const tokens = categorizeSpacing([record({ property: 'padding', value: 'inherit' })]);

    expect(tokens).toEqual([]);
  });

  it('skips empty string values defensively', () => {
    const tokens = categorizeSpacing([record({ property: 'padding', value: '' })]);

    expect(tokens).toEqual([]);
  });

  it('keeps shorthand strings verbatim as a single token', () => {
    const tokens = categorizeSpacing([record({ property: 'padding', value: '8px 16px' })]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$value).toBe('8px 16px');
  });
});

describe('categorizeSpacing — dedup & extensions', () => {
  it('dedups identical values across multiple selectors into one token', () => {
    const tokens = categorizeSpacing([
      record({ selector: '.a', property: 'padding', value: '16px' }),
      record({ selector: '.b', property: 'margin', value: '16px' }),
      record({ selector: '.c', property: 'gap', value: '16px' }),
    ]);

    expect(tokens).toHaveLength(1);
    const [token] = tokens as [Token];
    expect(token.$value).toBe('16px');
    expect(token.$extensions['com.dte.usage'].count).toBe(3);
    expect(token.$extensions['com.dte.usage'].selectors).toEqual(
      expect.arrayContaining(['.a', '.b', '.c'])
    );
  });

  it('dedups repeated selector+value pairs without dropping the observation count', () => {
    const tokens = categorizeSpacing([
      record({ selector: '.a', property: 'padding', value: '16px' }),
      record({ selector: '.a', property: 'padding', value: '16px' }),
    ]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.$extensions['com.dte.usage'].count).toBe(2);
  });

  it('emits separate tokens for distinct canonical values', () => {
    const tokens = categorizeSpacing([
      record({ selector: '.a', property: 'padding', value: '8px' }),
      record({ selector: '.b', property: 'padding', value: '16px' }),
      record({ selector: '.c', property: 'padding', value: '24px' }),
    ]);

    const values = tokens.map((token) => token.$value).sort();
    expect(values).toEqual(['16px', '24px', '8px']);
  });

  it('initializes confidence at 0 (scoring is a later pipeline stage)', () => {
    const tokens = categorizeSpacing([record({ property: 'padding', value: '16px' })]);

    expect(tokens[0]?.$extensions['com.dte.confidence']).toBe(0);
  });

  it('records source on the emitted token', () => {
    const tokens = categorizeSpacing([
      record({ property: 'padding', value: '16px', source: 'inline' }),
    ]);

    expect(tokens[0]?.$extensions['com.dte.source']).toBe('inline');
  });
});
