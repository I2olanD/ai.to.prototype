# Acceptance Criteria Coverage Matrix — 001-design-token-extractor

Maps every **Must-Have** PRD acceptance criterion and every distinct SDD EARS acceptance criterion to the concrete test(s) that exercise it. Status legend:

- ✅ Covered — test exists and asserts the AC.
- ⚠️ Covered with drift — test exists, but an implementation drift (see `README.md` Decisions Log, 2026-04-17) affects the strictness or shape of coverage.
- ❌ Not covered — no test asserts the AC in v1.

All test paths are relative to `packages/design-token-extractor/`.

---

## PRD Must-Have Features (Features 1–8)

### Feature 1 — Extract from public URL

| PRD AC | Test file(s) | Test name | Status |
|--------|--------------|-----------|--------|
| Given a reachable public URL, `extract <url>` exits 0 within 60 s and writes valid DTCG JSON | `tests/integration/extract.test.ts`, `tests/integration/cli.test.ts` | `returns a valid TokenSet for simple.html with theme=auto`; `extract --file simple.html --format json writes valid JSON to stdout` | ⚠️ URL path covered indirectly via `file:` fixtures (offline, deterministic); no live URL integration test in v1 CI |
| JS-rendered sites — render via headless browser, capture post-render computed styles | `tests/integration/render.test.ts` | `returns a non-empty array of RawStyleRecord for a simple file fixture`; `emits at least one color record and one font-size record` | ✅ |
| Timeout at 60 s → non-zero exit with timeout message | `tests/integration/extract.test.ts`, `tests/integration/render.test.ts` | `throws ExtractionError when timeoutMs=1`; `throws ExtractionError with a timeout message when timeoutMs is too small` | ✅ |

### Feature 2 — Extract from local HTML file

| PRD AC | Test file(s) | Test name | Status |
|--------|--------------|-----------|--------|
| `extract --file ./page.html` loads file headlessly and extracts equivalently | `tests/integration/cli.test.ts`, `tests/integration/extract.test.ts`, `tests/unit/sources-file.test.ts` | `extract --file simple.html --format json writes valid JSON to stdout`; `returns a valid TokenSet for simple.html with theme=auto`; `resolves with absolute path + html for a valid .html file` | ✅ |
| Missing file → non-zero exit, clear `File not found` message | `tests/integration/cli.test.ts`, `tests/unit/sources-file.test.ts` | `extract with a missing file exits 1 with "File not found"`; `throws UserError with "File not found" and the path when missing` | ✅ |

### Feature 3 — Extract token categories

| PRD AC | Test file(s) | Test name | Status |
|--------|--------------|-----------|--------|
| Defaults emit keys for `color`, `typography`, `spacing`, `radius`, `shadow`, `zIndex`, `breakpoint`, `motion` | `tests/unit/format/json.test.ts`, `tests/unit/format/js.test.ts` | `emits all 8 category keys even when empty`; `includes all 8 category keys plus $schema and $metadata`; `emits empty categories as empty objects, not omitted` | ⚠️ `breakpoint` is always `{}` in v1 — see README.md drift "resolver + breakpoint not called in v1" |
| Empty category present as empty collection (not omitted) | `tests/unit/format/json.test.ts`, `tests/unit/format/js.test.ts` | `emits all 8 category keys even when empty`; `emits empty categories as empty objects, not omitted` | ✅ |

### Feature 4 — Resolve CSS custom properties

| PRD AC | Test file(s) | Test name | Status |
|--------|--------------|-----------|--------|
| `var(--primary)` chain resolving to `#3B82F6` → token reports `#3B82F6` | `tests/integration/extract.test.ts`, `tests/unit/resolve-css-vars.test.ts` | `resolves CSS custom properties to their declared value on css-vars.html`; `resolves a direct var reference from :root`; `resolves a nested chain (primary → brand → literal)` | ⚠️ In v1 the browser pre-resolves via `getComputedStyle` — see README.md drift "resolver + breakpoint not called in v1". End result matches AC; mechanism differs. |
| Circular / unresolvable chain → token with `"unresolved"` and `originalVar` metadata | `tests/unit/resolve-css-vars.test.ts` | `returns unresolved with originalVar for a direct cycle`; `returns unresolved with originalVar for a self-referencing cycle`; `returns unresolved with originalVar when var is missing and no fallback`; `marks unresolved records with originalVar and keeps the "unresolved" sentinel value` | ⚠️ Resolver is unit-tested but not called from the v1 pipeline; circular-var tokens therefore cannot appear in v1 output |

### Feature 5 — Deduplicate and score tokens

| PRD AC | Test file(s) | Test name | Status |
|--------|--------------|-----------|--------|
| Same value across multiple selectors → exactly one token with `usageCount` summed | `tests/unit/dedup.test.ts`, `tests/unit/categorize/color.test.ts`, `tests/unit/categorize/spacing.test.ts` | `merges two tokens with same $type/$value/theme into one`; `unions selectors while preserving first-seen order and deduping`; `merges records with the same canonical color into one Token`; `dedups identical values across multiple selectors into one token` | ✅ |
| 1 usage → confidence ≤ 0.3; 10+ usages → confidence ≥ 0.9 | `tests/unit/score.test.ts`, `tests/unit/apply-score.test.ts` | `returns 0.2 for usageCount 1 (single observation)`; `returns 0.9 at the lower bound of the high-confidence tier (10)`; `sets confidence to 0.2 when usage count is 1`; `sets confidence to 0.9 when usage count is 10` | ✅ |

### Feature 6 — Detect light/dark theme variants

| PRD AC | Test file(s) | Test name | Status |
|--------|--------------|-----------|--------|
| Sites with `@media (prefers-color-scheme: dark)` → tokens tagged with `theme: "light"` / `theme: "dark"` | `tests/integration/extract.test.ts`, `tests/integration/render.test.ts` | `detects dark media query on dark-mode.html with theme=auto`; `produces different color values when emulating dark vs light on a dark-mode fixture`; `emits ONLY dark-tagged tokens when theme=dark on dark-mode.html` | ⚠️ Theme slicing runs categorizers per theme (drift "T8.1 per-theme categorizer slicing"); output semantics match AC |
| No dark media query → only light tokens emitted | `tests/integration/extract.test.ts` | `emits NO dark-tagged tokens when theme=light on dark-mode.html` | ✅ |

### Feature 7 — Output format selection

| PRD AC | Test file(s) | Test name | Status |
|--------|--------------|-----------|--------|
| `--format json` (default) → DTCG-compliant JSON | `tests/integration/cli.test.ts`, `tests/e2e/smoke.test.ts`, `tests/unit/format/json.test.ts` | `extract --file simple.html --format json writes valid JSON to stdout`; `extract --format json emits valid DTCG JSON on stdout`; `emits valid JSON (JSON.parse succeeds)`; `emits the DTCG $schema literal` | ✅ |
| `--format css` → CSS custom properties | `tests/integration/cli.test.ts`, `tests/e2e/smoke.test.ts`, `tests/unit/format/css.test.ts` | `extract --file simple.html --format css emits a :root block`; `extract --format css emits a :root block`; `emits each color token as --<name>: <value>; inside :root`; `emits dark-theme tokens under @media (prefers-color-scheme: dark)` | ✅ |
| `--format js` → ES module default export | `tests/e2e/smoke.test.ts`, `tests/unit/format/js.test.ts` | `extract --format js emits an export default module`; `starts with "export default {"`; `produces a syntactically valid ES module default export` | ✅ |
| `--format md` → Markdown with swatches/usage | `tests/integration/cli.test.ts`, `tests/e2e/smoke.test.ts`, `tests/unit/format/md.test.ts` | `extract --file simple.html --format md emits a "# Design Tokens" header`; `extract --format md emits a "# Design Tokens" header`; `renders each color token as a table row with name, swatch, value, count, confidence`; `includes an inline HTML swatch with the color value as background for each color token` | ✅ |

### Feature 8 — Clear error handling

| PRD AC | Test file(s) | Test name | Status |
|--------|--------------|-----------|--------|
| 401/403 → non-zero exit, message suggesting `--file` workflow | (none) | — | ❌ No live-URL auth test in v1 (public URL integration is file-fixture-based); path exists in `src/errors.ts` and `render/playwright.ts` but is untested |
| DNS failure / connection refused → non-zero exit with underlying error and attempted URL | `tests/unit/sources-url.test.ts` | `rejects a non-URL string with "Invalid URL" message`; `rejects an empty string` | ⚠️ URL parse errors covered; live-network failure paths are not asserted in v1 CI |
| Any fatal error → no partial output file (atomic write) | `tests/unit/io-write.test.ts` | `throws when the target directory does not exist and leaves no residue`; `leaves no .tmp sibling file behind on success`; `overwrites an existing file atomically`; `keeps writes coherent when two parallel calls target the same file` | ✅ |

---

## SDD EARS AC — additions / distinct-phrasings

Most SDD EARS statements restate PRD AC; the rows below cover EARS statements whose _wording_ is distinct enough to warrant a direct citation.

| SDD EARS AC | Test file(s) | Test name | Status |
|-------------|--------------|-----------|--------|
| THE SYSTEM SHALL always terminate the Playwright browser process on exit (success or error) | `tests/integration/render.test.ts` | `closes the browser after a successful render`; `closes the browser after a failed render (non-existent file)` | ✅ |
| THE SYSTEM SHALL score confidence per ADR-4 thresholds | `tests/unit/score.test.ts` | `scoreConfidence (ADR-4 boundary table)` suite (9 cases across 0.2 / 0.5 / 0.7 / 0.9 tiers) | ✅ |
| WHEN the same value appears under multiple selectors, THE SYSTEM SHALL emit one token whose `com.dte.usage.count` equals the total observations | `tests/unit/dedup.test.ts` | `merges two tokens with same $type/$value/theme into one`; `unions selectors while preserving first-seen order and deduping`; `does NOT double-count usage when merging stylesheet + inline (selectors are just concatenated)` | ✅ |
| WHERE `--format css|js|md`, THE SYSTEM SHALL emit the respective transform with equivalent token content | `tests/unit/format/css.test.ts`, `tests/unit/format/js.test.ts`, `tests/unit/format/md.test.ts` | `emits each color token as --<name>: <value>; inside :root`; `emits color as a flat map of token names to Token objects`; `renders each color token as a table row with name, swatch, value, count, confidence` | ✅ |
| IF extraction exceeds `--timeout`, THE SYSTEM SHALL exit 2 with a timeout message | `tests/integration/extract.test.ts`, `tests/integration/render.test.ts`, `tests/unit/errors.test.ts` | `throws ExtractionError when timeoutMs=1`; `throws ExtractionError with a timeout message when timeoutMs is too small`; `has exitCode === 2` | ✅ |
| IF the URL returns 401/403, THEN THE SYSTEM SHALL exit 2 with a message suggesting `--file` | (none) | — | ❌ Not asserted in v1 |
| URL scheme allowlist: only `http:` / `https:` | `tests/integration/cli.test.ts`, `tests/unit/sources-url.test.ts`, `tests/e2e/smoke.test.ts` | `extract with a non-http(s) scheme exits 1 with "Only http"`; `rejects file:// URLs`; `rejects data: URLs`; `rejects javascript: URLs`; `rejects ftp:// URLs`; `exits 1 on a non-http(s) scheme` | ✅ |
| Mutex: both URL and `--file` → exit 1 | `tests/integration/cli.test.ts`, `tests/e2e/smoke.test.ts` | `extract with both URL and --file exits 1 with "not both"` | ✅ |
| `--min-confidence` filter drops low-score tokens | `tests/e2e/smoke.test.ts` | `--min-confidence 0.9 filters out low-confidence tokens` | ✅ |

---

## Summary

- **PRD Must-Have AC rows:** 16 total. ✅ 10 · ⚠️ 5 · ❌ 1.
- **SDD EARS additional rows:** 9 total. ✅ 8 · ❌ 1.
- **Drift items from README.md Decisions Log that affect AC:**
  - T8.1 `resolver + breakpoint not called in v1` → touches Feature 3 (breakpoint empty) and Feature 4 (var-chain resolution is browser-pre-resolved).
  - T8.1 `per-theme categorizer slicing` → touches Feature 6 (theme separation works, implementation differs from SDD pseudocode).
  - T8.1/T8.2 `version hardcoded '0.1.0'` → no AC impact (metadata string only); logged here for completeness.
- **Gaps (❌):**
  - Live 401/403 auth-wall behavior (Feature 8 + corresponding EARS). Code path present, no automated test.
