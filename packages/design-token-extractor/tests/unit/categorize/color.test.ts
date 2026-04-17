import { describe, expect, it } from 'vitest';
import { categorizeColors } from '../../../src/categorize/color.ts';
import type { RawStyleRecord, Token } from '../../../src/types.ts';

/**
 * Fabricates a minimal RawStyleRecord for tests.
 * Overrides any field via `overrides`.
 */
function makeRecord(overrides: Partial<RawStyleRecord> = {}): RawStyleRecord {
  return {
    selector: '.default',
    property: 'color',
    value: '#000000',
    source: 'stylesheet',
    theme: 'light',
    scope: ':root',
    ...overrides,
  };
}

describe('categorizeColors (empty input)', () => {
  it('returns [] for an empty record list', () => {
    expect(categorizeColors([])).toEqual([]);
  });
});

describe('categorizeColors (basic color extraction)', () => {
  it('emits a single color Token for a `color` record with hex value', () => {
    const records: RawStyleRecord[] = [
      makeRecord({ selector: '.a', property: 'color', value: '#ff0000' }),
    ];

    const tokens = categorizeColors(records);

    expect(tokens).toHaveLength(1);
    const token = tokens[0]!;
    expect(token.$type).toBe('color');
    expect(token.$value).toBe('#ff0000');
  });

  it('attaches $extensions.com.dte.usage with selectors and count', () => {
    const tokens = categorizeColors([
      makeRecord({ selector: '.a', property: 'color', value: '#ff0000' }),
    ]);

    const token = tokens[0]!;
    expect(token.$extensions['com.dte.usage']).toEqual({
      selectors: ['.a'],
      count: 1,
    });
  });

  it('sets com.dte.confidence to 0 (scoring happens later)', () => {
    const tokens = categorizeColors([
      makeRecord({ selector: '.a', property: 'color', value: '#ff0000' }),
    ]);

    expect(tokens[0]!.$extensions['com.dte.confidence']).toBe(0);
  });

  it('propagates source and theme from the first record of each group', () => {
    const tokens = categorizeColors([
      makeRecord({
        selector: '.a',
        property: 'color',
        value: '#ff0000',
        source: 'inline',
        theme: 'dark',
      }),
    ]);

    expect(tokens[0]!.$extensions['com.dte.source']).toBe('inline');
    expect(tokens[0]!.$extensions['com.dte.theme']).toBe('dark');
  });
});

describe('categorizeColors (color normalization)', () => {
  it('expands hex shorthand `#fff` → `#ffffff` (lowercase 6-digit)', () => {
    const tokens = categorizeColors([
      makeRecord({ value: '#fff' }),
    ]);

    expect(tokens[0]!.$value).toBe('#ffffff');
  });

  it('lowercases uppercase hex `#FF0000` → `#ff0000`', () => {
    const tokens = categorizeColors([
      makeRecord({ value: '#FF0000' }),
    ]);

    expect(tokens[0]!.$value).toBe('#ff0000');
  });

  it('converts `rgb(255, 0, 0)` → `#ff0000`', () => {
    const tokens = categorizeColors([
      makeRecord({ value: 'rgb(255, 0, 0)' }),
    ]);

    expect(tokens[0]!.$value).toBe('#ff0000');
  });

  it('converts `rgb(0,128,255)` (no spaces) → `#0080ff`', () => {
    const tokens = categorizeColors([
      makeRecord({ value: 'rgb(0,128,255)' }),
    ]);

    expect(tokens[0]!.$value).toBe('#0080ff');
  });

  it('preserves `rgba(255,0,0,0.5)` as a canonical rgba string', () => {
    const tokens = categorizeColors([
      makeRecord({ value: 'rgba(255,0,0,0.5)' }),
    ]);

    expect(tokens).toHaveLength(1);
    const value = tokens[0]!.$value;
    expect(typeof value).toBe('string');
    // Canonical form must mention the alpha component.
    expect(value as string).toMatch(/0\.5/);
    // Must retain all three color channels in string form.
    expect(value as string).toMatch(/255/);
    expect(value as string).toMatch(/0/);
  });

  it('preserves `hsl(0, 100%, 50%)` as a canonical hsl string', () => {
    const tokens = categorizeColors([
      makeRecord({ value: 'hsl(0, 100%, 50%)' }),
    ]);

    expect(tokens).toHaveLength(1);
    const value = tokens[0]!.$value as string;
    expect(value.startsWith('hsl')).toBe(true);
  });

  it('converts named CSS color `red` → `#ff0000`', () => {
    const tokens = categorizeColors([
      makeRecord({ value: 'red' }),
    ]);

    expect(tokens[0]!.$value).toBe('#ff0000');
  });

  it('converts named CSS color `black` → `#000000`', () => {
    const tokens = categorizeColors([
      makeRecord({ value: 'black' }),
    ]);

    expect(tokens[0]!.$value).toBe('#000000');
  });

  it('converts named CSS color `white` → `#ffffff`', () => {
    const tokens = categorizeColors([
      makeRecord({ value: 'white' }),
    ]);

    expect(tokens[0]!.$value).toBe('#ffffff');
  });
});

describe('categorizeColors (skipped values)', () => {
  it('skips `currentColor`', () => {
    const tokens = categorizeColors([
      makeRecord({ value: 'currentColor' }),
    ]);

    expect(tokens).toEqual([]);
  });

  it('skips `inherit`', () => {
    expect(categorizeColors([makeRecord({ value: 'inherit' })])).toEqual([]);
  });

  it('skips `initial`', () => {
    expect(categorizeColors([makeRecord({ value: 'initial' })])).toEqual([]);
  });

  it('skips `unset`', () => {
    expect(categorizeColors([makeRecord({ value: 'unset' })])).toEqual([]);
  });

  it('skips `transparent`', () => {
    expect(categorizeColors([makeRecord({ value: 'transparent' })])).toEqual([]);
  });
});

describe('categorizeColors (gradients)', () => {
  it('preserves linear-gradient value verbatim with $type=other', () => {
    const gradient = 'linear-gradient(to right, #000, #fff)';
    const tokens = categorizeColors([
      makeRecord({ property: 'background-color', value: gradient }),
    ]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.$value).toBe(gradient);
    expect(tokens[0]!.$type).toBe('other');
  });

  it('preserves radial-gradient value verbatim with $type=other', () => {
    const gradient = 'radial-gradient(circle, #000, #fff)';
    const tokens = categorizeColors([
      makeRecord({ property: 'background-color', value: gradient }),
    ]);

    expect(tokens[0]!.$value).toBe(gradient);
    expect(tokens[0]!.$type).toBe('other');
  });

  it('preserves conic-gradient value verbatim with $type=other', () => {
    const gradient = 'conic-gradient(from 0deg, #000, #fff)';
    const tokens = categorizeColors([
      makeRecord({ property: 'background-color', value: gradient }),
    ]);

    expect(tokens[0]!.$value).toBe(gradient);
    expect(tokens[0]!.$type).toBe('other');
  });
});

describe('categorizeColors (property filtering)', () => {
  it('ignores records whose property is not in the color list', () => {
    const tokens = categorizeColors([
      makeRecord({ property: 'font-size', value: '#ff0000' }),
    ]);

    expect(tokens).toEqual([]);
  });

  it('accepts the full set of color-related properties', () => {
    const properties = [
      'color',
      'background-color',
      'border-color',
      'border-top-color',
      'border-right-color',
      'border-bottom-color',
      'border-left-color',
      'outline-color',
    ];

    const records: RawStyleRecord[] = properties.map((property, i) =>
      makeRecord({ selector: `.s${i}`, property, value: '#123456' }),
    );

    const tokens = categorizeColors(records);

    // All records share the same canonical value → one merged Token.
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.$extensions['com.dte.usage'].count).toBe(properties.length);
  });
});

describe('categorizeColors (merging)', () => {
  it('merges records with the same canonical color into one Token', () => {
    const tokens = categorizeColors([
      makeRecord({ selector: '.a', value: '#ff0000' }),
      makeRecord({ selector: '.b', value: 'rgb(255, 0, 0)' }),
      makeRecord({ selector: '.c', value: 'RED' }),
    ]);

    expect(tokens).toHaveLength(1);
    const usage = tokens[0]!.$extensions['com.dte.usage'];
    expect(usage.count).toBe(3);
    expect(usage.selectors).toEqual(['.a', '.b', '.c']);
  });

  it('emits separate Tokens for distinct canonical values', () => {
    const tokens = categorizeColors([
      makeRecord({ selector: '.a', value: '#ff0000' }),
      makeRecord({ selector: '.b', value: '#00ff00' }),
    ]);

    expect(tokens).toHaveLength(2);
    const byValue = new Map<Token['$value'], Token>(
      tokens.map((t) => [t.$value, t]),
    );
    expect(byValue.get('#ff0000')).toBeDefined();
    expect(byValue.get('#00ff00')).toBeDefined();
  });
});
