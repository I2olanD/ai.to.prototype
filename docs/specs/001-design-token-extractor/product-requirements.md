---
title: "Design Token Extractor CLI"
status: draft
version: "1.0"
---

# Product Requirements Document

## Validation Checklist

### CRITICAL GATES (Must Pass)

- [x] All required sections are complete
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Problem statement is specific and measurable
- [x] Every feature has testable acceptance criteria (Gherkin format)
- [x] No contradictions between sections

### QUALITY CHECKS (Should Pass)

- [x] Problem is validated by evidence (research doc + 5 personas)
- [x] Context → Problem → Solution flow makes sense
- [x] Every persona has at least one user journey
- [x] All MoSCoW categories addressed (Must/Should/Could/Won't)
- [x] Every metric has corresponding tracking events
- [x] No feature redundancy
- [x] No technical implementation details (deferred to SDD)
- [x] A new team member could understand this PRD

---

## Product Overview

### Vision
A one-command CLI that extracts a W3C DTCG–compatible design token set from any public website or local HTML file in under 60 seconds, so developers and designers stop hand-copying colors and measurements from rendered pages.

### Problem Statement
Teams currently extract design tokens from live sites by manually inspecting elements, copying hex values, and guessing scale patterns. Research (`.research/spec-004-design-extractor-research.md` §1) documents 2–4 hours per extraction across 5 personas, with error rates high enough that migration audits catch only ~60% of edge cases. Consequences: slow MVP delivery, design drift against brand guidelines, reinvented tokens across client projects, and shadow design systems.

### Value Proposition
- **Speed:** extraction in <2 minutes vs. 2–4 hours manual
- **Accuracy:** computed DOM styles capture what renders, not what source claims
- **Framework-agnostic:** works on any site regardless of Tailwind/Sass/CSS-in-JS/minified CSS
- **Portable output:** DTCG JSON + CSS vars + JS + Markdown drop into any design system tooling
- **Confidence scoring:** lets users distinguish real tokens from one-off values

## User Personas

### Primary Persona: Startup Developer
- **Demographics:** Junior–mid full-stack dev, early-stage startup, comfortable with CLI tooling.
- **Goals:** Ship an MVP quickly matching a proven site's visual polish.
- **Pain Points:** 2–4h manual extraction per competitor site; inconsistent token naming; error-prone copy-paste.

### Secondary Personas

**Enterprise Designer (Brand Consistency):** Design lead auditing dev compliance with brand tokens. Pain: devs ignore brand guidelines; compliance audit is manual.

**Design System Migrator:** Tech lead mapping legacy tokens to new system. Pain: migrations take weeks; 40% of edge cases missed in manual review.

**Agency Integrator:** Designer at agency building client microsites. Pain: clients can't articulate their tokens; reimplements same tokens across projects.

**Design System Auditor:** Design engineer detecting drift and undocumented patterns. Pain: gradual drift invisible without tooling; hard to justify refactor.

## User Journey Maps

### Primary User Journey: Extract tokens from a live site
1. **Awareness:** Developer needs to match a site's visual style without manual inspection.
2. **Consideration:** Considers Chrome DevTools copy-paste, Figma plugins, hand-writing CSS. Rejects: slow or requires design tool access.
3. **Adoption:** Installs CLI via `npm i -g design-token-extractor`; runs one command against the URL.
4. **Usage:** `design-token-extractor extract https://example.com --format json --out tokens.json`; waits ≤60s; reviews `tokens.json` with confidence scores.
5. **Retention:** Reuses tool per-project; integrates into onboarding scripts and audit pipelines.

### Secondary User Journeys

**Audit journey (Enterprise Designer):** Runs `extract` against own site → compares output against documented tokens → flags shadow tokens.

**Migration journey (Migrator):** Runs `extract` against old URL and new URL → diffs outputs → produces migration mapping.

**Offline journey (Agency + auth-walled sites):** Saves rendered HTML locally → runs `extract --file ./page.html` → bypasses auth wall.

## Feature Requirements

### Must Have Features

#### Feature 1: Extract from public URL
- **User Story:** As a developer, I want to run `extract <url>` so that I get a complete token set in one command.
- **Acceptance Criteria:**
  - [ ] Given a reachable public URL, When the user runs `extract <url>`, Then the CLI exits 0 within 60 seconds and writes valid DTCG JSON to the chosen output.
  - [ ] Given a site that requires JavaScript to render, When extraction runs, Then the CLI renders via headless browser and captures styles present in the post-render DOM.
  - [ ] Given extraction exceeds 60 seconds, When the timeout fires, Then the CLI exits non-zero with message `Extraction timed out after 60s — consider --file or --fast`.

#### Feature 2: Extract from local HTML file
- **User Story:** As a user behind an auth wall, I want to extract from a saved HTML file so that I can capture tokens without giving credentials to the tool.
- **Acceptance Criteria:**
  - [ ] Given a local `.html` file path, When the user runs `extract --file ./page.html`, Then the CLI loads it in a headless context and extracts as if it were a live URL.
  - [ ] Given a missing file path, When run, Then CLI exits non-zero with a clear `File not found` error.

#### Feature 3: Extract token categories
- **User Story:** As a designer, I want colors, typography, spacing, radius, shadows, z-index, breakpoints, and motion extracted by default so that I have a complete token set.
- **Acceptance Criteria:**
  - [ ] Given a rendered site, When extraction runs with defaults, Then output contains keys for each of: `color`, `typography`, `spacing`, `radius`, `shadow`, `zIndex`, `breakpoint`, `motion`.
  - [ ] Given a category with zero observed tokens, When output is written, Then the category key is present with an empty collection (not omitted).

#### Feature 4: Resolve CSS custom properties
- **User Story:** As a developer, I want `var(--primary)` chains resolved to their computed color so that my tokens hold concrete values.
- **Acceptance Criteria:**
  - [ ] Given a CSS variable chain resolving to `#3B82F6`, When a button uses `color: var(--primary)`, Then the extracted token reports value `#3B82F6`.
  - [ ] Given a circular or unresolvable `var()` chain, When extraction runs, Then the token is emitted with value `"unresolved"` and an `originalVar` metadata field.

#### Feature 5: Deduplicate and score tokens
- **User Story:** As an auditor, I want identical values merged and each token scored for confidence so that I can prioritize which to formalize.
- **Acceptance Criteria:**
  - [ ] Given the same color value used by multiple selectors, When output is written, Then exactly one token is emitted with `usageCount` summing all occurrences.
  - [ ] Given a token used 1 time, When scored, Then `confidence ≤ 0.3`. Given 10+ usages, Then `confidence ≥ 0.9`.

#### Feature 6: Detect light/dark theme variants
- **User Story:** As a design system dev, I want light and dark tokens extracted separately so that theme switching works correctly.
- **Acceptance Criteria:**
  - [ ] Given a site with `@media (prefers-color-scheme: dark)` overrides, When extraction runs, Then output separates tokens under `theme: "light"` and `theme: "dark"` with matching token names.
  - [ ] Given no dark mode media query, When extraction runs, Then only `theme: "light"` is emitted (no empty dark section).

#### Feature 7: Output format selection
- **User Story:** As a user, I want to pick output format so that the tokens drop into my existing tooling.
- **Acceptance Criteria:**
  - [ ] Given `--format json` (default), When extraction completes, Then DTCG-compliant JSON is written to `--out` path or stdout.
  - [ ] Given `--format css`, Then CSS custom properties are written (e.g., `--color-primary: #3B82F6;`).
  - [ ] Given `--format js`, Then an ES module exporting a default object of tokens is written.
  - [ ] Given `--format md`, Then Markdown with swatches/usage examples is written.

#### Feature 8: Clear error handling
- **User Story:** As a user, I want helpful errors when extraction cannot proceed so that I know what to do next.
- **Acceptance Criteria:**
  - [ ] Given a URL returning HTTP 401/403, When extraction runs, Then CLI exits non-zero with message suggesting `--file` workflow.
  - [ ] Given a DNS failure or connection refused, Then CLI exits non-zero with the underlying network error and the attempted URL.
  - [ ] Given any fatal error, Then no partial output file is written (atomic write semantics).

### Should Have Features

- **Confidence filter flag:** `--min-confidence 0.5` to drop low-score tokens from output.
- **Cluster similar values:** group near-identical grays/colors with a recommendation to consolidate.
- **Comparison mode:** `extract --compare urlA urlB` produces a diff report of shared vs. divergent tokens.
- **Component pattern detection (basic):** identify button/input/card variants with selectors and core CSS.
- **Progress indicator:** ora spinner with stage labels (fetching, rendering, extracting, writing).

### Could Have Features

- Interaction state variants (`:hover`, `:focus`, `:active`).
- Motion token deduplication across transitions.
- Inline-style warning when >X% of styles are inline.
- @font-face metadata fetching for font-family identification.
- Framework detection (Tailwind/Bootstrap) for config enrichment.

### Won't Have (This Phase)

- Authentication/cookie injection for protected URLs (v2).
- Multi-theme support beyond light/dark (v2).
- Source code / source-map parsing (v2).
- Figma, Sketch, XD file imports (v2).
- AI-powered semantic naming (v2).
- Accessibility/WCAG contrast audits (v2).
- Component code generation (React/Vue/Svelte) (v2).
- SaaS backend, hosted API, rate limiting, data retention (CLI-only scope).
- Storybook/Figma push integrations (v2).
- Batch/multi-URL single-run processing (v2).

## Detailed Feature Specifications

### Feature: Extract from public URL

**Description:** The flagship command loads a URL in a headless browser, waits for network idle + DOM ready, walks rendered nodes, collects computed styles, resolves CSS variables, deduplicates values, scores confidence, and writes the chosen output format.

**User Flow:**
1. User runs `design-token-extractor extract https://example.com --out tokens.json`.
2. CLI validates URL, starts headless browser, navigates.
3. CLI waits for `networkidle` + ~2s settle (configurable).
4. CLI walks DOM, reads computed styles for each node.
5. CLI resolves `var()` chains via `:root` and scoped overrides.
6. CLI detects `prefers-color-scheme: dark` rules; re-extracts under dark emulation.
7. CLI deduplicates, scores, serializes to chosen format.
8. CLI writes atomically to `--out` or stdout; prints summary (`N colors, M typography, …`).

**Business Rules:**
- Rule 1: Headless browser always closes on exit (success or error) — no leaked processes.
- Rule 2: Timeout defaults to 60s; configurable via `--timeout <seconds>`.
- Rule 3: Output is atomic — write to temp file, rename on success.
- Rule 4: Exit codes: `0` success, `1` user error (bad URL/file/flag), `2` extraction failure (timeout/auth/network), `3` internal error.
- Rule 5: When both `<url>` and `--file` supplied, CLI exits 1 with conflict error.

**Edge Cases:**
- Heavy JS render → solved by headless render + wait-for-networkidle.
- Auth wall (401/403) → actionable error; suggest `--file`.
- Inconsistent design (47 grays) → low confidence scores + optional cluster recommendations.
- Dark mode present → separate theme sections.
- CSS-in-JS / Sass / minified → computed-style extraction is framework-agnostic.
- CSS var shadowing (`--primary` redefined in scope) → extract all scopes with usage context.
- Inline styles mixed with stylesheet → track source, weight stylesheet 2× in dedup.
- Utility-first (Tailwind) → computed styles still work; framework config parsing deferred.
- @font-face fonts → extract `font-family` string as-is; best-effort file-type detection.
- Mobile-first vs. desktop-first media queries → extract raw, infer strategy from `min-` vs. `max-width` majority.
- Interaction states (`:hover`, `:focus`) → extract as state-variant tokens (should-have).
- Motion tokens used 2+ times → emit as tokens; 1× usage remains low-confidence.

## Success Metrics

### Key Performance Indicators

- **Adoption:** weekly `npm` install count ≥200 within 3 months of release (observable via npm stats).
- **Engagement:** time-to-first-output (TTFO) ≤2 minutes measured in user-reported telemetry opt-in.
- **Quality:** ≥90% of extractions complete in <30s on a curated 10-site benchmark; ≥90% token-coverage vs. manual baseline.
- **Business Impact:** ≥60% of users run the extractor more than once in a month (indicates integration into workflow).

### Tracking Requirements

Telemetry is **opt-in** (`--telemetry on` or env var). No data retention server-side in v1 — local log only, sent only if user explicitly runs `--send-report`.

| Event | Properties | Purpose |
|-------|------------|---------|
| `extract.started` | mode (`url`/`file`), format | Measure adoption and input mix |
| `extract.completed` | duration_ms, tokenCount, categories_nonempty | TTFO, coverage |
| `extract.failed` | reason (`timeout`/`auth`/`network`/`internal`), duration_ms | Error-rate KPI |
| `extract.output_written` | format, byteSize | Format-mix insight |
| `cli.version` | version | Understand upgrade velocity |

---

## Constraints and Assumptions

### Constraints
- **Node ≥18** (per `package.json:engines`).
- **CLI only** — no hosted backend in v1 (scopes out rate limiting, auth, data retention).
- **Public URLs only** — auth/cookie injection is v2.
- **60-second soft budget** — informed by research §4 AC10 ("90% of sites extract in <30s").
- Must output **W3C DTCG-compatible** JSON as canonical format.
- **No telemetry without opt-in** (GDPR-aligned; research §6 "GDPR-compliant").

### Assumptions
- Users have Node 18+ and can `npm install -g`.
- Target sites are reachable from user's machine (no special VPC/VPN requirement).
- Headless browser install is acceptable overhead (~200MB one-time).
- Users accept best-effort extraction — tokens may need hand-naming post-extraction.
- Sites follow enough CSS convention that computed styles are meaningful (not entirely canvas-rendered).

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Headless browser install size deters adoption | High | Medium | Offer `--fast` static-only mode that skips browser for simple sites; document trade-offs |
| Sites detect headless browser and block | Medium | Medium | Set realistic UA; allow `--user-agent` override; document limitation |
| Token output format churns (DTCG spec evolves) | Medium | Low | Pin to stated DTCG version; document format version in output |
| Extraction is slow (>60s) on real sites | High | Medium | Configurable timeout; `--fast` mode; clear timeout error with next-step guidance |
| Low-confidence noise overwhelms users | Medium | High | Default `--min-confidence 0.3` filter; clustering recommendations (should-have) |
| Malicious URL exploits browser (SSRF, file://) | High | Low | Validate scheme is `http(s)`; disable `file://` unless via `--file` flag; sandbox browser per Playwright defaults |

## Open Questions

- [ ] Playwright vs. Puppeteer for headless rendering? (Decision goes in SDD.)
- [ ] DTCG spec version to target? (Current draft or v1.0.)
- [ ] Naming strategy: auto-name (e.g., `color-1`, `color-2`) or leave unnamed with value-only keys? (Auto-name proposed; confirm.)
- [ ] Confidence formula exact thresholds: use research §6 proposal (1=0.2, 2–5=0.5, 5–10=0.7, 10+=0.9) or tune?

---

## Supporting Research

### Competitive Analysis
- **Chrome DevTools copy-paste:** manual, slow, error-prone. No dedup, no scoring.
- **Figma/Tokens Studio plugins:** require design-tool access; cannot extract from live sites.
- **Project Wallace, CSS Stats:** web-only, no CLI, incomplete for tokens (stats-oriented).
- **Unique differentiator:** CLI + DTCG-native + computed-style + framework-agnostic.

### User Research
Full persona/story/AC/edge-case research: `.research/spec-004-design-extractor-research.md` (2026-04-15, 12 edge cases, 10 AC, 5 personas, 8 stories).

### Market Data
Design systems tooling market growing (Figma $20B acquisition, Tokens Studio, Style Dictionary, Supernova). DTCG spec gaining traction as neutral exchange format. No dominant CLI-first extractor exists — greenfield niche.
