import { describe, expect, it } from 'vitest';
import { formatJs } from '../../../src/format/js.ts';
import type {
  SubcategoryCollection,
  Token,
  TokenCollection,
  TokenSet,
} from '../../../src/types.ts';

/**
 * T7.3 — JS (ES module) formatter.
 *
 * The formatter must produce a string that:
 *   - Begins with `export default {`
 *   - Parses as a valid ES module default export (object literal)
 *   - Preserves all 8 top-level TokenSet category keys (even when empty)
 *   - Preserves the exact shape of each token ($value, $type, $extensions, ...)
 *   - Preserves $metadata and $schema
 *
 * Parse strategy: the output is `export default <json>;`. Since JSON is a
 * strict subset of JS object literal syntax, we can evaluate the body after
 * stripping the `export default ` prefix and trailing `;` via `new Function`.
 */

const EXPORT_PREFIX = 'export default ';

function evaluateDefaultExport(output: string): unknown {
  // Require the expected prefix; otherwise evaluation would mask format bugs.
  if (!output.startsWith(EXPORT_PREFIX)) {
    throw new Error(`output does not start with "${EXPORT_PREFIX}"`);
  }
  const trimmed = output.trim();
  const body = trimmed.endsWith(';')
    ? trimmed.slice(EXPORT_PREFIX.length, -1)
    : trimmed.slice(EXPORT_PREFIX.length);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`return (${body});`)();
}

function colorToken(hex: string, count: number): Token {
  return {
    $value: hex,
    $type: 'color',
    $extensions: {
      'com.dte.usage': { selectors: ['.btn'], count },
      'com.dte.confidence': 0.9,
      'com.dte.source': 'stylesheet',
      'com.dte.theme': 'light',
    },
  };
}

function fontFamilyToken(value: string): Token {
  return {
    $value: value,
    $type: 'fontFamily',
    $extensions: {
      'com.dte.usage': { selectors: ['body'], count: 12 },
      'com.dte.confidence': 0.9,
    },
  };
}

function dimensionToken(value: string): Token {
  return {
    $value: value,
    $type: 'dimension',
    $extensions: {
      'com.dte.usage': { selectors: ['h1'], count: 3 },
      'com.dte.confidence': 0.5,
    },
  };
}

function durationToken(ms: number): Token {
  return {
    $value: ms,
    $type: 'duration',
    $extensions: {
      'com.dte.usage': { selectors: ['.fade'], count: 4 },
      'com.dte.confidence': 0.5,
    },
  };
}

function emptyTokenSet(): TokenSet {
  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $metadata: {
      extractor: 'design-token-extractor',
      version: '0.1.0',
      extractedAt: '2026-04-17T10:00:00.000Z',
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

function populatedTokenSet(): TokenSet {
  const set = emptyTokenSet();
  set.color = {
    'color-1': colorToken('#3b82f6', 10),
    'color-2': colorToken('#ef4444', 5),
  };
  const family: TokenCollection = { 'family-1': fontFamilyToken('Inter, sans-serif') };
  const size: TokenCollection = { 'size-1': dimensionToken('16px') };
  const typography: SubcategoryCollection = { family, size };
  set.typography = typography;
  set.spacing = { 'spacing-1': dimensionToken('8px') };
  set.radius = { 'radius-1': dimensionToken('4px') };
  set.zIndex = { 'zindex-1': { ...dimensionToken('10'), $value: 10, $type: 'number' } };
  const duration: TokenCollection = { 'duration-1': durationToken(200) };
  const motion: SubcategoryCollection = { duration };
  set.motion = motion;
  return set;
}

describe('formatJs (return type)', () => {
  it('returns a string', () => {
    expect(typeof formatJs(emptyTokenSet())).toBe('string');
  });
});

describe('formatJs (module shape)', () => {
  it('starts with "export default {"', () => {
    const output = formatJs(emptyTokenSet());
    expect(output.startsWith('export default {')).toBe(true);
  });

  it('produces a syntactically valid ES module default export', () => {
    const output = formatJs(populatedTokenSet());
    // Body must evaluate without throwing (guards against stray syntax).
    expect(() => evaluateDefaultExport(output)).not.toThrow();
  });
});

describe('formatJs (top-level keys)', () => {
  it('includes all 8 category keys plus $schema and $metadata', () => {
    const output = formatJs(emptyTokenSet());
    const parsed = evaluateDefaultExport(output) as Record<string, unknown>;

    expect(Object.keys(parsed).sort()).toEqual(
      [
        '$metadata',
        '$schema',
        'breakpoint',
        'color',
        'motion',
        'radius',
        'shadow',
        'spacing',
        'typography',
        'zIndex',
      ].sort(),
    );
  });

  it('emits empty categories as empty objects, not omitted', () => {
    const output = formatJs(emptyTokenSet());
    const parsed = evaluateDefaultExport(output) as Record<string, unknown>;

    expect(parsed.color).toEqual({});
    expect(parsed.typography).toEqual({});
    expect(parsed.spacing).toEqual({});
    expect(parsed.radius).toEqual({});
    expect(parsed.shadow).toEqual({});
    expect(parsed.zIndex).toEqual({});
    expect(parsed.breakpoint).toEqual({});
    expect(parsed.motion).toEqual({});
  });
});

describe('formatJs (category structures)', () => {
  it('emits color as a flat map of token names to Token objects', () => {
    const output = formatJs(populatedTokenSet());
    const parsed = evaluateDefaultExport(output) as { color: Record<string, Token> };

    expect(Object.keys(parsed.color).sort()).toEqual(['color-1', 'color-2']);
    expect(parsed.color['color-1']!.$value).toBe('#3b82f6');
    expect(parsed.color['color-1']!.$type).toBe('color');
  });

  it('emits typography as a nested subcategory map', () => {
    const output = formatJs(populatedTokenSet());
    const parsed = evaluateDefaultExport(output) as {
      typography: Record<string, Record<string, Token>>;
    };

    expect(Object.keys(parsed.typography).sort()).toEqual(['family', 'size']);
    expect(parsed.typography.family!['family-1']!.$value).toBe(
      'Inter, sans-serif',
    );
    expect(parsed.typography.size!['size-1']!.$value).toBe('16px');
  });

  it('emits motion as a nested subcategory map', () => {
    const output = formatJs(populatedTokenSet());
    const parsed = evaluateDefaultExport(output) as {
      motion: Record<string, Record<string, Token>>;
    };

    expect(Object.keys(parsed.motion)).toEqual(['duration']);
    expect(parsed.motion.duration!['duration-1']!.$value).toBe(200);
  });
});

describe('formatJs ($value types)', () => {
  it('preserves string $value as string', () => {
    const output = formatJs(populatedTokenSet());
    const parsed = evaluateDefaultExport(output) as { color: Record<string, Token> };

    expect(typeof parsed.color['color-1']!.$value).toBe('string');
  });

  it('preserves numeric $value as number', () => {
    const output = formatJs(populatedTokenSet());
    const parsed = evaluateDefaultExport(output) as {
      zIndex: Record<string, Token>;
      motion: Record<string, Record<string, Token>>;
    };

    expect(typeof parsed.zIndex['zindex-1']!.$value).toBe('number');
    expect(parsed.zIndex['zindex-1']!.$value).toBe(10);
    expect(typeof parsed.motion.duration!['duration-1']!.$value).toBe('number');
    expect(parsed.motion.duration!['duration-1']!.$value).toBe(200);
  });
});

describe('formatJs ($metadata preservation)', () => {
  it('preserves $metadata fields including ISO extractedAt', () => {
    const output = formatJs(emptyTokenSet());
    const parsed = evaluateDefaultExport(output) as {
      $metadata: {
        extractor: string;
        version: string;
        extractedAt: string;
        source: { kind: string; value: string };
      };
      $schema: string;
    };

    expect(parsed.$metadata.extractor).toBe('design-token-extractor');
    expect(parsed.$metadata.version).toBe('0.1.0');
    expect(parsed.$metadata.extractedAt).toBe('2026-04-17T10:00:00.000Z');
    expect(parsed.$metadata.source).toEqual({
      kind: 'url',
      value: 'https://example.com',
    });
    expect(parsed.$schema).toBe(
      'https://design-tokens.github.io/community-group/format/',
    );
  });
});
