/**
 * CSS custom property (`var()`) resolver with cycle detection.
 *
 * Implements spec 001 T4.1 (SDD §"Implementation Examples → resolveVar",
 * §"Implementation Gotchas → CSS variable scope"):
 *
 *   - Resolve `var(--name [, fallback])` through a per-scope map, with
 *     `:root` as the fallback scope when the current scope has no entry.
 *   - Support nested vars inside fallbacks: `var(--a, var(--b, #fff))`.
 *   - Support vars embedded inside larger values: `1px solid var(--c)`.
 *   - Detect cycles and return the sentinel `'unresolved'` with the
 *     outermost var name that triggered resolution as `originalVar`.
 *
 * Pure module: no side effects, no I/O, no runtime imports beyond types.
 */
import type { RawStyleRecord } from '../types.ts';

/**
 * Scope selector → custom-property name → declared value.
 *
 * Example:
 *   {
 *     ':root':  { '--primary': '#0066cc' },
 *     '.dark':  { '--primary': '#99ccff' },
 *   }
 */
export type ScopeMap = Record<string, Record<string, string>>;

/**
 * Sentinel returned when a `var()` chain cannot be resolved (cycle or
 * missing name without a usable fallback). PRD Feature 4 AC2 requires
 * that tokens emitted from such records carry the original var name.
 */
const UNRESOLVED = 'unresolved';

/**
 * Hard ceiling on recursion depth. Cycle detection via the `visited` set
 * already terminates pathological input; the depth guard is a belt-and-
 * suspenders safety net that bounds cost even if the visited set were
 * ever bypassed by a future refactor.
 */
const MAX_DEPTH = 16;

type ResolveResult = { resolved: string; originalVar?: string };

/**
 * Resolve every `var()` occurrence inside `value` using the given scope,
 * falling back to `:root` when the current scope lacks an entry.
 *
 * Returns `{ resolved }` on success, or `{ resolved: 'unresolved',
 * originalVar }` where `originalVar` is the outermost custom-property
 * name the value tried to resolve.
 */
export function resolveValue(
  value: string,
  scopeMap: ScopeMap,
  scope: string,
): ResolveResult {
  return resolveExpression(value, scopeMap, scope, new Set<string>(), 0);
}

/**
 * Map `resolveValue` across a record list. Records whose value resolves
 * to the `'unresolved'` sentinel carry `originalVar` set to the outermost
 * var name that triggered resolution; successfully resolved records carry
 * no `originalVar`.
 */
export function resolveRecords(
  records: RawStyleRecord[],
  scopeMap: ScopeMap,
): RawStyleRecord[] {
  return records.map((record) => {
    const result = resolveValue(record.value, scopeMap, record.scope);
    if (result.resolved === UNRESOLVED) {
      return { ...record, value: UNRESOLVED, originalVar: result.originalVar };
    }
    return { ...record, value: result.resolved };
  });
}

/**
 * Resolve every `var(...)` span inside an arbitrary expression string.
 *
 * Strategy: locate the next `var(` and scan forward with a paren-depth
 * counter to find its matching close. Resolve that span (which may itself
 * contain nested `var()`s inside its fallback). Splice the result back
 * into the string and continue until no `var(` remains.
 */
function resolveExpression(
  value: string,
  scopeMap: ScopeMap,
  scope: string,
  visited: Set<string>,
  depth: number,
): ResolveResult {
  if (depth > MAX_DEPTH) {
    return { resolved: UNRESOLVED, originalVar: firstVarName(value) };
  }

  let current = value;
  while (true) {
    const span = findFirstVarSpan(current);
    if (span === null) {
      return { resolved: current };
    }

    const inner = current.slice(span.start + 'var('.length, span.end - 1);
    const parsed = parseVarArgs(inner);
    if (parsed === null) {
      // Malformed var(...) expression — treat as unresolved, capturing
      // whatever token follows `var(` as the originalVar hint.
      return { resolved: UNRESOLVED, originalVar: firstVarName(current) };
    }

    const substituted = resolveVarSubstitution(
      parsed.name,
      parsed.fallback,
      scopeMap,
      scope,
      visited,
      depth,
    );
    if (substituted.resolved === UNRESOLVED) {
      return substituted;
    }

    current =
      current.slice(0, span.start) + substituted.resolved + current.slice(span.end);
  }
}

/**
 * Resolve a single `var(name [, fallback])` into a literal string.
 *
 * Lookup order per SDD §"Gotchas → CSS variable scope":
 *   1. scopeMap[scope][name]
 *   2. scopeMap[':root'][name]   (if scope !== ':root')
 *   3. fallback expression       (may contain nested var()s)
 *
 * Cycle detection: we add `name` to `visited` before recursing into its
 * declared value. If we re-enter the same name we bail with UNRESOLVED.
 */
function resolveVarSubstitution(
  name: string,
  fallback: string | null,
  scopeMap: ScopeMap,
  scope: string,
  visited: Set<string>,
  depth: number,
): ResolveResult {
  if (visited.has(name)) {
    return { resolved: UNRESOLVED, originalVar: name };
  }

  const declared = lookupVar(name, scopeMap, scope);
  if (declared !== undefined) {
    const nextVisited = new Set(visited);
    nextVisited.add(name);
    const inner = resolveExpression(
      declared,
      scopeMap,
      scope,
      nextVisited,
      depth + 1,
    );
    if (inner.resolved === UNRESOLVED) {
      // Propagate the topmost var that started this chain so callers see
      // the root cause, not an inner cycle participant.
      return { resolved: UNRESOLVED, originalVar: name };
    }
    return { resolved: inner.resolved };
  }

  if (fallback !== null) {
    const nextVisited = new Set(visited);
    nextVisited.add(name);
    const fb = resolveExpression(
      fallback,
      scopeMap,
      scope,
      nextVisited,
      depth + 1,
    );
    if (fb.resolved === UNRESOLVED) {
      return { resolved: UNRESOLVED, originalVar: name };
    }
    return { resolved: fb.resolved };
  }

  return { resolved: UNRESOLVED, originalVar: name };
}

/**
 * Look up `name` in the given scope, falling back to `:root` when the
 * current scope has no entry (or is missing from the map entirely).
 */
function lookupVar(
  name: string,
  scopeMap: ScopeMap,
  scope: string,
): string | undefined {
  const inScope = scopeMap[scope]?.[name];
  if (inScope !== undefined) return inScope;
  if (scope !== ':root') {
    return scopeMap[':root']?.[name];
  }
  return undefined;
}

/**
 * Find the first `var(...)` span in `value`, respecting nested parens.
 * Returns half-open [start, end) indices where `start` points at `v` and
 * `end` points one past the matching `)`.
 */
function findFirstVarSpan(value: string): { start: number; end: number } | null {
  const start = value.indexOf('var(');
  if (start < 0) return null;

  let depth = 0;
  for (let i = start + 'var('.length - 1; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return { start, end: i + 1 };
      }
    }
  }
  return null;
}

/**
 * Parse the argument list of a `var(...)` — the contents between the
 * outer parens — into `{ name, fallback }`. The comma split happens at
 * depth-0 only, so `var(--a, var(--b, #fff))` yields
 * `{ name: '--a', fallback: 'var(--b, #fff)' }`.
 */
function parseVarArgs(
  inner: string,
): { name: string; fallback: string | null } | null {
  const commaIndex = findTopLevelComma(inner);
  const namePart = commaIndex < 0 ? inner : inner.slice(0, commaIndex);
  const fallbackPart = commaIndex < 0 ? null : inner.slice(commaIndex + 1).trim();

  const name = namePart.trim();
  if (!/^--[\w-]+$/.test(name)) return null;

  return { name, fallback: fallbackPart };
}

/**
 * Index of the first comma at paren-depth 0 in `inner`, or -1 if none.
 */
function findTopLevelComma(inner: string): number {
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) return i;
  }
  return -1;
}

/**
 * Best-effort extraction of the first `--name` appearing in a value —
 * used to populate `originalVar` on malformed input or depth-guard bail.
 */
function firstVarName(value: string): string | undefined {
  const match = value.match(/--[\w-]+/);
  return match ? match[0] : undefined;
}
