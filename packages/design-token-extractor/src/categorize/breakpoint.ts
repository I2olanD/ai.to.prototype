// Breakpoint categorizer — extracts dimension tokens from `@media` rules.
//
// Unlike other categorizers which consume `RawStyleRecord[]` (computed
// style snapshots), breakpoints live in `@media` rules that only survive
// in the raw stylesheet text. This categorizer therefore accepts raw CSS
// strings and walks them with postcss to find `@media` atrules.
//
// Per T5.7 / research §3.7:
//   - Emit one dimension token per unique `min-width` / `max-width` value.
//   - Dedup by literal value string (e.g. '640px'); count = occurrence count
//     across all supplied stylesheets.
//   - Orientation queries and other media features (prefers-color-scheme,
//     resolution, etc.) are NOT breakpoints and are skipped.
//   - Combined queries like `(min-width: 640px) and (max-width: 1024px)`
//     emit both values.

import postcss from 'postcss';
import type { Token } from '../types.ts';

// Matches a single `(min-width: <value>)` or `(max-width: <value>)` feature
// inside an @media param string. The value is captured as a non-empty,
// non-`)` run with surrounding whitespace trimmed.
const WIDTH_FEATURE_PATTERN = /\((?:min|max)-width\s*:\s*([^)]+?)\s*\)/gi;

/**
 * Extract breakpoint dimension tokens from raw stylesheet text.
 *
 * @param stylesheets - raw CSS source strings (one per stylesheet)
 * @returns deduplicated dimension tokens keyed by literal value
 */
export function categorizeBreakpoints(stylesheets: string[]): Token[] {
  if (stylesheets.length === 0) return [];

  const counts = new Map<string, number>();

  for (const css of stylesheets) {
    const values = extractWidthValues(css);
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([value, count]) =>
    buildToken(value, count),
  );
}

/**
 * Walk every `@media` atrule in a stylesheet and collect `min-width` /
 * `max-width` values. Orientation and other features are ignored.
 */
function extractWidthValues(css: string): string[] {
  const collected: string[] = [];

  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    // Malformed CSS — skip this stylesheet rather than fail the whole run.
    return collected;
  }

  root.walkAtRules('media', (rule) => {
    const params = rule.params;
    for (const match of params.matchAll(WIDTH_FEATURE_PATTERN)) {
      const value = match[1].trim();
      if (value.length > 0) collected.push(value);
    }
  });

  return collected;
}

function buildToken(value: string, count: number): Token {
  return {
    $type: 'dimension',
    $value: value,
    $extensions: {
      'com.dte.usage': { selectors: [], count },
      'com.dte.confidence': 0,
    },
  };
}
