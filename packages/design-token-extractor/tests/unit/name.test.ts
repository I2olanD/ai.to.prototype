import { describe, expect, it } from 'vitest';
import { nameBucket, nameSubcategory } from '../../src/name.ts';
import type { Token } from '../../src/types.ts';

/**
 * T6.3 — Value-indexed namer.
 *
 * Per ADR-3 + SDD §"Deterministic naming", tokens are assigned names of
 * the form `${prefix}-${i+1}` ordered by usage count DESC, with a
 * deterministic tie-break on `String($value)` ASC (lexicographic).
 *
 * `nameBucket` handles a flat Token[] for one category.
 * `nameSubcategory` composes `nameBucket` across sub-keys (e.g. typography
 *   → `{ family, size, ... }`) using a prefix template.
 */

function makeToken(
  value: Token['$value'],
  count: number,
): Token {
  return {
    $value: value,
    $type: 'color',
    $extensions: {
      'com.dte.usage': { selectors: [`.s-${count}`], count },
      'com.dte.confidence': 0,
      'com.dte.source': 'stylesheet',
      'com.dte.theme': 'light',
    },
  };
}

describe('nameBucket (empty input)', () => {
  it('returns an empty record for an empty token list', () => {
    expect(nameBucket([], 'color')).toEqual({});
  });
});

describe('nameBucket (orders DESC by count)', () => {
  it('names 3 tokens with distinct counts color-1, color-2, color-3 DESC', () => {
    const tokens: Token[] = [
      makeToken('#aaaaaa', 2),
      makeToken('#bbbbbb', 10),
      makeToken('#cccccc', 5),
    ];

    const result = nameBucket(tokens, 'color');

    expect(Object.keys(result)).toEqual(['color-1', 'color-2', 'color-3']);
    expect(result['color-1']!.$value).toBe('#bbbbbb');
    expect(result['color-2']!.$value).toBe('#cccccc');
    expect(result['color-3']!.$value).toBe('#aaaaaa');
  });

  it('uses 1-based indexing with the provided prefix', () => {
    const tokens: Token[] = [
      makeToken('16px', 3),
      makeToken('8px', 1),
    ];

    const result = nameBucket(tokens, 'spacing');

    expect(Object.keys(result)).toEqual(['spacing-1', 'spacing-2']);
  });
});

describe('nameBucket (deterministic tie-break)', () => {
  it('breaks ties on count by String($value) ASC', () => {
    const tokens: Token[] = [
      makeToken('#ff0000', 5),
      makeToken('#00ff00', 5),
      makeToken('#0000ff', 5),
    ];

    const result = nameBucket(tokens, 'color');

    // All tied on count=5 — ASC lex: #0000ff, #00ff00, #ff0000
    expect(result['color-1']!.$value).toBe('#0000ff');
    expect(result['color-2']!.$value).toBe('#00ff00');
    expect(result['color-3']!.$value).toBe('#ff0000');
  });

  it('produces identical output when called twice with the same input (reproducibility)', () => {
    const tokens: Token[] = [
      makeToken('#abcdef', 5),
      makeToken('#123456', 5),
      makeToken('#000000', 5),
      makeToken('#ffffff', 10),
    ];

    const first = nameBucket(tokens, 'color');
    const second = nameBucket(tokens, 'color');

    expect(Object.keys(first)).toEqual(Object.keys(second));
    for (const key of Object.keys(first)) {
      expect(first[key]).toEqual(second[key]);
    }
  });

  it('stringifies numeric $value for tie-break comparison', () => {
    const tokens: Token[] = [
      makeToken(200, 5),
      makeToken(100, 5),
    ];

    const result = nameBucket(tokens, 'z');

    // "100" < "200" lex, so 100 first
    expect(result['z-1']!.$value).toBe(100);
    expect(result['z-2']!.$value).toBe(200);
  });
});

describe('nameSubcategory', () => {
  it('returns {} for an empty buckets record', () => {
    expect(nameSubcategory({}, (k) => `font-${k}`)).toEqual({});
  });

  it('names each sub-bucket using the prefix template', () => {
    const buckets: Record<string, Token[]> = {
      family: [makeToken('Inter', 3), makeToken('Roboto', 7)],
      size: [makeToken('16px', 5)],
    };

    const result = nameSubcategory(buckets, (subkey) => `font-${subkey}`);

    expect(Object.keys(result).sort()).toEqual(['family', 'size']);
    expect(Object.keys(result['family']!)).toEqual([
      'font-family-1',
      'font-family-2',
    ]);
    expect(result['family']!['font-family-1']!.$value).toBe('Roboto');
    expect(result['family']!['font-family-2']!.$value).toBe('Inter');
    expect(Object.keys(result['size']!)).toEqual(['font-size-1']);
  });

  it('handles sub-buckets with empty token arrays by emitting an empty record for that key', () => {
    const buckets: Record<string, Token[]> = {
      family: [],
      size: [makeToken('12px', 1)],
    };

    const result = nameSubcategory(buckets, (subkey) => `font-${subkey}`);

    expect(result['family']).toEqual({});
    expect(Object.keys(result['size']!)).toEqual(['font-size-1']);
  });
});
