import { describe, expect, it } from 'vitest';
import { categorizeBreakpoints } from '../../../src/categorize/breakpoint.ts';

/**
 * Breakpoint categorizer extracts dimension tokens from `@media` rules.
 *
 * Per T5.7 and research §3.7, the input is raw stylesheet text (not the
 * computed RawStyleRecord[] used by other categorizers) because media
 * queries only survive in the raw CSS — computed styles collapse them.
 *
 * Behavior:
 *   - Parses `@media (min-width: Xpx)` and `(max-width: Xpx)` features.
 *   - Orientation queries (`portrait` / `landscape`) are NOT breakpoints.
 *   - Other `@media` features (e.g. `prefers-color-scheme`) are ignored.
 *   - Values are deduplicated by literal string; count = number of @media
 *     occurrences (across all stylesheets) that reference that value.
 *   - $extensions.'com.dte.usage'.selectors is `[]` (media queries have
 *     no element selector at the token level).
 */
describe('categorizeBreakpoints', () => {
  it('returns an empty array for an empty stylesheets list', () => {
    expect(categorizeBreakpoints([])).toEqual([]);
  });

  it('returns an empty array when no stylesheet contains @media rules', () => {
    const css = '.button { color: red; } .link { color: blue; }';
    expect(categorizeBreakpoints([css])).toEqual([]);
  });

  it('extracts a single min-width breakpoint with count 1', () => {
    const css = '@media (min-width: 640px) { .x { color: red } }';
    const tokens = categorizeBreakpoints([css]);

    expect(tokens).toHaveLength(1);
    const [token] = tokens;
    expect(token.$type).toBe('dimension');
    expect(token.$value).toBe('640px');
    expect(token.$extensions['com.dte.usage'].count).toBe(1);
    expect(token.$extensions['com.dte.usage'].selectors).toEqual([]);
  });

  it('extracts a single max-width breakpoint', () => {
    const css = '@media (max-width: 1024px) { .y { color: blue } }';
    const tokens = categorizeBreakpoints([css]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].$value).toBe('1024px');
    expect(tokens[0].$type).toBe('dimension');
  });

  it('deduplicates identical breakpoints across multiple stylesheets and counts occurrences', () => {
    const sheets = [
      '@media (min-width: 640px) { .a {} }',
      '@media (min-width: 768px) { .b {} }',
      '@media (min-width: 640px) { .c {} }',
    ];
    const tokens = categorizeBreakpoints(sheets);

    expect(tokens).toHaveLength(2);

    const byValue = new Map(tokens.map((t) => [t.$value as string, t]));
    expect(byValue.get('640px')?.$extensions['com.dte.usage'].count).toBe(2);
    expect(byValue.get('768px')?.$extensions['com.dte.usage'].count).toBe(1);
  });

  it('skips orientation queries (not treated as breakpoints)', () => {
    const css = '@media (orientation: portrait) { .x { color: red } }';
    expect(categorizeBreakpoints([css])).toEqual([]);
  });

  it('emits both min-width and max-width values from a combined query', () => {
    const css = '@media (min-width: 640px) and (max-width: 1024px) { .x {} }';
    const tokens = categorizeBreakpoints([css]);

    const values = tokens.map((t) => t.$value).sort();
    expect(values).toEqual(['1024px', '640px']);
  });

  it('ignores unrelated @media features like prefers-color-scheme', () => {
    const css = '@media (prefers-color-scheme: dark) { :root { color: white } }';
    expect(categorizeBreakpoints([css])).toEqual([]);
  });

  it('includes non-px width units (em, rem) as-is', () => {
    const css = '@media (min-width: 40em) { .x {} }';
    const tokens = categorizeBreakpoints([css]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].$value).toBe('40em');
  });

  it('tolerates whitespace variations around the feature value', () => {
    const css = '@media (min-width:  640px  ) { .x {} }';
    const tokens = categorizeBreakpoints([css]);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].$value).toBe('640px');
  });

  it('populates required TokenExtensions fields', () => {
    const css = '@media (min-width: 640px) { .x {} }';
    const [token] = categorizeBreakpoints([css]);

    expect(token.$extensions).toMatchObject({
      'com.dte.usage': { selectors: [], count: 1 },
    });
  });
});
