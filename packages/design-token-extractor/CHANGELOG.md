# Changelog

All notable changes to `design-token-extractor` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-17

Initial release — spec [`001-design-token-extractor`](../../docs/specs/001-design-token-extractor/).

### Added

- `extract` CLI subcommand with URL positional argument and `--file` flag (mutually exclusive).
- Output formats: `--format json` (default, W3C DTCG canonical), `--format css` (`:root` + `@media (prefers-color-scheme: dark)`), `--format js` (ES module default export), `--format md` (Markdown with color swatches and usage tables).
- `--out <path>` for file output; otherwise stdout.
- `--theme auto|light|dark` with Playwright `emulateMedia({ colorScheme })`. `auto` emits both themes when dark rules are detected.
- `--min-confidence <num>` post-extract filter (0..1).
- `--timeout <seconds>` for the extraction budget (default 60).
- Confidence scoring per ADR-4: `>=10 → 0.9`, `>=5 → 0.7`, `>=2 → 0.5`, else `0.2`.
- Value-indexed deterministic naming per ADR-3 (`color-1`, `color-2`, ... sorted by usage DESC, tie-break by value string).
- Headless rendering via Playwright Chromium — post-render DOM walk via `page.evaluate` for computed-style capture.
- Atomic file writes (temp file + rename) so fatal errors never leave a partial output file.
- Eight DTCG category buckets always emitted (empty when no tokens): `color`, `typography`, `spacing`, `radius`, `shadow`, `zIndex`, `breakpoint`, `motion`.
- Deterministic exit codes: `0` success, `1` user error, `2` extraction failure, `3` internal error.
- URL scheme allowlist (`http:`, `https:` only) — rejects `file:`, `data:`, `javascript:`, `ftp:` at parse.
- Zod validation at CLI boundary (`CliOptions`) and output boundary (`TokenSet`).

### Known limitations

- **Resolver not wired in v1.** `resolve/css-vars.ts` is retained and unit-tested, but the renderer delivers computed styles with `var()` already resolved by the browser — so the resolver is not called in the pipeline. Original `var` names are therefore not preserved in `$extensions`.
- **`breakpoint` always empty in v1.** The renderer does not surface stylesheet text to the categorizer, so `@media` queries cannot be walked. `TokenSet.breakpoint = {}`. Module kept for v2.
- **`$metadata.version` hardcoded `"0.1.0"`.** Build-time injection via tsup `define` is deferred to Phase 9.
- **Per-theme categorizer slicing.** The SDD pseudocode merges light+dark records and categorizes once; categorizers group by canonical value only and would collapse theme tags. Implementation runs categorizers per theme and concatenates — output semantics match, algorithm differs.

[0.1.0]: https://github.com/rolandwallner/ai.to.prototype/releases/tag/design-token-extractor-v0.1.0
