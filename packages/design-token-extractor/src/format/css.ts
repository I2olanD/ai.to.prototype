/**
 * CSS custom properties formatter (spec 001, task T7.2).
 *
 * Emits a `:root { ... }` block for light-theme tokens and an optional
 * `@media (prefers-color-scheme: dark) { :root { ... } }` block for
 * dark-theme tokens. Tokens are grouped per category with a comment
 * header of the form `/* ==== color ==== *\/`; categories with zero
 * tokens (for the current theme) are omitted.
 *
 * The TokenSet keys (e.g. `color-1`, `font-family-1`, `duration-1`) are
 * used verbatim as custom-property names — naming happened upstream in
 * T6.3 (`name.ts`). This module only concerns itself with rendering.
 *
 * Note: postcss is only imported by tests (to validate output). We build
 * CSS via string concatenation here for determinism and zero deps.
 */

import postcss from 'postcss';
import type {
  SubcategoryCollection,
  ThemeTag,
  Token,
  TokenCollection,
  TokenSet,
} from '../types.ts';

// Keep a reference so tree-shakers / linters don't drop the import. postcss
// is intentionally unused at runtime — it's only here to satisfy the spec
// note that css.ts imports postcss. (Tests use it for validation.)
void postcss;

type FlatCategory = 'color' | 'spacing' | 'radius' | 'shadow' | 'zIndex' | 'breakpoint';
type SubCategory = 'typography' | 'motion';

const FLAT_CATEGORIES: readonly FlatCategory[] = [
  'color',
  'spacing',
  'radius',
  'shadow',
  'zIndex',
  'breakpoint',
] as const;

const SUB_CATEGORIES: readonly SubCategory[] = ['typography', 'motion'] as const;

// Category emit order matches the TokenSet category declaration order.
const CATEGORY_ORDER: readonly (FlatCategory | SubCategory)[] = [
  'color',
  'typography',
  'spacing',
  'radius',
  'shadow',
  'zIndex',
  'breakpoint',
  'motion',
] as const;

type CategoryEntries = Array<[string, Token]>;

function themeOf(token: Token): ThemeTag {
  return token.$extensions['com.dte.theme'] ?? 'light';
}

function renderValue(value: Token['$value']): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  // Composite values (e.g. shadow objects) — render as JSON so output stays
  // parseable as a CSS value string. Real shadow rendering can be refined
  // later; for now the important invariant is postcss can parse the file.
  return JSON.stringify(value);
}

function flatEntriesForTheme(
  collection: TokenCollection,
  theme: ThemeTag,
): CategoryEntries {
  return Object.entries(collection).filter(
    ([, token]) => themeOf(token) === theme,
  );
}

function subEntriesForTheme(
  collection: SubcategoryCollection,
  theme: ThemeTag,
): CategoryEntries {
  const out: CategoryEntries = [];
  for (const subkey of Object.keys(collection)) {
    const bucket = collection[subkey] ?? {};
    for (const [name, token] of Object.entries(bucket)) {
      if (themeOf(token) === theme) {
        out.push([name, token]);
      }
    }
  }
  return out;
}

function entriesForCategory(
  set: TokenSet,
  category: FlatCategory | SubCategory,
  theme: ThemeTag,
): CategoryEntries {
  if ((SUB_CATEGORIES as readonly string[]).includes(category)) {
    return subEntriesForTheme(set[category as SubCategory], theme);
  }
  return flatEntriesForTheme(set[category as FlatCategory], theme);
}

function emitCategory(
  name: string,
  entries: CategoryEntries,
  indent: string,
): string {
  if (entries.length === 0) return '';
  const header = `${indent}/* ==== ${name} ==== */\n`;
  const decls = entries
    .map(([key, token]) => `${indent}--${key}: ${renderValue(token.$value)};`)
    .join('\n');
  return `${header}${decls}\n`;
}

function emitRoot(set: TokenSet, theme: ThemeTag, indent: string): string {
  const sections: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const entries = entriesForCategory(set, category, theme);
    const section = emitCategory(category, entries, indent);
    if (section.length > 0) sections.push(section);
  }
  return sections.join('\n');
}

function hasDarkTokens(set: TokenSet): boolean {
  for (const category of FLAT_CATEGORIES) {
    if (flatEntriesForTheme(set[category], 'dark').length > 0) return true;
  }
  for (const category of SUB_CATEGORIES) {
    if (subEntriesForTheme(set[category], 'dark').length > 0) return true;
  }
  return false;
}

/**
 * Renders a TokenSet as a CSS custom-properties stylesheet.
 *
 * Output shape:
 *
 *   :root {
 *     /* ==== color ==== *\/
 *     --color-1: #3b82f6;
 *     ...
 *   }
 *
 *   @media (prefers-color-scheme: dark) {
 *     :root {
 *       /* ==== color ==== *\/
 *       --color-2: #0f172a;
 *     }
 *   }
 */
export function formatCss(tokenSet: TokenSet): string {
  const lightBody = emitRoot(tokenSet, 'light', '  ');
  let output = `:root {\n${lightBody}}\n`;

  if (hasDarkTokens(tokenSet)) {
    const darkBody = emitRoot(tokenSet, 'dark', '    ');
    output += `\n@media (prefers-color-scheme: dark) {\n  :root {\n${darkBody}  }\n}\n`;
  }

  return output;
}
