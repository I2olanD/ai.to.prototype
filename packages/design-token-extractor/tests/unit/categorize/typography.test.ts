import { describe, expect, it } from 'vitest';
import {
  categorizeTypography,
  type TypographyBuckets,
} from '../../../src/categorize/typography.ts';
import type { RawStyleRecord } from '../../../src/types.ts';

/**
 * Tests for src/categorize/typography.ts (spec 001 T5.2, Research §3.2).
 *
 * Pure function that groups RawStyleRecord items into five typography
 * sub-buckets: family, size, weight, lineHeight, letterSpacing.
 *
 * Each emitted Token has:
 *   - $value: verbatim string for strings; number for numeric font-weight
 *             or unit-less line-height.
 *   - $type:  'fontFamily' | 'dimension' | 'fontWeight' | 'number'
 *   - $extensions['com.dte.usage'] = { selectors: string[], count: number }
 *   - $extensions['com.dte.confidence'] = 0 (scorer runs in Phase 6)
 *
 * Deduplication is within-bucket by $value; selectors from duplicate records
 * accumulate into a single Token.selectors array (count grows accordingly).
 *
 * Unsupported CSS keywords (`normal`, `inherit`, `initial`) are skipped —
 * they carry no design-token information on their own.
 */

const makeRecord = (
  property: string,
  value: string,
  selector = '.x',
): RawStyleRecord => ({
  selector,
  property,
  value,
  source: 'stylesheet',
  theme: 'light',
  scope: ':root',
});

describe('categorizeTypography — empty input', () => {
  it('returns all five buckets empty', () => {
    const result: TypographyBuckets = categorizeTypography([]);
    expect(result).toEqual({
      family: [],
      size: [],
      weight: [],
      lineHeight: [],
      letterSpacing: [],
    });
  });
});

describe('categorizeTypography — font-family', () => {
  it("emits a family token with verbatim $value and $type='fontFamily'", () => {
    const records = [makeRecord('font-family', "'Inter', sans-serif", 'body')];
    const { family } = categorizeTypography(records);
    expect(family).toHaveLength(1);
    expect(family[0].$value).toBe("'Inter', sans-serif");
    expect(family[0].$type).toBe('fontFamily');
    expect(family[0].$extensions['com.dte.usage']).toEqual({
      selectors: ['body'],
      count: 1,
    });
    expect(family[0].$extensions['com.dte.confidence']).toBe(0);
  });
});

describe('categorizeTypography — font-size', () => {
  it("emits a size token with $type='dimension' and preserved unit string", () => {
    const records = [makeRecord('font-size', '16px', '.copy')];
    const { size } = categorizeTypography(records);
    expect(size).toHaveLength(1);
    expect(size[0].$value).toBe('16px');
    expect(size[0].$type).toBe('dimension');
    expect(size[0].$extensions['com.dte.usage']).toEqual({
      selectors: ['.copy'],
      count: 1,
    });
  });

  it('preserves rem/em values verbatim', () => {
    const records = [
      makeRecord('font-size', '1.25rem', '.h2'),
      makeRecord('font-size', '0.875em', '.small'),
    ];
    const { size } = categorizeTypography(records);
    expect(size).toHaveLength(2);
    expect(size.map((t) => t.$value).sort()).toEqual(['0.875em', '1.25rem']);
  });
});

describe('categorizeTypography — font-weight', () => {
  it('emits numeric weight as number with $type=fontWeight', () => {
    const records = [makeRecord('font-weight', '400', 'body')];
    const { weight } = categorizeTypography(records);
    expect(weight).toHaveLength(1);
    expect(weight[0].$value).toBe(400);
    expect(typeof weight[0].$value).toBe('number');
    expect(weight[0].$type).toBe('fontWeight');
  });

  it("emits non-numeric weight as string with $type='fontWeight'", () => {
    const records = [makeRecord('font-weight', 'bold', 'strong')];
    const { weight } = categorizeTypography(records);
    expect(weight).toHaveLength(1);
    expect(weight[0].$value).toBe('bold');
    expect(typeof weight[0].$value).toBe('string');
    expect(weight[0].$type).toBe('fontWeight');
  });
});

describe('categorizeTypography — line-height', () => {
  it("emits unit-less line-height as number with $type='number'", () => {
    const records = [makeRecord('line-height', '1.5', 'body')];
    const { lineHeight } = categorizeTypography(records);
    expect(lineHeight).toHaveLength(1);
    expect(lineHeight[0].$value).toBe(1.5);
    expect(typeof lineHeight[0].$value).toBe('number');
    expect(lineHeight[0].$type).toBe('number');
  });

  it("emits px line-height as string with $type='dimension'", () => {
    const records = [makeRecord('line-height', '24px', 'h1')];
    const { lineHeight } = categorizeTypography(records);
    expect(lineHeight).toHaveLength(1);
    expect(lineHeight[0].$value).toBe('24px');
    expect(typeof lineHeight[0].$value).toBe('string');
    expect(lineHeight[0].$type).toBe('dimension');
  });
});

describe('categorizeTypography — letter-spacing', () => {
  it("emits letter-spacing into its own bucket with $type='dimension'", () => {
    const records = [makeRecord('letter-spacing', '0.05em', '.caps')];
    const { letterSpacing } = categorizeTypography(records);
    expect(letterSpacing).toHaveLength(1);
    expect(letterSpacing[0].$value).toBe('0.05em');
    expect(letterSpacing[0].$type).toBe('dimension');
    expect(letterSpacing[0].$extensions['com.dte.usage'].selectors).toEqual([
      '.caps',
    ]);
  });
});

describe('categorizeTypography — deduplication within bucket', () => {
  it('accumulates selectors for identical values across records', () => {
    const records = [
      makeRecord('font-size', '16px', 'body'),
      makeRecord('font-size', '16px', 'p'),
      makeRecord('font-size', '16px', '.copy'),
    ];
    const { size } = categorizeTypography(records);
    expect(size).toHaveLength(1);
    expect(size[0].$value).toBe('16px');
    expect(size[0].$extensions['com.dte.usage']).toEqual({
      selectors: ['body', 'p', '.copy'],
      count: 3,
    });
  });

  it('deduplicates across font-weight with distinct numeric vs string values', () => {
    const records = [
      makeRecord('font-weight', '400', 'body'),
      makeRecord('font-weight', '400', 'p'),
      makeRecord('font-weight', 'bold', 'strong'),
    ];
    const { weight } = categorizeTypography(records);
    expect(weight).toHaveLength(2);
    const numeric = weight.find((t) => t.$value === 400);
    const bold = weight.find((t) => t.$value === 'bold');
    expect(numeric?.$extensions['com.dte.usage'].count).toBe(2);
    expect(numeric?.$extensions['com.dte.usage'].selectors).toEqual([
      'body',
      'p',
    ]);
    expect(bold?.$extensions['com.dte.usage'].count).toBe(1);
  });

  it('does not merge the same numeric value across different buckets', () => {
    // line-height 1.5 and a (fictional) font-weight 1.5 would not collide —
    // buckets are keyed by property, not by value alone.
    const records = [
      makeRecord('line-height', '1.5', 'body'),
      makeRecord('line-height', '1.5', 'p'),
    ];
    const { lineHeight, weight } = categorizeTypography(records);
    expect(weight).toEqual([]);
    expect(lineHeight).toHaveLength(1);
    expect(lineHeight[0].$extensions['com.dte.usage'].count).toBe(2);
  });
});

describe('categorizeTypography — ignored inputs', () => {
  it('ignores unrelated properties like color or margin', () => {
    const records = [
      makeRecord('color', '#fff', 'body'),
      makeRecord('margin', '8px', 'body'),
      makeRecord('font-size', '16px', 'body'),
    ];
    const result = categorizeTypography(records);
    expect(result.family).toEqual([]);
    expect(result.size).toHaveLength(1);
    expect(result.weight).toEqual([]);
    expect(result.lineHeight).toEqual([]);
    expect(result.letterSpacing).toEqual([]);
  });

  it('skips keyword values normal, inherit, initial', () => {
    const records = [
      makeRecord('line-height', 'normal', 'body'),
      makeRecord('font-weight', 'inherit', 'strong'),
      makeRecord('letter-spacing', 'initial', '.caps'),
      makeRecord('font-family', 'inherit', '.x'),
      makeRecord('font-size', 'inherit', '.y'),
    ];
    const result = categorizeTypography(records);
    expect(result).toEqual({
      family: [],
      size: [],
      weight: [],
      lineHeight: [],
      letterSpacing: [],
    });
  });
});

describe('categorizeTypography — extensions carry optional metadata', () => {
  it("propagates 'com.dte.source' and 'com.dte.theme' from the first observation", () => {
    const record: RawStyleRecord = {
      selector: 'body',
      property: 'font-size',
      value: '16px',
      source: 'inline',
      theme: 'dark',
      scope: ':root',
    };
    const { size } = categorizeTypography([record]);
    expect(size[0].$extensions['com.dte.source']).toBe('inline');
    expect(size[0].$extensions['com.dte.theme']).toBe('dark');
  });
});
