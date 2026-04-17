/**
 * Cross-cutting token deduplicator (spec 001, task T6.1).
 *
 * Per-category extractors already merge within-category duplicates; this
 * pass handles the rare edge case where two different categorizers emit
 * structurally identical tokens (same `$type`, same `$value`, same
 * `com.dte.theme`). When such tokens meet here we:
 *
 *   - sum `com.dte.usage.count`
 *   - union `com.dte.usage.selectors` preserving first-seen order (no dupes)
 *   - pick `com.dte.source = 'stylesheet'` if ANY input is stylesheet,
 *     otherwise keep the existing source (SDD §"Inline style weighting":
 *     stylesheet "wins" the primary-source tag in ties; we do NOT
 *     double-count usage — selectors are concatenated verbatim)
 *   - preserve confidence from the first token (scoring happens in T6.2)
 *
 * Tokens with different `$type` or different `com.dte.theme` are never
 * merged. Output order matches first-seen order of merge-keys in the input.
 *
 * Pure: no I/O, no mutation of inputs, no external deps.
 */

import type { Token, TokenExtensions } from './types.ts';

/**
 * Canonicalizes `$value` for merge-key purposes. Primitive values stringify
 * directly; object values (e.g. composite shadow tokens) are serialized via
 * JSON with sorted keys so two structurally equal records hash alike
 * regardless of property insertion order in the source records.
 */
function stringifyValue(value: Token['$value']): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  const keys = Object.keys(value).sort();
  const ordered: Record<string, unknown> = {};
  for (const key of keys) {
    ordered[key] = value[key];
  }
  return JSON.stringify(ordered);
}

/**
 * Builds the composite merge key `${type}::${value}::${theme ?? 'none'}`.
 */
function mergeKey(token: Token): string {
  const theme = token.$extensions['com.dte.theme'] ?? 'none';
  return `${token.$type}::${stringifyValue(token.$value)}::${theme}`;
}

/**
 * Unions two selector lists preserving first-seen order; duplicates across
 * either list are collapsed to a single entry.
 */
function unionSelectors(a: readonly string[], b: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const selector of a) {
    if (seen.has(selector)) continue;
    seen.add(selector);
    out.push(selector);
  }
  for (const selector of b) {
    if (seen.has(selector)) continue;
    seen.add(selector);
    out.push(selector);
  }
  return out;
}

/**
 * Returns a new Token formed by merging `incoming` into `existing`.
 *
 * - count: summed
 * - selectors: first-seen-order union, deduped
 * - source: 'stylesheet' if either side is 'stylesheet', else existing value
 * - everything else (type, value, theme, confidence, description): unchanged
 */
function mergeTokens(existing: Token, incoming: Token): Token {
  const existingUsage = existing.$extensions['com.dte.usage'];
  const incomingUsage = incoming.$extensions['com.dte.usage'];

  const mergedExtensions: TokenExtensions = {
    ...existing.$extensions,
    'com.dte.usage': {
      selectors: unionSelectors(existingUsage.selectors, incomingUsage.selectors),
      count: existingUsage.count + incomingUsage.count,
    },
  };

  const existingSource = existing.$extensions['com.dte.source'];
  const incomingSource = incoming.$extensions['com.dte.source'];
  if (existingSource === 'stylesheet' || incomingSource === 'stylesheet') {
    mergedExtensions['com.dte.source'] = 'stylesheet';
  }

  return {
    ...existing,
    $extensions: mergedExtensions,
  };
}

/**
 * Cross-cutting dedup pass over a flat Token list. See module docstring.
 */
export function dedupTokens(tokens: Token[]): Token[] {
  const order: string[] = [];
  const merged = new Map<string, Token>();

  for (const token of tokens) {
    const key = mergeKey(token);
    const existing = merged.get(key);
    if (existing === undefined) {
      order.push(key);
      merged.set(key, token);
      continue;
    }
    merged.set(key, mergeTokens(existing, token));
  }

  return order.map((key) => merged.get(key) as Token);
}
