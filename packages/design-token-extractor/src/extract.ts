/**
 * Pipeline orchestrator for the design-token-extractor (spec 001, T8.1).
 *
 * Composes every stage of the extraction pipeline into a single async
 * function that takes CLI options and returns a valid `TokenSet`:
 *
 *   sources (validate/load)
 *     → render (Playwright, emulate theme, returns RawStyleRecord[])
 *     → resolve (CSS vars — no-op in v1; see DRIFT note below)
 *     → categorize (color / typography / spacing / radius / shadow /
 *                   z-index / breakpoint / motion)
 *     → dedup (cross-cutting)
 *     → applyScores (ADR-4 confidence thresholds)
 *     → nameBucket (value-indexed numeric names per ADR-3)
 *     → buildTokenSet ($schema + $metadata)
 *
 * Theme handling (SDD §"Complex Logic → Theme-aware extraction"):
 *   - `theme: 'auto'` renders BOTH light and dark; if the two record sets
 *     are structurally identical we drop the dark pass (no dark rules in
 *     the stylesheet). Otherwise we concatenate both, tagged via the
 *     renderer's `theme` field on each record.
 *   - `theme: 'light' | 'dark'` renders a single pass with that emulation.
 *
 * DRIFT (deferred to v2):
 *   - T4.1 `resolveRecords`: render() returns computed styles, which means
 *     the browser has already resolved `var()` references for us. The
 *     resolver is kept in the codebase and remains useful for a future
 *     source-CSS parser, but is NOT invoked here because we have no scope
 *     map to feed it (computed styles don't surface per-element custom
 *     property declarations, only their cascaded values).
 *   - T5.7 `categorizeBreakpoints`: requires raw stylesheet text which the
 *     current renderer does not surface. `TokenSet.breakpoint` is emitted
 *     as `{}` until the renderer is extended (out of scope for v1).
 *
 * `$metadata.version` is injected at build time from `package.json#version`
 * via the `__DTE_VERSION__` constant defined in `tsup.config.ts`. Tests
 * that run against source (no bundling) fall back to '0.0.0-dev'.
 */

import { applyScores } from './apply-score';
import { categorizeColors } from './categorize/color';
import { categorizeMotion } from './categorize/motion';
import { categorizeRadius } from './categorize/radius';
import { categorizeShadow } from './categorize/shadow';
import { categorizeSpacing } from './categorize/spacing';
import { categorizeTypography } from './categorize/typography';
import { categorizeZIndex } from './categorize/zindex';
import { dedupTokens } from './dedup';
import { nameBucket } from './name';
import { render } from './render/playwright';
import { loadFile } from './sources/file';
import { parseUrl } from './sources/url';
import type {
  CliOptions,
  RawStyleRecord,
  ThemeTag,
  Token,
  TokenCollection,
  TokenSet,
  TokenSetMetadata,
} from './types';

const VERSION = typeof __DTE_VERSION__ !== 'undefined' ? __DTE_VERSION__ : '0.0.0-dev';

/**
 * Orchestrates the full extraction pipeline. Returns a fully-populated
 * `TokenSet` that conforms to the DTCG community-group schema, with
 * extractor metadata attached under `$metadata`.
 *
 * Throws `UserError` for invalid input (invalid URL, missing file) and
 * `ExtractionError` for render failures / timeouts — both propagated from
 * the underlying stage modules. Exit-code mapping is the CLI's job (T8.2).
 */
export async function extract(opts: CliOptions): Promise<TokenSet> {
  const sourceValue = await resolveInput(opts);
  const records = await gatherRecords(opts);

  const tokenSet = buildTokenSet(records, {
    extractor: 'design-token-extractor',
    version: VERSION,
    extractedAt: new Date().toISOString(),
    source: { kind: opts.input.kind, value: sourceValue },
  });

  return tokenSet;
}

/**
 * Validates the input source and returns the canonical string to store in
 * `$metadata.source.value`:
 *   - URL input: validated by `parseUrl` (scheme allowlist); returned as
 *     the stringified parsed URL so `http://site` becomes `http://site/`.
 *   - File input: absolute path returned by `loadFile`.
 *
 * We rely on `render()` to navigate to the target again via `pathToFileURL`
 * / the raw URL string; this function's only job is to surface the value
 * that belongs in metadata.
 */
async function resolveInput(opts: CliOptions): Promise<string> {
  if (opts.input.kind === 'url') {
    const parsed = parseUrl(opts.input.url);
    return parsed.toString();
  }
  const { absPath } = await loadFile(opts.input.path);
  return absPath;
}

/**
 * Renders the page under the requested theme(s) and returns a flat list of
 * `RawStyleRecord`s. For `theme: 'auto'` we render both light and dark and
 * concatenate the results — but only if the two passes actually differ.
 * When they are identical (no `@media (prefers-color-scheme)` rules in the
 * page) we drop the dark pass to avoid emitting phantom dark tokens.
 */
async function gatherRecords(opts: CliOptions): Promise<RawStyleRecord[]> {
  if (opts.theme === 'light' || opts.theme === 'dark') {
    return render(opts.input, opts.theme, opts.timeoutMs);
  }

  // theme === 'auto'
  const lightRecords = await render(opts.input, 'light', opts.timeoutMs);
  const darkRecords = await render(opts.input, 'dark', opts.timeoutMs);

  if (recordsEqual(lightRecords, darkRecords)) {
    // No dark-mode rules detected — the page is theme-agnostic. Drop the
    // dark pass to avoid duplicating tokens under a misleading `theme` tag.
    return lightRecords.map((r) => ({ ...r, theme: 'light' as ThemeTag }));
  }

  return [...lightRecords, ...darkRecords];
}

/**
 * Structurally compares two record arrays ignoring the `theme` field — the
 * `theme` is always different (light vs dark) so it would make any two
 * passes look unequal. We compare length + every other field in insertion
 * order, which is stable because the walker visits DOM elements in a fixed
 * order.
 */
function recordsEqual(
  left: RawStyleRecord[],
  right: RawStyleRecord[],
): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    const a = left[i];
    const b = right[i];
    if (a === undefined || b === undefined) return false;
    if (
      a.selector !== b.selector ||
      a.property !== b.property ||
      a.value !== b.value ||
      a.source !== b.source ||
      a.scope !== b.scope ||
      a.originalVar !== b.originalVar
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Runs dedup → score → name on a flat Token bucket. Naming uses the given
 * prefix (e.g. `color`, `spacing`, `radius`).
 */
function finalizeBucket(tokens: Token[], prefix: string): TokenCollection {
  const deduped = dedupTokens(tokens);
  const scored = applyScores(deduped);
  return nameBucket(scored, prefix);
}

/**
 * Shape that mirrors every categorizer's output as a flat Token bucket
 * keyed by where it eventually lives in the `TokenSet`. Returned by
 * `categorizeAll` so we can merge per-theme categorization passes before
 * finalizing (dedup + score + name).
 */
type FlatBuckets = {
  color: Token[];
  family: Token[];
  size: Token[];
  weight: Token[];
  lineHeight: Token[];
  letterSpacing: Token[];
  spacing: Token[];
  radius: Token[];
  shadow: Token[];
  zIndex: Token[];
  durationMotion: Token[];
  easingMotion: Token[];
};

/**
 * Runs every per-category categorizer over a single record slice. Returns
 * flat Token arrays keyed by final bucket. Pulled out so we can run it once
 * per theme for `theme: 'auto'` (see `categorizeByTheme`) — the downstream
 * color/typography/shadow categorizers group records by value only and
 * would otherwise erase the theme tag when light and dark values coincide.
 */
function categorizeOne(records: RawStyleRecord[]): FlatBuckets {
  const typography = categorizeTypography(records);
  const motion = categorizeMotion(records);
  return {
    color: categorizeColors(records),
    family: typography.family,
    size: typography.size,
    weight: typography.weight,
    lineHeight: typography.lineHeight,
    letterSpacing: typography.letterSpacing,
    spacing: categorizeSpacing(records),
    radius: categorizeRadius(records),
    shadow: categorizeShadow(records),
    zIndex: categorizeZIndex(records),
    durationMotion: motion.duration,
    easingMotion: motion.easing,
  };
}

/**
 * Splits records by `theme` tag and categorizes each slice independently,
 * then concatenates the resulting Token arrays. This preserves
 * `com.dte.theme` on every token even when a value (e.g. `#ffffff`) appears
 * under both light and dark — categorizers that group by canonical value
 * alone would otherwise collapse both into a single light-tagged token.
 *
 * When every record carries the same theme (the common case for single-
 * theme renders), this reduces to a single categorizer invocation.
 */
function categorizeByTheme(records: RawStyleRecord[]): FlatBuckets {
  const lightRecords = records.filter((r) => r.theme === 'light');
  const darkRecords = records.filter((r) => r.theme === 'dark');

  if (lightRecords.length === 0 || darkRecords.length === 0) {
    return categorizeOne(records);
  }

  const light = categorizeOne(lightRecords);
  const dark = categorizeOne(darkRecords);
  return {
    color: [...light.color, ...dark.color],
    family: [...light.family, ...dark.family],
    size: [...light.size, ...dark.size],
    weight: [...light.weight, ...dark.weight],
    lineHeight: [...light.lineHeight, ...dark.lineHeight],
    letterSpacing: [...light.letterSpacing, ...dark.letterSpacing],
    spacing: [...light.spacing, ...dark.spacing],
    radius: [...light.radius, ...dark.radius],
    shadow: [...light.shadow, ...dark.shadow],
    zIndex: [...light.zIndex, ...dark.zIndex],
    durationMotion: [...light.durationMotion, ...dark.durationMotion],
    easingMotion: [...light.easingMotion, ...dark.easingMotion],
  };
}

/**
 * Finalizes every bucket (dedup + score + name) and assembles the
 * `TokenSet`. Kept separate from `extract` so the metadata construction
 * path stays readable.
 */
function buildTokenSet(
  records: RawStyleRecord[],
  metadata: TokenSetMetadata,
): TokenSet {
  const buckets = categorizeByTheme(records);

  const color = finalizeBucket(buckets.color, 'color');
  const typography = {
    family: finalizeBucket(buckets.family, 'font-family'),
    size: finalizeBucket(buckets.size, 'font-size'),
    weight: finalizeBucket(buckets.weight, 'font-weight'),
    lineHeight: finalizeBucket(buckets.lineHeight, 'line-height'),
    letterSpacing: finalizeBucket(buckets.letterSpacing, 'letter-spacing'),
  };
  const spacing = finalizeBucket(buckets.spacing, 'spacing');
  const radius = finalizeBucket(buckets.radius, 'radius');
  const shadow = finalizeBucket(buckets.shadow, 'shadow');
  const zIndex = finalizeBucket(buckets.zIndex, 'z');

  // DRIFT: breakpoint extraction needs raw stylesheet text which the
  // current renderer does not surface. Empty bucket in v1.
  const breakpoint: TokenCollection = {};

  const motion = {
    duration: finalizeBucket(buckets.durationMotion, 'duration'),
    easing: finalizeBucket(buckets.easingMotion, 'easing'),
  };

  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $metadata: metadata,
    color,
    typography,
    spacing,
    radius,
    shadow,
    zIndex,
    breakpoint,
    motion,
  };
}
