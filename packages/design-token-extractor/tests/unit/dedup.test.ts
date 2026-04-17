import { describe, expect, it } from 'vitest';
import { dedupTokens } from '../../src/dedup.ts';
import type { Token } from '../../src/types.ts';

/**
 * T6.1 — Cross-cutting deduplicator.
 *
 * Categorizers already dedupe within their own category. This pass merges
 * tokens across categorizers when they share ($type, $value, theme), sums
 * usage counts, unions selectors (first-seen order), and applies the
 * stylesheet > inline tie-break on the primary `com.dte.source` tag
 * (SDD §"Inline style weighting"). Tokens with different $type or
 * different com.dte.theme are never merged.
 */

function makeToken(overrides: Partial<Token> & { $value: Token['$value']; $type: Token['$type'] }): Token {
  const base: Token = {
    $value: overrides.$value,
    $type: overrides.$type,
    $extensions: {
      'com.dte.usage': { selectors: ['.x'], count: 1 },
      'com.dte.confidence': 0,
      'com.dte.source': 'stylesheet',
      'com.dte.theme': 'light',
    },
  };
  return {
    ...base,
    ...overrides,
    $extensions: {
      ...base.$extensions,
      ...(overrides.$extensions ?? {}),
    },
  };
}

describe('dedupTokens (empty input)', () => {
  it('returns [] for an empty token list', () => {
    expect(dedupTokens([])).toEqual([]);
  });
});

describe('dedupTokens (distinct tokens preserved)', () => {
  it('keeps tokens with different $value untouched', () => {
    const tokens: Token[] = [
      makeToken({ $type: 'color', $value: '#ff0000' }),
      makeToken({ $type: 'color', $value: '#00ff00' }),
    ];

    const result = dedupTokens(tokens);

    expect(result).toHaveLength(2);
    expect(result[0]!.$value).toBe('#ff0000');
    expect(result[1]!.$value).toBe('#00ff00');
  });

  it('keeps tokens with same $value but different $type separate', () => {
    const tokens: Token[] = [
      makeToken({ $type: 'color', $value: '#000000' }),
      makeToken({ $type: 'other', $value: '#000000' }),
    ];

    const result = dedupTokens(tokens);

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.$type).sort()).toEqual(['color', 'other']);
  });

  it('keeps tokens with same ($type, $value) but different theme separate', () => {
    const tokens: Token[] = [
      makeToken({
        $type: 'color',
        $value: '#ffffff',
        $extensions: {
          'com.dte.usage': { selectors: ['.light'], count: 1 },
          'com.dte.confidence': 0,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'light',
        },
      }),
      makeToken({
        $type: 'color',
        $value: '#ffffff',
        $extensions: {
          'com.dte.usage': { selectors: ['.dark'], count: 1 },
          'com.dte.confidence': 0,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'dark',
        },
      }),
    ];

    const result = dedupTokens(tokens);

    expect(result).toHaveLength(2);
    expect(result[0]!.$extensions['com.dte.theme']).toBe('light');
    expect(result[1]!.$extensions['com.dte.theme']).toBe('dark');
  });
});

describe('dedupTokens (merging identical tokens)', () => {
  it('merges two tokens with same $type/$value/theme into one', () => {
    const tokens: Token[] = [
      makeToken({
        $type: 'color',
        $value: '#ff0000',
        $extensions: {
          'com.dte.usage': { selectors: ['.a'], count: 2 },
          'com.dte.confidence': 0,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'light',
        },
      }),
      makeToken({
        $type: 'color',
        $value: '#ff0000',
        $extensions: {
          'com.dte.usage': { selectors: ['.b'], count: 3 },
          'com.dte.confidence': 0,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'light',
        },
      }),
    ];

    const result = dedupTokens(tokens);

    expect(result).toHaveLength(1);
    expect(result[0]!.$extensions['com.dte.usage'].count).toBe(5);
    expect(result[0]!.$extensions['com.dte.usage'].selectors).toEqual(['.a', '.b']);
  });

  it('unions selectors while preserving first-seen order and deduping', () => {
    const tokens: Token[] = [
      makeToken({
        $type: 'color',
        $value: '#00ff00',
        $extensions: {
          'com.dte.usage': { selectors: ['.a', '.b'], count: 2 },
          'com.dte.confidence': 0,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'light',
        },
      }),
      makeToken({
        $type: 'color',
        $value: '#00ff00',
        $extensions: {
          'com.dte.usage': { selectors: ['.b', '.c'], count: 2 },
          'com.dte.confidence': 0,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'light',
        },
      }),
    ];

    const result = dedupTokens(tokens);

    expect(result).toHaveLength(1);
    expect(result[0]!.$extensions['com.dte.usage'].selectors).toEqual(['.a', '.b', '.c']);
    expect(result[0]!.$extensions['com.dte.usage'].count).toBe(4);
  });
});

describe('dedupTokens (stylesheet-over-inline tie-break)', () => {
  it('picks stylesheet as primary source when merging stylesheet + inline', () => {
    const tokens: Token[] = [
      makeToken({
        $type: 'color',
        $value: '#abcdef',
        $extensions: {
          'com.dte.usage': { selectors: ['.inline'], count: 1 },
          'com.dte.confidence': 0,
          'com.dte.source': 'inline',
          'com.dte.theme': 'light',
        },
      }),
      makeToken({
        $type: 'color',
        $value: '#abcdef',
        $extensions: {
          'com.dte.usage': { selectors: ['.sheet'], count: 1 },
          'com.dte.confidence': 0,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'light',
        },
      }),
    ];

    const result = dedupTokens(tokens);

    expect(result).toHaveLength(1);
    expect(result[0]!.$extensions['com.dte.source']).toBe('stylesheet');
  });

  it('preserves inline source when all merged tokens are inline', () => {
    const tokens: Token[] = [
      makeToken({
        $type: 'color',
        $value: '#aaaaaa',
        $extensions: {
          'com.dte.usage': { selectors: ['.a'], count: 1 },
          'com.dte.confidence': 0,
          'com.dte.source': 'inline',
          'com.dte.theme': 'light',
        },
      }),
      makeToken({
        $type: 'color',
        $value: '#aaaaaa',
        $extensions: {
          'com.dte.usage': { selectors: ['.b'], count: 1 },
          'com.dte.confidence': 0,
          'com.dte.source': 'inline',
          'com.dte.theme': 'light',
        },
      }),
    ];

    const result = dedupTokens(tokens);

    expect(result).toHaveLength(1);
    expect(result[0]!.$extensions['com.dte.source']).toBe('inline');
  });

  it('does NOT double-count usage when merging stylesheet + inline (selectors are just concatenated)', () => {
    const tokens: Token[] = [
      makeToken({
        $type: 'color',
        $value: '#123456',
        $extensions: {
          'com.dte.usage': { selectors: ['.inline'], count: 1 },
          'com.dte.confidence': 0,
          'com.dte.source': 'inline',
          'com.dte.theme': 'light',
        },
      }),
      makeToken({
        $type: 'color',
        $value: '#123456',
        $extensions: {
          'com.dte.usage': { selectors: ['.sheet'], count: 1 },
          'com.dte.confidence': 0,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'light',
        },
      }),
    ];

    const result = dedupTokens(tokens);

    expect(result[0]!.$extensions['com.dte.usage'].count).toBe(2);
  });
});

describe('dedupTokens (output order)', () => {
  it('returns deduped tokens in first-seen order', () => {
    const tokens: Token[] = [
      makeToken({ $type: 'color', $value: '#ff0000' }),
      makeToken({ $type: 'color', $value: '#00ff00' }),
      makeToken({ $type: 'color', $value: '#ff0000' }),
      makeToken({ $type: 'color', $value: '#0000ff' }),
    ];

    const result = dedupTokens(tokens);

    expect(result.map((t) => t.$value)).toEqual(['#ff0000', '#00ff00', '#0000ff']);
  });
});
