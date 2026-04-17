# Specification: 001-design-token-extractor

## Status

| Field | Value |
|-------|-------|
| **Created** | 2026-04-17 |
| **Current Phase** | Implemented v0.1.0 (2026-04-17) |
| **Last Updated** | 2026-04-17 |

## Documents

| Document | Status | Notes |
|----------|--------|-------|
| product-requirements.md | completed | 8 must-have features, full MoSCoW, Gherkin AC |
| solution-design.md | completed | 6 ADRs confirmed; pipeline architecture; EARS AC |
| implementation-plan.md | completed | 10 phases (0–9), TDD throughout, parallel marks |
| AC-MATRIX.md | completed | 24/25 AC covered; 5 ⚠️ drift-qualified; 1 ❌ (auth-wall deferred) |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-17 | Spec ID 001 (not 004) | `spec.py` auto-assigned. Research doc labelled "spec-004" is historical tag, not spec ID. |
| 2026-04-17 | Run full PRD → SDD → PLAN | User chose recommended path. CLI currently stub; need proper spec before impl. |
| 2026-04-17 | ADR-1 Playwright chromium | User confirmed. Over Puppeteer: `emulateMedia` for theme, auto-wait, future multi-browser. |
| 2026-04-17 | ADR-2 W3C DTCG draft format | User confirmed. Output canonical format; version stamped in `$metadata`. |
| 2026-04-17 | ADR-3 Value-indexed naming | User confirmed. Deterministic `color-N` ordered by usage DESC, tie-break by value string. |
| 2026-04-17 | ADR-4 Stepwise confidence | User confirmed. ≥10→0.9; ≥5→0.7; ≥2→0.5; else 0.2. Per research §6. |
| 2026-04-17 | ADR-5 Zod at boundaries | Derived from CLAUDE.md (validate at boundaries). CliOptions parse + TokenSet pre-write. |
| 2026-04-17 | ADR-6 No barrel exports | Enforced by CLAUDE.md. Flat `src/**` with explicit imports. |
| 2026-04-17 | Scope: CLI only (no SaaS) | Research doc mentioned SaaS + API endpoint + rate limiting. PRD Won't-Have excludes — package is CLI-only. |
| 2026-04-17 | T0.2 drift: `eslint.config.js` (flat) replaces `.eslintrc.json` | ESLint v9 requires flat config. PLAN assumed legacy `.eslintrc.json`. Functional parity, no scope change. |
| 2026-04-17 | T0.4 drift: added `passWithNoTests: true` to vitest config | Vitest exits 1 on empty suites. Needed to satisfy Phase 0 green baseline before Phase 1 tests arrive. |
| 2026-04-17 | T1.2 drift: added `typescript-eslint@^8` devDep | Mid-Phase-1 discovery: ESLint v9 flat-config default Espree parser fails on TS syntax (`readonly`, `type`). Added unified `typescript-eslint` package to parse TS. No source code changes. |
| 2026-04-17 | T3.1/T3.2 drift: `extractInPageFromGlobals` self-contained | Page.evaluate serializes function body only; top-level consts (`PROPERTIES`, helpers) unreachable in browser context. Duplicated inside function body. `extractInPage(doc,win,theme)` kept for jsdom unit tests. |
| 2026-04-17 | T8.1 drift: resolver + breakpoint not called in v1 | Computed styles pre-resolve `var()` (no scope map available); render doesn't surface stylesheet text. `TokenSet.breakpoint = {}` in v1. Modules kept intact for v2. |
| 2026-04-17 | T8.1 drift: per-theme categorizer slicing | SDD pseudocode merges records then categorizes once. Categorizers group by canonical value only — would collapse theme tags. Run per-theme, concat. |
| 2026-04-17 | T8.1/T8.2 drift: version hardcoded `'0.1.0'` | `$metadata.version` FIXME for Phase 9 tsup `define` build-time injection. |

## Context

Source: `.research/spec-004-design-extractor-research.md` (2026-04-15).

Package `packages/design-token-extractor/` scaffolded with commander/cheerio/postcss/ora deps. `src/cli.ts` is 1-line stub. Deps missing for headless render (no puppeteer/playwright).

Research defines 5 personas, 8 user stories, 9 token categories, 10 acceptance criteria, 12 edge cases. v1 scope = URL + local file input; computed-style extraction via headless browser; JSON/CSS/JS/MD output; confidence scoring; light/dark detection.

---
*Managed by specification-management skill.*
