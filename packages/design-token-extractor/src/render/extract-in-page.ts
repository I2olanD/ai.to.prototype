/// <reference lib="dom" />
/**
 * In-page DOM extractor for the design-token-extractor pipeline.
 *
 * This module is designed to be serialized and executed inside Playwright's
 * `page.evaluate()` context. For that reason it MUST NOT import any runtime
 * dependencies — only type-only imports are allowed (erased at compile time).
 *
 * The walker reads `getComputedStyle` for a fixed list of CSS properties on
 * every element in the document and emits a `RawStyleRecord` for each
 * non-empty value.
 *
 * For unit testing (see `tests/unit/extract-in-page.test.ts`), the same
 * function is run against a `jsdom` document — jsdom only reliably reports
 * computed styles for inline `style="..."` attributes, which is sufficient
 * to exercise walker logic, theme tagging, source attribution, and selector
 * construction. Real stylesheet resolution is covered by the Playwright
 * integration tests.
 *
 * NOTE on Playwright serialization (T3.2):
 * `page.evaluate(fn, arg)` serializes `fn` via `fn.toString()` — only the
 * function body is shipped to the browser, NOT any top-level module bindings.
 * Therefore `extractInPageFromGlobals` is written as a SELF-CONTAINED function:
 * it declares the property list and helpers inside its own body. The separate
 * `extractInPage(doc, win, theme)` export below is kept so unit tests can
 * drive the same walker logic against a jsdom document without spinning up
 * a real browser.
 */

import type { RawStyleRecord, StyleSource, ThemeTag } from '../types.ts';

/**
 * CSS properties read from each element. Categories follow SDD §"Categorizers":
 * color, typography, spacing, radius, shadow, z-index, motion.
 *
 * Kept in sync with the identical list inlined inside
 * `extractInPageFromGlobals`. See the module-level note above for why the
 * duplication exists.
 */
export const PROPERTIES: readonly string[] = [
  // Color
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',

  // Typography
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-decoration',

  // Spacing — padding
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',

  // Spacing — margin & gap
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'gap',

  // Radius
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',

  // Shadow
  'box-shadow',
  'text-shadow',

  // Z-index
  'z-index',

  // Motion
  'transition-duration',
  'transition-timing-function',
  'animation-duration',
  'animation-timing-function',
] as const;

/**
 * Builds a best-effort CSS breadcrumb for an element. Not guaranteed to be
 * unique — downstream stages treat it as a hint only.
 *
 * Format: `<tag>[#id][.class1.class2...]`
 */
const buildSelector = (element: Element): string => {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classList =
    element.classList.length > 0
      ? `.${Array.from(element.classList).join('.')}`
      : '';
  return `${tag}${id}${classList}`;
};

/**
 * Determines whether a property value originated from an inline `style="..."`
 * attribute. If the element's inline style declaration has a non-empty entry
 * for the property, we mark the record as `inline`; otherwise it came from a
 * stylesheet (user-agent, author, or computed cascade).
 *
 * Note: HTML-only elements (documents parsed but not yet attached to a real
 * browser layout tree, e.g. jsdom without stylesheets) may lack a `style`
 * property on some nodes (such as SVG in some environments). We guard
 * defensively and fall back to `'stylesheet'`.
 */
const resolveSource = (element: Element, property: string): StyleSource => {
  const styledElement = element as Element & { style?: CSSStyleDeclaration };
  const inline = styledElement.style?.getPropertyValue(property) ?? '';
  return inline !== '' ? 'inline' : 'stylesheet';
};

/**
 * Extracts all `RawStyleRecord`s from the given document. Walks every element
 * (including `<html>`) and reads each property in `PROPERTIES` from computed
 * style. Empty values are skipped. `z-index: auto` is skipped (dedup will
 * collapse it later anyway).
 *
 * Accepts `doc` and `win` as parameters so the function can be unit-tested
 * against jsdom. Inside Playwright's `page.evaluate`, use
 * `extractInPageFromGlobals` which is self-contained (its body is serialized
 * and reconstructed in the browser context — see module note).
 */
export const extractInPage = (
  doc: Document,
  win: Window & typeof globalThis,
  theme: ThemeTag,
): RawStyleRecord[] => {
  const records: RawStyleRecord[] = [];

  // `querySelectorAll('*')` returns every descendant but excludes the root
  // element in some specs — include `documentElement` explicitly, and
  // deduplicate via a Set to avoid double-counting if it shows up twice.
  const elements = new Set<Element>();
  elements.add(doc.documentElement);
  doc.querySelectorAll('*').forEach((el) => elements.add(el));

  for (const element of elements) {
    const computed = win.getComputedStyle(element);
    const selector = buildSelector(element);

    for (const property of PROPERTIES) {
      const value = computed.getPropertyValue(property).trim();
      if (value === '') continue;
      if (property === 'z-index' && value === 'auto') continue;

      records.push({
        selector,
        property,
        value,
        source: resolveSource(element, property),
        theme,
        scope: ':root',
      });
    }
  }

  return records;
};

/**
 * Self-contained entry point for Playwright's `page.evaluate()`.
 *
 * IMPORTANT: Only the body of this function is shipped to the browser — any
 * module-level bindings (including `PROPERTIES`, `buildSelector`,
 * `resolveSource`, and `extractInPage`) are NOT in scope at runtime inside
 * the page. Everything the walker needs is therefore re-declared inline.
 *
 * The logic is kept intentionally identical to `extractInPage` above. Unit
 * coverage lives on `extractInPage` (via jsdom); this wrapper is exercised
 * end-to-end by the Playwright integration tests (`tests/integration/render.test.ts`).
 */
export const extractInPageFromGlobals = (
  theme: ThemeTag,
): RawStyleRecord[] => {
  const properties: readonly string[] = [
    // Color
    'color',
    'background-color',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',

    // Typography
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'letter-spacing',
    'text-transform',
    'text-decoration',

    // Spacing — padding
    'padding',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',

    // Spacing — margin & gap
    'margin',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'gap',

    // Radius
    'border-radius',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',

    // Shadow
    'box-shadow',
    'text-shadow',

    // Z-index
    'z-index',

    // Motion
    'transition-duration',
    'transition-timing-function',
    'animation-duration',
    'animation-timing-function',
  ];

  const buildSelectorLocal = (element: Element): string => {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classList =
      element.classList.length > 0
        ? `.${Array.from(element.classList).join('.')}`
        : '';
    return `${tag}${id}${classList}`;
  };

  const resolveSourceLocal = (
    element: Element,
    property: string,
  ): StyleSource => {
    const styledElement = element as Element & { style?: CSSStyleDeclaration };
    const inline = styledElement.style?.getPropertyValue(property) ?? '';
    return inline !== '' ? 'inline' : 'stylesheet';
  };

  const records: RawStyleRecord[] = [];
  const elements = new Set<Element>();
  elements.add(document.documentElement);
  document.querySelectorAll('*').forEach((el) => elements.add(el));

  for (const element of elements) {
    const computed = window.getComputedStyle(element);
    const selector = buildSelectorLocal(element);

    for (const property of properties) {
      const value = computed.getPropertyValue(property).trim();
      if (value === '') continue;
      if (property === 'z-index' && value === 'auto') continue;

      records.push({
        selector,
        property,
        value,
        source: resolveSourceLocal(element, property),
        theme,
        scope: ':root',
      });
    }
  }

  return records;
};
