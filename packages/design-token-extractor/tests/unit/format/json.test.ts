import { describe, expect, it } from 'vitest';
import {
  formatJson,
  tokenSchema,
  tokenSetSchema,
} from '../../../src/format/json.ts';
import type { Token, TokenSet } from '../../../src/types.ts';

/**
 * T7.1 — DTCG JSON formatter + Zod schema.
 *
 * The formatter is the canonical output. It must:
 *   1. Produce valid JSON conforming to the W3C DTCG draft ($schema literal).
 *   2. Always emit the 8 category keys — even when empty — so downstream
 *      consumers can rely on a stable shape.
 *   3. Validate the TokenSet via Zod at the write boundary (ADR-5).
 *
 * Tests are behavioural: we parse the string and assert on the resulting
 * object tree, except for the pretty-print test which asserts on the
 * literal indentation.
 */

function makeToken(overrides: Partial<Token> = {}): Token {
  return {
    $value: '#3b82f6',
    $type: 'color',
    $extensions: {
      'com.dte.usage': { selectors: ['.btn'], count: 3 },
      'com.dte.confidence': 0.5,
      'com.dte.source': 'stylesheet',
      'com.dte.theme': 'light',
      ...(overrides.$extensions ?? {}),
    },
    ...(overrides.$description !== undefined ? { $description: overrides.$description } : {}),
    ...(overrides.$value !== undefined ? { $value: overrides.$value } : {}),
    ...(overrides.$type !== undefined ? { $type: overrides.$type } : {}),
  };
}

function emptyTokenSet(): TokenSet {
  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $metadata: {
      extractor: 'design-token-extractor',
      version: '0.1.0',
      extractedAt: '2026-04-17T12:00:00.000Z',
      source: { kind: 'url', value: 'https://example.com' },
    },
    color: {},
    typography: {},
    spacing: {},
    radius: {},
    shadow: {},
    zIndex: {},
    breakpoint: {},
    motion: {},
  };
}

describe('formatJson (shape)', () => {
  it('returns a string', () => {
    expect(typeof formatJson(emptyTokenSet())).toBe('string');
  });

  it('emits valid JSON (JSON.parse succeeds)', () => {
    const output = formatJson(emptyTokenSet());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('emits the DTCG $schema literal', () => {
    const parsed = JSON.parse(formatJson(emptyTokenSet()));
    expect(parsed.$schema).toBe('https://design-tokens.github.io/community-group/format/');
  });

  it('emits $metadata with extractor, version, extractedAt, source', () => {
    const parsed = JSON.parse(formatJson(emptyTokenSet()));
    expect(parsed.$metadata).toEqual({
      extractor: 'design-token-extractor',
      version: '0.1.0',
      extractedAt: '2026-04-17T12:00:00.000Z',
      source: { kind: 'url', value: 'https://example.com' },
    });
  });

  it('emits all 8 category keys even when empty', () => {
    const parsed = JSON.parse(formatJson(emptyTokenSet()));
    for (const key of [
      'color',
      'typography',
      'spacing',
      'radius',
      'shadow',
      'zIndex',
      'breakpoint',
      'motion',
    ]) {
      expect(parsed).toHaveProperty(key);
    }
  });

  it('treats color/spacing/radius/shadow/zIndex/breakpoint as Record<string, Token>', () => {
    const set = emptyTokenSet();
    set.color['color-1'] = makeToken({ $value: '#ff0000' });
    set.spacing['spacing-1'] = makeToken({ $value: '8px', $type: 'dimension' });
    const parsed = JSON.parse(formatJson(set));
    expect(parsed.color['color-1'].$value).toBe('#ff0000');
    expect(parsed.spacing['spacing-1'].$value).toBe('8px');
  });

  it('treats typography and motion as objects-of-objects (subcategories)', () => {
    const set = emptyTokenSet();
    set.typography['fontFamily'] = {
      'fontFamily-1': makeToken({ $value: 'Inter', $type: 'fontFamily' }),
    };
    set.motion['duration'] = {
      'duration-1': makeToken({ $value: '200ms', $type: 'duration' }),
    };
    const parsed = JSON.parse(formatJson(set));
    expect(parsed.typography.fontFamily['fontFamily-1'].$value).toBe('Inter');
    expect(parsed.motion.duration['duration-1'].$value).toBe('200ms');
  });

  it('emits each token with $value, $type, $extensions (usage + confidence)', () => {
    const set = emptyTokenSet();
    set.color['color-1'] = makeToken({ $value: '#3b82f6' });
    const parsed = JSON.parse(formatJson(set));
    const token = parsed.color['color-1'];
    expect(token.$value).toBe('#3b82f6');
    expect(token.$type).toBe('color');
    expect(token.$extensions['com.dte.usage']).toEqual({
      selectors: ['.btn'],
      count: 3,
    });
    expect(token.$extensions['com.dte.confidence']).toBe(0.5);
  });
});

describe('formatJson (pretty-print)', () => {
  it('uses 2-space indentation', () => {
    const output = formatJson(emptyTokenSet());
    expect(output).toContain('\n  "$schema"');
  });
});

describe('tokenSchema (Zod)', () => {
  it('accepts a valid Token', () => {
    const token: Token = makeToken();
    expect(() => tokenSchema.parse(token)).not.toThrow();
  });

  it('rejects a token missing $type', () => {
    const bad = {
      $value: '#000',
      $extensions: {
        'com.dte.usage': { selectors: [], count: 0 },
        'com.dte.confidence': 0.5,
      },
    };
    expect(() => tokenSchema.parse(bad)).toThrow();
  });

  it('rejects a token missing $extensions.com.dte.usage', () => {
    const bad = {
      $value: '#000',
      $type: 'color',
      $extensions: {
        'com.dte.confidence': 0.5,
      },
    };
    expect(() => tokenSchema.parse(bad)).toThrow();
  });

  it('rejects a token whose confidence is not a number', () => {
    const bad = {
      $value: '#000',
      $type: 'color',
      $extensions: {
        'com.dte.usage': { selectors: [], count: 0 },
        'com.dte.confidence': 'high',
      },
    };
    expect(() => tokenSchema.parse(bad)).toThrow();
  });

  it('rejects a token whose confidence is outside [0, 1]', () => {
    const bad = {
      $value: '#000',
      $type: 'color',
      $extensions: {
        'com.dte.usage': { selectors: [], count: 0 },
        'com.dte.confidence': 1.5,
      },
    };
    expect(() => tokenSchema.parse(bad)).toThrow();
  });

  it('rejects an unknown $type', () => {
    const bad = {
      $value: '#000',
      $type: 'not-a-real-type',
      $extensions: {
        'com.dte.usage': { selectors: [], count: 0 },
        'com.dte.confidence': 0.5,
      },
    };
    expect(() => tokenSchema.parse(bad)).toThrow();
  });
});

describe('tokenSetSchema (Zod)', () => {
  it('accepts a valid empty TokenSet', () => {
    expect(() => tokenSetSchema.parse(emptyTokenSet())).not.toThrow();
  });

  it('accepts a populated TokenSet (round-trip)', () => {
    const set = emptyTokenSet();
    set.color['color-1'] = makeToken({ $value: '#ff0000' });
    set.typography['fontFamily'] = {
      'fontFamily-1': makeToken({ $value: 'Inter', $type: 'fontFamily' }),
    };
    const output = formatJson(set);
    const parsed = JSON.parse(output);
    expect(() => tokenSetSchema.parse(parsed)).not.toThrow();
  });

  it('rejects a TokenSet with the wrong $schema literal', () => {
    const bad = {
      ...emptyTokenSet(),
      $schema: 'https://wrong.example/',
    };
    expect(() => tokenSetSchema.parse(bad)).toThrow();
  });

  it('rejects a TokenSet missing a category key', () => {
    const bad: Record<string, unknown> = { ...emptyTokenSet() };
    delete bad.motion;
    expect(() => tokenSetSchema.parse(bad)).toThrow();
  });

  it('rejects a TokenSet whose extractor metadata is wrong', () => {
    const bad = emptyTokenSet();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bad.$metadata as any).extractor = 'someone-else';
    expect(() => tokenSetSchema.parse(bad)).toThrow();
  });

  it('formatJson throws when given an invalid TokenSet', () => {
    const bad = { notATokenSet: true } as unknown as TokenSet;
    expect(() => formatJson(bad)).toThrow();
  });
});
