import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { formatCss } from '../../../src/format/css.ts';
import type {
  SubcategoryCollection,
  ThemeTag,
  Token,
  TokenCollection,
  TokenSet,
} from '../../../src/types.ts';

/**
 * T7.2 — CSS custom properties formatter.
 *
 * Emits a `:root { ... }` block for light-theme tokens and a
 * `@media (prefers-color-scheme: dark) { :root { ... } }` block for
 * dark-theme tokens (detected via $extensions['com.dte.theme'] === 'dark').
 * Each non-empty category is grouped under a comment header; empty
 * categories are omitted entirely. Output must be parseable by postcss.
 */

function makeToken(
  value: string,
  theme: ThemeTag = 'light',
  type: Token['$type'] = 'color',
): Token {
  return {
    $value: value,
    $type: type,
    $extensions: {
      'com.dte.usage': { selectors: ['.x'], count: 1 },
      'com.dte.confidence': 0.5,
      'com.dte.source': 'stylesheet',
      'com.dte.theme': theme,
    },
  };
}

function emptyTokenSet(): TokenSet {
  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $metadata: {
      extractor: 'design-token-extractor',
      version: '0.1.0',
      extractedAt: '2026-04-17T00:00:00.000Z',
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

describe('formatCss (basic shape)', () => {
  it('returns a string', () => {
    const result = formatCss(emptyTokenSet());
    expect(typeof result).toBe('string');
  });

  it('starts with :root { and ends with }', () => {
    const set = emptyTokenSet();
    set.color = {
      'color-1': makeToken('#3b82f6'),
    } satisfies TokenCollection;

    const result = formatCss(set);
    expect(result.startsWith(':root {')).toBe(true);
    expect(result.trimEnd().endsWith('}')).toBe(true);
  });

  it('produces postcss-parseable output for an empty TokenSet', () => {
    const result = formatCss(emptyTokenSet());
    expect(() => postcss.parse(result)).not.toThrow();
  });
});

describe('formatCss (flat categories)', () => {
  it('emits each color token as --<name>: <value>; inside :root', () => {
    const set = emptyTokenSet();
    set.color = {
      'color-1': makeToken('#3b82f6'),
      'color-2': makeToken('#ef4444'),
    };

    const result = formatCss(set);
    expect(result).toContain('--color-1: #3b82f6;');
    expect(result).toContain('--color-2: #ef4444;');
    // Both declarations live inside the :root block.
    const rootMatch = result.match(/:root\s*\{([\s\S]*?)\n\}/);
    expect(rootMatch).not.toBeNull();
    expect(rootMatch![1]).toContain('--color-1: #3b82f6;');
    expect(rootMatch![1]).toContain('--color-2: #ef4444;');
  });

  it('emits a comment header for each non-empty category', () => {
    const set = emptyTokenSet();
    set.color = { 'color-1': makeToken('#3b82f6') };
    set.spacing = { 'spacing-1': makeToken('8px', 'light', 'dimension') };

    const result = formatCss(set);
    expect(result).toContain('/* ==== color ==== */');
    expect(result).toContain('/* ==== spacing ==== */');
  });

  it('omits sections for empty categories', () => {
    const set = emptyTokenSet();
    set.color = { 'color-1': makeToken('#3b82f6') };

    const result = formatCss(set);
    expect(result).toContain('/* ==== color ==== */');
    expect(result).not.toContain('/* ==== spacing ==== */');
    expect(result).not.toContain('/* ==== radius ==== */');
    expect(result).not.toContain('/* ==== shadow ==== */');
    expect(result).not.toContain('/* ==== zIndex ==== */');
    expect(result).not.toContain('/* ==== breakpoint ==== */');
    expect(result).not.toContain('/* ==== typography ==== */');
    expect(result).not.toContain('/* ==== motion ==== */');
  });
});

describe('formatCss (subcategory flattening)', () => {
  it('flattens typography subcategories using the token key verbatim', () => {
    const set = emptyTokenSet();
    set.typography = {
      family: {
        'font-family-1': makeToken('Inter', 'light', 'fontFamily'),
      },
      size: {
        'font-size-1': makeToken('16px', 'light', 'dimension'),
      },
    } satisfies SubcategoryCollection;

    const result = formatCss(set);
    expect(result).toContain('--font-family-1: Inter;');
    expect(result).toContain('--font-size-1: 16px;');
    expect(result).toContain('/* ==== typography ==== */');
  });

  it('flattens motion subcategories using the token key verbatim', () => {
    const set = emptyTokenSet();
    set.motion = {
      duration: {
        'duration-1': makeToken('200ms', 'light', 'duration'),
      },
      easing: {
        'easing-1': makeToken(
          'cubic-bezier(0.4, 0, 0.2, 1)',
          'light',
          'cubicBezier',
        ),
      },
    } satisfies SubcategoryCollection;

    const result = formatCss(set);
    expect(result).toContain('--duration-1: 200ms;');
    expect(result).toContain('--easing-1: cubic-bezier(0.4, 0, 0.2, 1);');
    expect(result).toContain('/* ==== motion ==== */');
  });
});

describe('formatCss (dark theme)', () => {
  it('emits dark-theme tokens under @media (prefers-color-scheme: dark)', () => {
    const set = emptyTokenSet();
    set.color = {
      'color-1': makeToken('#ffffff', 'light'),
      'color-2': makeToken('#000000', 'dark'),
    };

    const result = formatCss(set);
    expect(result).toContain('@media (prefers-color-scheme: dark)');
    // Light token is in the top-level :root block, not the dark one.
    const rootMatch = result.match(/^:root\s*\{([\s\S]*?)\n\}/);
    expect(rootMatch).not.toBeNull();
    expect(rootMatch![1]).toContain('--color-1: #ffffff;');
    expect(rootMatch![1]).not.toContain('--color-2: #000000;');

    const darkMatch = result.match(
      /@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\n\s*\}\s*\}/,
    );
    expect(darkMatch).not.toBeNull();
    expect(darkMatch![1]).toContain('--color-2: #000000;');
    expect(darkMatch![1]).not.toContain('--color-1: #ffffff;');
  });

  it('omits the @media block when no dark tokens are present', () => {
    const set = emptyTokenSet();
    set.color = { 'color-1': makeToken('#3b82f6', 'light') };

    const result = formatCss(set);
    expect(result).not.toContain('@media');
  });

  it('handles a TokenSet with only dark tokens (light :root still emitted, dark media block present)', () => {
    const set = emptyTokenSet();
    set.color = { 'color-1': makeToken('#000000', 'dark') };

    const result = formatCss(set);
    expect(result.startsWith(':root {')).toBe(true);
    expect(result).toContain('@media (prefers-color-scheme: dark)');
    expect(result).toContain('--color-1: #000000;');
  });

  it('splits subcategory tokens by theme', () => {
    const set = emptyTokenSet();
    set.typography = {
      family: {
        'font-family-1': makeToken('Inter', 'light', 'fontFamily'),
        'font-family-2': makeToken('Georgia', 'dark', 'fontFamily'),
      },
    };

    const result = formatCss(set);
    const rootMatch = result.match(/^:root\s*\{([\s\S]*?)\n\}/);
    expect(rootMatch).not.toBeNull();
    expect(rootMatch![1]).toContain('--font-family-1: Inter;');
    expect(rootMatch![1]).not.toContain('--font-family-2: Georgia;');

    const darkMatch = result.match(
      /@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\n\s*\}\s*\}/,
    );
    expect(darkMatch).not.toBeNull();
    expect(darkMatch![1]).toContain('--font-family-2: Georgia;');
  });
});

describe('formatCss (valid CSS)', () => {
  it('produces postcss-parseable output for a complex TokenSet', () => {
    const set = emptyTokenSet();
    set.color = {
      'color-1': makeToken('#3b82f6', 'light'),
      'color-2': makeToken('#0f172a', 'dark'),
    };
    set.spacing = {
      'spacing-1': makeToken('8px', 'light', 'dimension'),
    };
    set.typography = {
      family: { 'font-family-1': makeToken('Inter', 'light', 'fontFamily') },
      size: { 'font-size-1': makeToken('16px', 'light', 'dimension') },
    };
    set.motion = {
      duration: { 'duration-1': makeToken('200ms', 'light', 'duration') },
      easing: {
        'easing-1': makeToken(
          'cubic-bezier(0.4, 0, 0.2, 1)',
          'dark',
          'cubicBezier',
        ),
      },
    };

    const result = formatCss(set);
    const root = postcss.parse(result);
    // postcss.parse throws on invalid CSS, so reaching here means it parsed.
    expect(root).toBeDefined();
    // Sanity: at least one rule with selector ':root' exists.
    const selectors: string[] = [];
    root.walkRules((rule) => {
      selectors.push(rule.selector);
    });
    expect(selectors).toContain(':root');
  });
});
