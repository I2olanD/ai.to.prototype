/**
 * Color categorizer (spec 001, task T5.1).
 *
 * Pure function: filters raw style records down to color-bearing CSS
 * properties, normalizes each value to a canonical string (hex where
 * possible, rgba/hsl preserved), drops non-color keywords (`inherit`,
 * `currentColor`, etc.), and groups records sharing a canonical value
 * into one DTCG Token.
 *
 * No external dependencies, no I/O, no framework hooks. Output order is
 * stable: Tokens appear in first-seen order of their canonical value.
 *
 * Confidence is always `0` here; scoring is applied later (Phase 6 T6.2).
 */

import type { RawStyleRecord, Token } from '../types.ts';

/**
 * CSS properties whose value is (or may be) a color. Mirrors the list used
 * by `src/render/extract-in-page.ts` to keep extract and categorize aligned.
 */
const COLOR_PROPERTIES: ReadonlySet<string> = new Set([
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
]);

/**
 * CSS-wide keyword values and special color tokens that carry no concrete
 * color payload. Matched case-insensitively against the trimmed input.
 */
const SKIPPED_KEYWORDS: ReadonlySet<string> = new Set([
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'transparent',
  'revert',
  'revert-layer',
  'none',
  'auto',
]);

/**
 * Minimal named-color map. Covers the 16 HTML/CSS1 named colors plus a few
 * commonly-encountered extras. Any name not found here is passed through
 * unchanged (we do not validate against the full CSS named-color list).
 */
const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: '#000000',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
  white: '#ffffff',
  maroon: '#800000',
  red: '#ff0000',
  purple: '#800080',
  fuchsia: '#ff00ff',
  magenta: '#ff00ff',
  green: '#008000',
  lime: '#00ff00',
  olive: '#808000',
  yellow: '#ffff00',
  navy: '#000080',
  blue: '#0000ff',
  teal: '#008080',
  aqua: '#00ffff',
  cyan: '#00ffff',
  orange: '#ffa500',
  pink: '#ffc0cb',
};

/**
 * Detects CSS gradient functional notations. Gradients are preserved
 * verbatim because DTCG has no first-class gradient type.
 */
function isGradient(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return (
    trimmed.startsWith('linear-gradient(') ||
    trimmed.startsWith('radial-gradient(') ||
    trimmed.startsWith('conic-gradient(') ||
    trimmed.startsWith('repeating-linear-gradient(') ||
    trimmed.startsWith('repeating-radial-gradient(') ||
    trimmed.startsWith('repeating-conic-gradient(')
  );
}

/**
 * Expands a 3- or 4-digit hex shorthand into its 6- or 8-digit form and
 * returns the canonical lowercase representation. Returns null for any
 * string that does not match a valid hex color shape.
 */
function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('#')) return null;
  const digits = trimmed.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(digits)) return null;

  if (digits.length === 3 || digits.length === 4) {
    const expanded = digits
      .split('')
      .map((ch) => ch + ch)
      .join('');
    return `#${expanded.toLowerCase()}`;
  }
  if (digits.length === 6 || digits.length === 8) {
    return `#${digits.toLowerCase()}`;
  }
  return null;
}

/**
 * Converts `rgb(r, g, b)` with integer channels into a 6-digit lowercase
 * hex string. Returns null for malformed input or any channel out of
 * the 0-255 range.
 */
function rgbToHex(value: string): string | null {
  const match = /^rgb\(\s*([^)]+)\s*\)$/i.exec(value.trim());
  if (!match) return null;
  const parts = match[1]!.split(',').map((p) => p.trim());
  if (parts.length !== 3) return null;
  const channels: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number.parseInt(part, 10);
    if (n < 0 || n > 255) return null;
    channels.push(n);
  }
  const hex = channels
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`;
}

/**
 * Returns a canonical `rgba(r, g, b, a)` string so values that differ only
 * in whitespace deduplicate. Preserves the original channel text (we do
 * not round alpha), only collapsing whitespace.
 */
function canonicalizeRgba(value: string): string | null {
  const match = /^rgba\(\s*([^)]+)\s*\)$/i.exec(value.trim());
  if (!match) return null;
  const parts = match[1]!.split(',').map((p) => p.trim());
  if (parts.length !== 4) return null;
  return `rgba(${parts.join(', ')})`;
}

/**
 * Returns a canonical `hsl(...)` or `hsla(...)` string; whitespace-normalized
 * but otherwise preserved. No conversion to hex — hsl stays hsl so callers
 * retain the original authoring intent.
 */
function canonicalizeHsl(value: string): string | null {
  const match = /^(hsla?)\(\s*([^)]+)\s*\)$/i.exec(value.trim());
  if (!match) return null;
  const fn = match[1]!.toLowerCase();
  const parts = match[2]!.split(',').map((p) => p.trim());
  return `${fn}(${parts.join(', ')})`;
}

/**
 * Normalizes any CSS color value into a canonical string, or returns null
 * to signal the caller to skip this record. Gradients are returned verbatim
 * (trimmed) and tagged as non-color by the caller via `isGradient`.
 */
function normalizeColor(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (SKIPPED_KEYWORDS.has(trimmed.toLowerCase())) return null;

  if (isGradient(trimmed)) return trimmed;

  const hex = normalizeHex(trimmed);
  if (hex !== null) return hex;

  if (/^rgb\(/i.test(trimmed)) {
    const hexForm = rgbToHex(trimmed);
    if (hexForm !== null) return hexForm;
  }

  if (/^rgba\(/i.test(trimmed)) {
    const canonical = canonicalizeRgba(trimmed);
    if (canonical !== null) return canonical;
  }

  if (/^hsla?\(/i.test(trimmed)) {
    const canonical = canonicalizeHsl(trimmed);
    if (canonical !== null) return canonical;
  }

  const named = NAMED_COLORS[trimmed.toLowerCase()];
  if (named !== undefined) return named;

  // Unknown form: pass through as-is so downstream dedup still works via
  // string equality. We never invent a value.
  return trimmed;
}

/**
 * Bucket of records sharing a canonical value, preserving first-seen
 * insertion order of selectors and the originating record for source/theme.
 */
type ColorGroup = {
  canonical: string;
  isGradientValue: boolean;
  first: RawStyleRecord;
  selectors: string[];
};

/**
 * Extracts color tokens from raw computed-style records.
 *
 * Steps:
 *   1. Filter to records whose property lives in COLOR_PROPERTIES.
 *   2. Normalize each value; drop records with a null canonical form.
 *   3. Group by canonical value; accumulate selectors in first-seen order.
 *   4. Emit one DTCG Token per group with confidence=0 and usage metadata.
 */
export function categorizeColors(records: RawStyleRecord[]): Token[] {
  const groups = new Map<string, ColorGroup>();

  for (const record of records) {
    if (!COLOR_PROPERTIES.has(record.property)) continue;

    const canonical = normalizeColor(record.value);
    if (canonical === null) continue;

    const existing = groups.get(canonical);
    if (existing === undefined) {
      groups.set(canonical, {
        canonical,
        isGradientValue: isGradient(canonical),
        first: record,
        selectors: [record.selector],
      });
      continue;
    }
    existing.selectors.push(record.selector);
  }

  const tokens: Token[] = [];
  for (const group of groups.values()) {
    tokens.push({
      $value: group.canonical,
      $type: group.isGradientValue ? 'other' : 'color',
      $extensions: {
        'com.dte.usage': {
          selectors: group.selectors,
          count: group.selectors.length,
        },
        'com.dte.confidence': 0,
        'com.dte.source': group.first.source,
        'com.dte.theme': group.first.theme,
      },
    });
  }

  return tokens;
}
