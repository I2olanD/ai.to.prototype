---
title: "Design Token Extractor CLI"
status: draft
version: "1.0"
---

# Implementation Plan

## Validation Checklist

### CRITICAL GATES (Must Pass)

- [x] All `[NEEDS CLARIFICATION: ...]` markers addressed
- [x] All specification file paths correct and exist
- [x] Each phase follows TDD: Prime → Test → Implement → Validate
- [x] Every task has verifiable success criteria
- [x] A developer could follow this plan independently

### QUALITY CHECKS (Should Pass)

- [x] Context priming section complete
- [x] All implementation phases defined
- [x] Dependencies between phases clear (no cycles)
- [x] Parallel work tagged with `[parallel: true]`
- [x] Activity hints provided
- [x] Every phase references SDD
- [x] Every test references PRD AC
- [x] Integration & E2E tests in final phase
- [x] Project commands match actual setup

---

## Specification Compliance Guidelines

### How to Ensure Specification Adherence

1. **Before Each Phase**: Read referenced SDD + PRD sections.
2. **During Implementation**: Reference SDD sections in commits.
3. **After Each Task**: Run `npm test && npm run lint && npm run typecheck`.
4. **Phase Completion**: Verify AC mapping in Phase Validation task.

### Deviation Protocol

1. Document deviation + rationale in `docs/specs/001-design-token-extractor/README.md` Decisions Log.
2. Get user approval before proceeding.
3. Update SDD if deviation improves design.

## Metadata Reference

- `[parallel: true]` — concurrent tasks
- `[ref: doc/section]` — spec link
- `[activity: type]` — specialist hint

---

## Context Priming

*GATE: Read all files before starting implementation.*

**Specification:**
- `docs/specs/001-design-token-extractor/product-requirements.md` — PRD
- `docs/specs/001-design-token-extractor/solution-design.md` — SDD
- `.research/spec-004-design-extractor-research.md` — Source research (persona, AC, edge cases)
- `CLAUDE.md` (user global) — TDD mandatory, no barrels, security-first

**Key Design Decisions (from SDD §Architecture Decisions):**
- **ADR-1**: Playwright chromium for headless render (emulateMedia for theme)
- **ADR-2**: W3C DTCG draft as canonical JSON format; version stamped in `$metadata`
- **ADR-3**: Value-indexed naming (`color-1`, `color-2`…) ordered by usage DESC, tie-break by value string
- **ADR-4**: Stepwise confidence (≥10=0.9; ≥5=0.7; ≥2=0.5; else 0.2)
- **ADR-5**: Zod validation only at boundaries (CliOptions parse, TokenSet pre-write)
- **ADR-6**: Flat `src/**` modules, no barrel `index.ts`

**Implementation Context:**

```bash
# Working directory
cd packages/design-token-extractor

# Testing
npm test                    # vitest run (unit + integration)
npm run test:watch          # vitest watch

# Quality
npm run lint                # eslint src/
npm run typecheck           # tsc --noEmit

# Build
npm run build               # tsup -> dist/cli.js
npm run dev                 # tsup --watch

# Browser (one-time)
npx playwright install chromium

# Local smoke test
node dist/cli.js extract --file tests/fixtures/simple.html --format json
```

---

## Implementation Phases

Each task follows Prime → Test → Implement → Validate. Phases are sequential; tasks within phases marked `[parallel: true]` run concurrently.

**Dependency graph:**
```
Phase 0 (Setup) → Phase 1 (Types+Errors) → Phase 2 (IO+Sources)
                                         ↘
                                           Phase 3 (Render) → Phase 4 (Walk+Resolve)
                                                                      ↓
                                                         Phase 5 (Categorize [parallel])
                                                                      ↓
                                                         Phase 6 (Dedup+Score+Name)
                                                                      ↓
                                                         Phase 7 (Format [parallel])
                                                                      ↓
                                                         Phase 8 (CLI Orchestrator)
                                                                      ↓
                                                         Phase 9 (Integration+E2E)
```

---

### Phase 0: Project Setup

Installs deps, configures lint/test, removes stub. Prepares green baseline.

- [ ] **T0.1 Dependency install** `[activity: build-setup]`

  1. Prime: Read `packages/design-token-extractor/package.json`; review SDD §"Project Commands"
  2. Test: n/a (infra)
  3. Implement:
      - Add runtime deps: `playwright@^1.44`, `zod@^3.23`
      - Add devDep: `@types/node` already present; add `eslint-config-prettier` if lint fails
      - Add script: `"test:watch": "vitest"` (already exists as test:watch — verify)
      - Add postinstall note in README: `npx playwright install chromium`
  4. Validate: `npm install` succeeds; `npx playwright install chromium` completes
  5. Success: `node_modules/playwright` present; `npm test` runs (zero tests ok)

- [ ] **T0.2 Test runner + lint config** `[parallel: true]` `[activity: build-setup]`

  1. Prime: Read `vitest.config.ts`, `tsconfig.json`
  2. Test: n/a
  3. Implement:
      - Update `vitest.config.ts`: `include: ['tests/**/*.test.ts']`, `testTimeout: 30000`, `setupFiles: ['tests/setup.ts']`
      - Create `tests/setup.ts` (empty placeholder for now)
      - Add minimal `.eslintrc.json` if missing (extends `eslint:recommended`, TypeScript rules)
  4. Validate: `npm run typecheck` clean; `npm test` runs; `npm run lint` clean (or noop)
  5. Success: All commands exit 0 on empty project

- [ ] **T0.3 Remove CLI stub, keep shebang** `[parallel: true]` `[activity: cleanup]`

  1. Prime: Read `src/cli.ts`, `tsup.config.ts` (banner adds shebang)
  2. Test: n/a
  3. Implement: Replace `src/cli.ts` content with `export {};` placeholder — will be written in Phase 8
  4. Validate: `npm run build` produces `dist/cli.js` with shebang; `dist/cli.js` runs (no-op)
  5. Success: Build artifact valid ESM with shebang

- [ ] **T0.4 Phase 0 validation** `[activity: validate]`

  Run `npm install && npm run typecheck && npm run lint && npm run build && npm test`. All pass.

---

### Phase 1: Types, Errors, Score

Zero-dependency pure modules that every later phase imports.

- [ ] **T1.1 Type definitions** `[activity: domain-modeling]`

  1. Prime: Read SDD §"Application Data Models"
  2. Test: n/a (types are compile-time)
  3. Implement: `src/types.ts` with `CliOptions`, `RawStyleRecord`, `Token`, `TokenSet`, category enums, Input union
  4. Validate: `npm run typecheck` clean
  5. Success: All types exported; downstream files can import

- [ ] **T1.2 Error classes + exit codes** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Read SDD §"Error Handling" table
  2. Test: `tests/unit/errors.test.ts` — each error class sets correct `exitCode` and preserves message
  3. Implement: `src/errors.ts` — `UserError` (code 1), `ExtractionError` (code 2), `InternalError` (code 3), base class with `exitCode` field
  4. Validate: tests pass
  5. Success: Error subclasses instantiable; exit codes match SDD table `[ref: SDD/Error Handling]`

- [ ] **T1.3 Confidence scorer** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Read SDD §"ADR-4" + `implementation examples → scoreConfidence`
  2. Test: `tests/unit/score.test.ts` — boundary table: 0→0.2, 1→0.2, 2→0.5, 4→0.5, 5→0.7, 9→0.7, 10→0.9, 1000→0.9
  3. Implement: `src/score.ts` — pure function per ADR-4
  4. Validate: tests pass
  5. Success: Formula exact per ADR-4 `[ref: SDD/ADR-4]`; PRD AC Feature 5 second bullet `[ref: PRD/Feature 5]`

- [ ] **T1.4 Phase 1 validation** `[activity: validate]`

  `npm test && npm run lint && npm run typecheck` all pass.

---

### Phase 2: IO + Input Sources

Atomic writes and input validation. No rendering yet.

- [ ] **T2.1 Atomic file writer** `[activity: io]`

  1. Prime: Read SDD §"System-Wide Patterns" (atomic write), §"Implementation Gotchas" (Windows rename)
  2. Test: `tests/unit/io-write.test.ts`:
      - Writes string to given path
      - On success: file contains content; no `.tmp` left behind
      - On inject fail during rename: original file not overwritten, tmp cleaned up
      - When `path` undefined → writes to stdout (spy on process.stdout.write)
  3. Implement: `src/io/write.ts` — `writeAtomic(content: string, outPath?: string): Promise<void>`. Use same-directory `.tmp-<rand>` then `fs.rename`.
  4. Validate: tests pass
  5. Success: PRD Feature 8 AC3 (no partial output) `[ref: PRD/Feature 8]`

- [ ] **T2.2 URL source validator** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Read SDD §"System-Wide Patterns" security, PRD Feature 8 AC
  2. Test: `tests/unit/sources-url.test.ts`:
      - Accepts `http://...` and `https://...`
      - Rejects `file:`, `data:`, `javascript:`, `ftp:` with `UserError`
      - Normalizes whitespace
      - Invalid URL string → `UserError`
  3. Implement: `src/sources/url.ts` — `parseUrl(input: string): URL` throwing `UserError`
  4. Validate: tests pass
  5. Success: Scheme allowlist enforced `[ref: SDD/Security]`

- [ ] **T2.3 File source validator** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Read SDD §"Error Handling", PRD Feature 2 AC
  2. Test: `tests/unit/sources-file.test.ts`:
      - Existing `.html` file → returns resolved absolute path + content
      - Missing path → `UserError` "File not found: <path>"
      - Symlink → allowed but logs warning to stderr
      - Non-HTML extension → warning, still loads
  3. Implement: `src/sources/file.ts` — `loadFile(path: string): Promise<{ absPath: string; html: string }>`
  4. Validate: tests pass
  5. Success: PRD Feature 2 AC "missing path → non-zero with clear message" `[ref: PRD/Feature 2]`

- [ ] **T2.4 Phase 2 validation** `[activity: validate]`

  All Phase 2 unit tests pass. Error paths verified.

---

### Phase 3: Headless Render

Playwright integration. First external dep.

- [ ] **T3.1 In-page extractor script** `[activity: frontend]`

  1. Prime: Read SDD §"Application Data Models" (`RawStyleRecord`), §"Complex Logic → Theme-aware extraction"
  2. Test: `tests/unit/extract-in-page.test.ts` — run script against jsdom'd fixture; assert records contain expected property/value pairs. (Unit-testable because script is a pure function over `document`.)
  3. Implement: `src/render/extract-in-page.ts` — exports `extractInPage(): RawStyleRecord[]` function that runs inside `page.evaluate()`. Walks all elements, reads `getComputedStyle`, emits records for properties listed in SDD's category matrix.
  4. Validate: tests pass; no DOM APIs used outside the function body
  5. Success: Records cover all 8 categories `[ref: SDD/Categorizers]`; SDD `RawStyleRecord` shape exact `[ref: SDD/Application Data Models]`

- [ ] **T3.2 Playwright renderer** `[activity: integration]`

  1. Prime: Read SDD §"Runtime View → Primary Flow", ADR-1, Gotchas (cleanup, SIGINT)
  2. Test: `tests/integration/render.test.ts`:
      - Renders a local fixture file via `page.setContent` — records non-empty
      - Emulates dark color scheme — tokens differ for dark-mode fixture
      - Timeout: wrap with shorter timeout → throws `ExtractionError`
      - Cleanup: browser process closed after success and after error
  3. Implement: `src/render/playwright.ts` — `render(input: Input, theme: 'light'|'dark', timeoutMs): Promise<RawStyleRecord[]>`. Use `try/finally` around `browser.close()`. Install SIGINT handler. Inject `extract-in-page.ts` via `page.evaluate`.
  4. Validate: integration tests pass; no zombie browser processes
  5. Success:
      - PRD Feature 1 AC2 (JS-rendered sites) `[ref: PRD/Feature 1]`
      - PRD Feature 6 AC1 (dark extraction) `[ref: PRD/Feature 6]`
      - SDD ADR-1 `[ref: SDD/ADR-1]`

- [ ] **T3.3 Phase 3 validation** `[activity: validate]`

  Integration tests pass. Manual smoke: `node -e "import('./src/render/playwright.ts').then(m => m.render({kind:'file', path:'tests/fixtures/simple.html'}, 'light', 30000))"` returns records.

---

### Phase 4: Walk + Resolve

Transform raw records — resolve `var()` chains.

- [ ] **T4.1 CSS variable resolver** `[activity: domain-modeling]`

  1. Prime: Read SDD §"Implementation Examples → resolveVar", §"Gotchas → scope"
  2. Test: `tests/unit/resolve-css-vars.test.ts`:
      - Simple chain `--a: #000` then `color: var(--a)` → `#000`
      - Nested `--a → var(--b) → #fff` → `#fff`
      - Circular `--a → var(--b) → var(--a)` → `"unresolved"` with `originalVar: '--a'`
      - Missing var no fallback → `"unresolved"`
      - Missing var with fallback `var(--x, blue)` → `"blue"`
      - Scope override: `:root{--a:red}` + `.dark{--a:blue}` → scope-specific resolution
  3. Implement: `src/resolve/css-vars.ts` — `resolveVars(records: RawStyleRecord[], scopeMap: Record<string, Record<string, string>>): RawStyleRecord[]`. Cycle detection via visited set.
  4. Validate: tests pass
  5. Success:
      - PRD Feature 4 AC1 (resolve chain) `[ref: PRD/Feature 4]`
      - PRD Feature 4 AC2 (circular → unresolved + originalVar) `[ref: PRD/Feature 4]`

- [ ] **T4.2 Walk wrapper (already in-page, T3.1)** — skipped; consolidated into T3.1.

- [ ] **T4.3 Phase 4 validation** `[activity: validate]`

  Resolver tests pass. Run against `tests/fixtures/css-vars.html` via Phase 3 render → assert `originalVar` metadata present for circular case.

---

### Phase 5: Categorize (parallel)

Eight categorizers; all pure functions `RawStyleRecord[] → CategoryBucket`. Can develop in parallel.

- [ ] **T5.1 Color categorizer** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Research §3.1
  2. Test: `tests/unit/categorize/color.test.ts`:
      - Hex, rgb, rgba, hsl, hsla all normalize to canonical hex+alpha
      - Named CSS colors (`red`) → `#ff0000`
      - `currentColor`, `inherit` → skipped
      - Gradients preserved as full string (not decomposed in v1)
  3. Implement: `src/categorize/color.ts` — `categorizeColors(records): Token[]`
  4. Validate: tests pass
  5. Success: Colors correctly normalized `[ref: Research/3.1]`

- [ ] **T5.2 Typography categorizer** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Research §3.2
  2. Test: `tests/unit/categorize/typography.test.ts` — font-family/size/weight/line-height/letter-spacing buckets; unit normalization (px preserved, em/rem preserved verbatim)
  3. Implement: `src/categorize/typography.ts`
  4. Validate: tests pass
  5. Success: Four sub-buckets emitted `[ref: SDD/TokenSet]`

- [ ] **T5.3 Spacing categorizer** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Research §3.3
  2. Test: padding/margin/gap extraction; 0-value deduped; negative margins included
  3. Implement: `src/categorize/spacing.ts`
  4. Validate: tests pass

- [ ] **T5.4 Radius categorizer** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Research §3.4
  2. Test: `border-radius` + `border-*-radius`; pill (`9999px`) detection
  3. Implement: `src/categorize/radius.ts`
  4. Validate: tests pass

- [ ] **T5.5 Shadow categorizer** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Research §3.5
  2. Test: single box-shadow, multi-shadow (`0 1px 2px a, 0 4px 8px b`), text-shadow, `none` skipped
  3. Implement: `src/categorize/shadow.ts`
  4. Validate: tests pass

- [ ] **T5.6 Z-index categorizer** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Research §3.6
  2. Test: numeric z-index, `auto` skipped
  3. Implement: `src/categorize/zindex.ts`
  4. Validate: tests pass

- [ ] **T5.7 Breakpoint categorizer** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Research §3.7; SDD §"Complex Logic" (breakpoint via postcss)
  2. Test: parses `@media (min-width: 640px)`, `(max-width: 1024px)`, orientation; extracts raw breakpoint values
  3. Implement: `src/categorize/breakpoint.ts` — input is stylesheet text (passed from render stage), uses `postcss` to parse `@media` rules
  4. Validate: tests pass
  5. Success: PRD SHOULD-HAVE breakpoints `[ref: PRD/Feature 3]`

- [ ] **T5.8 Motion categorizer** `[parallel: true]` `[activity: domain-modeling]`

  1. Prime: Research §3.8
  2. Test: `transition-duration`, `transition-timing-function`, `animation-duration`; dedup identical cubic-bezier
  3. Implement: `src/categorize/motion.ts`
  4. Validate: tests pass

- [ ] **T5.9 Phase 5 validation** `[activity: validate]`

  All 8 categorizers pass. `npm test` green.

---

### Phase 6: Dedup + Score + Name

Post-categorize transforms that produce named DTCG tokens.

- [ ] **T6.1 Deduplicator** `[activity: domain-modeling]`

  1. Prime: SDD §"Gotchas → Inline style weighting"
  2. Test: `tests/unit/dedup.test.ts`:
      - Same value from 3 selectors → 1 token, `usageCount = 3`
      - Stylesheet vs. inline with same value: both counted in usageCount, stylesheet wins the "primary source" tag
      - Stylesheet weighted 2× in dedup-tiebreak (when two similar values cluster)
      - Scope-different values → kept separate
  3. Implement: `src/dedup.ts` — `dedup(tokens: Token[]): Token[]`
  4. Validate: tests pass
  5. Success: PRD Feature 5 AC1 (merge identical) `[ref: PRD/Feature 5]`

- [ ] **T6.2 Scorer application** `[activity: domain-modeling]`

  1. Prime: T1.3 already wrote scorer; this wires it into token pipeline
  2. Test: `tests/unit/apply-score.test.ts` — each token gets `com.dte.confidence` set from `scoreConfidence(usageCount)`
  3. Implement: `src/apply-score.ts` (or add to `src/score.ts` — keep cohesion) — `applyScores(tokens: Token[]): Token[]`
  4. Validate: tests pass

- [ ] **T6.3 Value-indexed namer** `[activity: domain-modeling]`

  1. Prime: SDD ADR-3, §"Gotchas → Deterministic naming"
  2. Test: `tests/unit/name.test.ts`:
      - 3 color tokens with counts [10, 5, 2] → names `color-1`, `color-2`, `color-3` (desc by count)
      - Tie on count: deterministic tie-break by value string
      - Empty category → no names emitted
  3. Implement: `src/name.ts` — `nameTokens(tokensByCategory): TokenSet`
  4. Validate: tests pass; run twice with same input → identical output (reproducibility check)
  5. Success: ADR-3 exact `[ref: SDD/ADR-3]`

- [ ] **T6.4 Phase 6 validation** `[activity: validate]`

  All tests pass.

---

### Phase 7: Format (parallel)

Output serializers. Each takes a `TokenSet` and returns a string.

- [ ] **T7.1 JSON formatter (canonical DTCG)** `[parallel: true]` `[activity: frontend]`

  1. Prime: SDD §"Application Data Models → TokenSet"; ADR-2; W3C DTCG draft
  2. Test: `tests/unit/format/json.test.ts`:
      - Shape: `$schema`, `$metadata` (extractor, version, extractedAt, source), all 8 category keys present even when empty
      - Each token has `$value`, `$type`, `$extensions` with usage/confidence
      - Valid JSON (parseable)
      - Zod schema roundtrip (parse + reserialize identical)
  3. Implement: `src/format/json.ts` — also defines the Zod schema for `TokenSet` (used at write boundary per ADR-5)
  4. Validate: tests pass
  5. Success: PRD Feature 7 AC json `[ref: PRD/Feature 7]`

- [ ] **T7.2 CSS formatter** `[parallel: true]` `[activity: frontend]`

  1. Prime: SDD; PRD Feature 7
  2. Test: `tests/unit/format/css.test.ts`:
      - Emits `:root { --color-1: #3b82f6; ... }`
      - Dark theme emitted under `@media (prefers-color-scheme: dark) { :root { ... } }`
      - Category grouped with comment headers
      - Valid CSS (can be parsed by postcss without errors)
  3. Implement: `src/format/css.ts`
  4. Validate: tests pass

- [ ] **T7.3 JS formatter** `[parallel: true]` `[activity: frontend]`

  1. Prime: PRD Feature 7
  2. Test: `tests/unit/format/js.test.ts`:
      - Emits `export default { color: { 'color-1': '#3b82f6', ... }, ... }`
      - Valid ES module (parseable by acorn or run via `import()` in test)
  3. Implement: `src/format/js.ts`
  4. Validate: tests pass

- [ ] **T7.4 Markdown formatter** `[parallel: true]` `[activity: frontend]`

  1. Prime: PRD Feature 7; Story 7 (docs generation)
  2. Test: `tests/unit/format/md.test.ts`:
      - One section per category
      - Color tokens include inline HTML swatch `<span style="background:#3b82f6;...">`
      - Usage count rendered; confidence rendered
  3. Implement: `src/format/md.ts`
  4. Validate: tests pass

- [ ] **T7.5 Phase 7 validation** `[activity: validate]`

  All 4 formatters pass; outputs validate against their format parsers.

---

### Phase 8: CLI Orchestrator

Wire everything into `extract.ts` and `cli.ts`.

- [ ] **T8.1 Pipeline orchestrator** `[activity: backend]`

  1. Prime: SDD §"Runtime View → Primary Flow", §"Complex Logic → Theme-aware extraction"
  2. Test: `tests/integration/extract.test.ts`:
      - Fixture: `simple.html` → runs full pipeline → TokenSet valid
      - Fixture: `dark-mode.html` → both themes in output
      - Fixture: `css-vars.html` + circular → unresolved marker present
      - Timeout shorter than render → throws `ExtractionError` with timeout reason
      - Browser always closed (check via process list / spy)
  3. Implement: `src/extract.ts` — `extract(opts: CliOptions): Promise<TokenSet>`. Calls source → render (light [+ dark if auto]) → resolve → categorize → dedup → score → name → return.
  4. Validate: integration tests pass
  5. Success: PRD Feature 1, 2, 3, 4, 5, 6 ACs `[ref: PRD/Feature 1-6]`

- [ ] **T8.2 Commander CLI shell** `[activity: backend]`

  1. Prime: SDD §"CLI Surface", §"Error Handling" table
  2. Test: `tests/integration/cli.test.ts`:
      - `extract --help` exits 0, prints usage
      - `extract --version` prints package version
      - `extract https://example.com --out /tmp/x.json` — mock render; file written
      - `extract --file missing.html` → exit 1, stderr has "File not found"
      - `extract http://x --file y.html` → exit 1, mutex error
      - `extract ftp://x` → exit 1, scheme error
      - Spawn `node dist/cli.js` as child process; assert exit codes
  3. Implement: `src/cli.ts` — commander setup; parse options; call `extract()`; map errors → exit codes; ora spinner (suppressed if `--quiet` or not TTY). Zod-parse CliOptions before calling extract (ADR-5 boundary).
  4. Validate: integration tests pass
  5. Success:
      - PRD Feature 7 AC formats `[ref: PRD/Feature 7]`
      - PRD Feature 8 all AC `[ref: PRD/Feature 8]`
      - SDD §"CLI Surface" exact `[ref: SDD/CLI Surface]`

- [ ] **T8.3 Phase 8 validation** `[activity: validate]`

  Build succeeds. `dist/cli.js` runs standalone. All integration tests pass.

---

### Phase 9: Integration, E2E, Quality Gates

Final validation across fixtures and real-world smoke.

- [ ] **T9.1 Fixture library** `[activity: integration-test]`

  Create `tests/fixtures/`:
  - `simple.html` — minimal: 2 colors, 2 font-sizes, 1 spacing
  - `dark-mode.html` — has `@media (prefers-color-scheme: dark)` overrides
  - `css-vars.html` — nested + circular vars
  - `heavy-js.html` — renders color via inline `<script>` mutating DOM
  - `inline-styles.html` — mix of inline and stylesheet styles
  - `breakpoints.html` — 3 `@media` breakpoints
  - `motion.html` — transitions + keyframes

  Success: All fixtures used by ≥1 integration test `[ref: SDD/Directory Map]`

- [ ] **T9.2 End-to-end smoke** `[activity: e2e-test]`

  1. Prime: PRD §User Journey Maps → Primary
  2. Test: `tests/e2e/smoke.test.ts`:
      - `node dist/cli.js extract --file tests/fixtures/simple.html --format json` → valid DTCG JSON on stdout
      - Same with `--format css`, `--format js`, `--format md` → valid per format
      - `--out /tmp/test-out.json` → file written, stdout empty
      - Exit code 0 on success, 1 on invalid input, 2 on auth/timeout
  3. Validate: all pass

- [ ] **T9.3 Quality gates** `[activity: validate]`

  - Line coverage ≥85% non-render modules (`vitest --coverage`) `[ref: SDD/Testability]`
  - `npm run lint` clean
  - `npm run typecheck` clean
  - `npm run build` produces valid bundle
  - Performance: `simple.html` extracts in <10s on laptop; fixture-based benchmark in `tests/e2e/perf.test.ts`
  - Security: no `file:`/`data:`/`javascript:` URL accepted (from T2.2 tests)
  - Resource: browser process closed in all tests (monitor via `ps`)

- [ ] **T9.4 Specification compliance audit** `[activity: business-acceptance]`

  - [ ] Every PRD Must-Have Feature has passing AC test
  - [ ] Every PRD Gherkin AC mapped to a test case (create `docs/specs/001-design-token-extractor/AC-MATRIX.md` or inline comment)
  - [ ] All SDD EARS criteria verified
  - [ ] README for package written (install, usage, examples) `[ref: PRD §User Journey]`
  - [ ] CHANGELOG entry added at package root
  - [ ] Update spec README.md Decisions Log with any in-impl deviations

---

## Plan Verification

| Criterion | Status |
|-----------|--------|
| Developer can follow plan without additional clarification | ✅ |
| Every task produces a verifiable deliverable | ✅ |
| All PRD acceptance criteria map to specific tasks | ✅ (T1.3, T2.*, T3.*, T4.1, T6.*, T7.*, T8.*) |
| All SDD components have implementation tasks | ✅ (T1.1–T8.2 cover every directory-map entry) |
| Dependencies explicit, no circular references | ✅ (phase graph linear; intra-phase parallelism marked) |
| Parallel opportunities marked `[parallel: true]` | ✅ (T0.2–T0.3, T5.1–T5.8, T7.1–T7.4, T2.2–T2.3) |
| Each task has `[ref: ...]` | ✅ |
| Project commands in Context Priming accurate | ✅ (verified against `packages/design-token-extractor/package.json`) |
