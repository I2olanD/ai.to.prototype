# design-token-extractor

A one-command CLI that extracts a W3C DTCG-compatible design token set from any public website or local HTML file.

## Install

```bash
npm i -g design-token-extractor
npx playwright install chromium
```

Requires Node.js >= 18. The Chromium download is a one-time ~200 MB.

## Usage

### Extract from a URL

```bash
design-token-extractor extract https://example.com --out tokens.json
```

### Extract from a local HTML file (bypasses auth walls)

```bash
design-token-extractor extract --file ./page.html --out tokens.json
```

### Output formats

```bash
# W3C DTCG JSON (default) — canonical
design-token-extractor extract https://example.com --format json --out tokens.json

# CSS custom properties under :root (+ @media prefers-color-scheme: dark)
design-token-extractor extract https://example.com --format css --out tokens.css

# ES module exporting a default object
design-token-extractor extract https://example.com --format js  --out tokens.js

# Markdown with color swatches and usage tables
design-token-extractor extract https://example.com --format md  --out tokens.md
```

### Filter low-confidence tokens

Each token is scored 0..1 based on how many selectors use it. Drop one-offs:

```bash
design-token-extractor extract https://example.com --min-confidence 0.5
```

### Theme emulation

```bash
design-token-extractor extract https://example.com --theme auto    # default; emits both if dark rules exist
design-token-extractor extract https://example.com --theme light
design-token-extractor extract https://example.com --theme dark
```

## Output shape (DTCG)

Tokens follow the [W3C Design Tokens Community Group](https://tr.designtokens.org/format/) draft. Each token is a `$value / $type / $extensions` envelope:

```json
{
  "color": {
    "color-1": {
      "$value": "#3b82f6",
      "$type": "color",
      "$extensions": {
        "com.dte.usage": { "selectors": ["button.primary", "a"], "count": 12 },
        "com.dte.confidence": 0.9,
        "com.dte.source": "stylesheet",
        "com.dte.theme": "light"
      }
    }
  }
}
```

Top-level keys (always present, empty when no tokens observed): `color`, `typography`, `spacing`, `radius`, `shadow`, `zIndex`, `breakpoint`, `motion`.

## Exit codes

| Code | Meaning |
|------|---------|
| `0`  | Success |
| `1`  | User error — bad URL, missing file, invalid flag |
| `2`  | Extraction failure — timeout, 401/403, DNS, connection refused |
| `3`  | Internal error |

No partial output file is written on failure (atomic temp + rename).

## Current limitations (v1)

- **No authentication.** Public URLs only. Use `--file` with a saved rendered HTML for auth-walled sites.
- **No source CSS parsing.** Token values come from `getComputedStyle`, which the browser has already resolved. `var()` chains are pre-resolved before we see them, so the `resolve/css-vars.ts` module is kept for v2 but unused in v1 output.
- **Breakpoints not extracted from live renders.** `TokenSet.breakpoint` is always emitted as `{}` in v1 — the renderer does not surface stylesheet text, so the `@media` walker has nothing to consume.
- **`$metadata.version` is hardcoded `"0.1.0"`** instead of being injected from `package.json` at build time.
- **Per-theme slicing** — categorizers run once per theme and results are concatenated, rather than the single-pass described in the SDD pseudocode. Output is equivalent; implementation differs.
- **Playwright Chromium required.** The `--fast` (static-only) flag is accepted but not implemented in v1 — a warning is printed and the headless renderer is used.

## Spec

See the full specification, ADRs, and decisions log at [`docs/specs/001-design-token-extractor/`](../../docs/specs/001-design-token-extractor/).

## License

MIT
