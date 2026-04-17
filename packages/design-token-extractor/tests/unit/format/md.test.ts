import { describe, expect, it } from 'vitest';
import { formatMarkdown } from '../../../src/format/md.ts';
import type {
  SubcategoryCollection,
  Token,
  TokenCollection,
  TokenSet,
} from '../../../src/types.ts';

/**
 * T7.4 — Markdown formatter with swatches.
 *
 * Renders a TokenSet as human-readable Markdown documentation:
 * - Top heading `# Design Tokens` + extractedAt timestamp
 * - One `## <Category>` per non-empty flat category (color, spacing, radius, ...)
 * - Typography / motion rendered as `## Typography` with `### <Subcategory>`
 * - Color tokens include inline HTML swatch `<span style="...background:<value>...">`
 * - Table columns: Name | (Swatch for colors) | Value | Count | Confidence
 * - Empty categories are omitted entirely
 */

function makeToken(overrides: Partial<Token> & { $value: Token['$value']; $type: Token['$type'] }): Token {
  const base: Token = {
    $value: overrides.$value,
    $type: overrides.$type,
    $extensions: {
      'com.dte.usage': { selectors: ['.x'], count: 1 },
      'com.dte.confidence': 0.5,
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

describe('formatMarkdown (top-level structure)', () => {
  it('returns a string', () => {
    const result = formatMarkdown(emptyTokenSet());
    expect(typeof result).toBe('string');
  });

  it('starts with `# Design Tokens\\n`', () => {
    const result = formatMarkdown(emptyTokenSet());
    expect(result.startsWith('# Design Tokens\n')).toBe(true);
  });

  it('includes the extractedAt timestamp in the intro', () => {
    const set = emptyTokenSet();
    set.$metadata.extractedAt = '2026-04-17T10:00:00.000Z';
    const result = formatMarkdown(set);
    expect(result).toContain('2026-04-17T10:00:00.000Z');
  });

  it('omits every category section when all categories are empty', () => {
    const result = formatMarkdown(emptyTokenSet());
    expect(result).not.toContain('## Color');
    expect(result).not.toContain('## Typography');
    expect(result).not.toContain('## Spacing');
    expect(result).not.toContain('## Radius');
    expect(result).not.toContain('## Shadow');
    expect(result).not.toContain('## ZIndex');
    expect(result).not.toContain('## Breakpoint');
    expect(result).not.toContain('## Motion');
  });
});

describe('formatMarkdown (color section)', () => {
  it('renders `## Color` heading when colors are present', () => {
    const set = emptyTokenSet();
    const colors: TokenCollection = {
      'color-1': makeToken({ $type: 'color', $value: '#3b82f6' }),
    };
    set.color = colors;
    const result = formatMarkdown(set);
    expect(result).toContain('## Color');
  });

  it('renders each color token as a table row with name, swatch, value, count, confidence', () => {
    const set = emptyTokenSet();
    const colors: TokenCollection = {
      'color-1': makeToken({
        $type: 'color',
        $value: '#3b82f6',
        $extensions: {
          'com.dte.usage': { selectors: ['.btn'], count: 7 },
          'com.dte.confidence': 0.82,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'light',
        },
      }),
    };
    set.color = colors;
    const result = formatMarkdown(set);

    expect(result).toContain('color-1');
    expect(result).toContain('#3b82f6');
    expect(result).toContain('7');
    expect(result).toContain('0.82');
  });

  it('includes an inline HTML swatch with the color value as background for each color token', () => {
    const set = emptyTokenSet();
    const colors: TokenCollection = {
      'color-1': makeToken({ $type: 'color', $value: '#3b82f6' }),
    };
    set.color = colors;
    const result = formatMarkdown(set);

    expect(result).toContain(
      '<span style="display:inline-block;width:16px;height:16px;background:#3b82f6;border:1px solid #ccc;"></span>',
    );
  });

  it('renders the color table header with a Swatch column', () => {
    const set = emptyTokenSet();
    set.color = {
      'color-1': makeToken({ $type: 'color', $value: '#ff0000' }),
    };
    const result = formatMarkdown(set);

    // Expect a well-formed Markdown table header for the color section
    expect(result).toMatch(/\|\s*Name\s*\|\s*Swatch\s*\|\s*Value\s*\|\s*Count\s*\|\s*Confidence\s*\|/);
    // Plus the separator row with at least 5 columns
    expect(result).toMatch(/\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|/);
  });

  it('renders multiple color tokens as separate rows under one `## Color` heading', () => {
    const set = emptyTokenSet();
    set.color = {
      'color-1': makeToken({ $type: 'color', $value: '#ff0000' }),
      'color-2': makeToken({ $type: 'color', $value: '#00ff00' }),
      'color-3': makeToken({ $type: 'color', $value: '#0000ff' }),
    };
    const result = formatMarkdown(set);

    const colorHeadingCount = (result.match(/^## Color$/gm) ?? []).length;
    expect(colorHeadingCount).toBe(1);
    expect(result).toContain('color-1');
    expect(result).toContain('color-2');
    expect(result).toContain('color-3');
    expect(result).toContain('#ff0000');
    expect(result).toContain('#00ff00');
    expect(result).toContain('#0000ff');
  });
});

describe('formatMarkdown (non-color flat category)', () => {
  it('renders `## Spacing` heading with a 4-column table (no swatch) when spacing tokens exist', () => {
    const set = emptyTokenSet();
    set.spacing = {
      'spacing-1': makeToken({
        $type: 'dimension',
        $value: '8px',
        $extensions: {
          'com.dte.usage': { selectors: ['.a'], count: 3 },
          'com.dte.confidence': 0.7,
          'com.dte.source': 'stylesheet',
          'com.dte.theme': 'light',
        },
      }),
    };
    const result = formatMarkdown(set);

    expect(result).toContain('## Spacing');
    // 4-column header: Name | Value | Count | Confidence
    expect(result).toMatch(/\|\s*Name\s*\|\s*Value\s*\|\s*Count\s*\|\s*Confidence\s*\|/);
    expect(result).toContain('spacing-1');
    expect(result).toContain('8px');
    expect(result).toContain('3');
    expect(result).toContain('0.7');
  });

  it('does NOT include a swatch span for non-color tokens', () => {
    const set = emptyTokenSet();
    set.spacing = {
      'spacing-1': makeToken({ $type: 'dimension', $value: '8px' }),
    };
    const result = formatMarkdown(set);

    expect(result).not.toContain('background:8px');
    expect(result).not.toContain('<span style="display:inline-block;width:16px;height:16px;background:8px;');
  });
});

describe('formatMarkdown (typography subcategories)', () => {
  it('renders `## Typography` with `### Family` and `### Size` subsection headings', () => {
    const set = emptyTokenSet();
    const typography: SubcategoryCollection = {
      family: {
        'family-1': makeToken({ $type: 'fontFamily', $value: 'Inter' }),
      },
      size: {
        'size-1': makeToken({ $type: 'dimension', $value: '16px' }),
      },
    };
    set.typography = typography;
    const result = formatMarkdown(set);

    expect(result).toContain('## Typography');
    expect(result).toContain('### Family');
    expect(result).toContain('### Size');
    expect(result).toContain('family-1');
    expect(result).toContain('Inter');
    expect(result).toContain('size-1');
    expect(result).toContain('16px');
  });

  it('omits `## Typography` entirely when every subcategory is empty', () => {
    const set = emptyTokenSet();
    const typography: SubcategoryCollection = {
      family: {},
      size: {},
    };
    set.typography = typography;
    const result = formatMarkdown(set);

    expect(result).not.toContain('## Typography');
    expect(result).not.toContain('### Family');
    expect(result).not.toContain('### Size');
  });

  it('only renders subcategories that have tokens', () => {
    const set = emptyTokenSet();
    const typography: SubcategoryCollection = {
      family: {
        'family-1': makeToken({ $type: 'fontFamily', $value: 'Inter' }),
      },
      size: {},
    };
    set.typography = typography;
    const result = formatMarkdown(set);

    expect(result).toContain('## Typography');
    expect(result).toContain('### Family');
    expect(result).not.toContain('### Size');
  });
});

describe('formatMarkdown (motion subcategories)', () => {
  it('renders `## Motion` with subcategory headings when motion tokens exist', () => {
    const set = emptyTokenSet();
    const motion: SubcategoryCollection = {
      duration: {
        'duration-1': makeToken({ $type: 'duration', $value: '200ms' }),
      },
    };
    set.motion = motion;
    const result = formatMarkdown(set);

    expect(result).toContain('## Motion');
    expect(result).toContain('### Duration');
    expect(result).toContain('duration-1');
    expect(result).toContain('200ms');
  });
});

describe('formatMarkdown (markdown well-formedness)', () => {
  it('produces no malformed table rows (every non-empty pipe line has matching leading/trailing pipes)', () => {
    const set = emptyTokenSet();
    set.color = {
      'color-1': makeToken({ $type: 'color', $value: '#3b82f6' }),
    };
    set.spacing = {
      'spacing-1': makeToken({ $type: 'dimension', $value: '8px' }),
    };
    const result = formatMarkdown(set);

    const lines = result.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|')) {
        expect(trimmed.endsWith('|')).toBe(true);
      }
    }
  });

  it('separates sections with blank lines', () => {
    const set = emptyTokenSet();
    set.color = {
      'color-1': makeToken({ $type: 'color', $value: '#3b82f6' }),
    };
    set.spacing = {
      'spacing-1': makeToken({ $type: 'dimension', $value: '8px' }),
    };
    const result = formatMarkdown(set);

    // Each `##` heading should be preceded by a blank line (except possibly the first)
    const headingMatches = [...result.matchAll(/\n## /g)];
    expect(headingMatches.length).toBeGreaterThan(0);
    for (const match of headingMatches) {
      const idx = match.index ?? 0;
      // The char before the `\n##` should also be `\n` (blank line) OR we're at start
      if (idx > 0) {
        expect(result[idx - 1]).toBe('\n');
      }
    }
  });
});
