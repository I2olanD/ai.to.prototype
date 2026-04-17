---
name: extract-tokens
description: Extract design tokens (colors, typography, spacing, shadows, etc.) from any public URL or local HTML file into a W3C DTCG JSON file. Uses the `design-token-extractor` CLI under headless Chromium. Useful before running `/prototype` against a reference site, or for auditing your own design system.
user-invocable: true
argument-hint: "[url | --file path] [--format json|css|js|md] [--out path] [--min-confidence 0..1] [--theme auto|light|dark]"
license: MIT
metadata:
  contract-version: "1.0"
  author: ai.to.design
---

# Extract Tokens

Extract design tokens from a rendered page (URL or local HTML file) and write them to disk as W3C DTCG JSON, CSS custom properties, JavaScript, or Markdown.

## Arguments

- `$ARGUMENTS` — target URL (`https://...`) or `--file <path>` for a local HTML file
- `--format <fmt>` — output format: `json` (default), `css`, `js`, `md`
- `--out <path>` — output file path (default: `.design-tokens/tokens.<ext>`)
- `--min-confidence <num>` — drop tokens below this confidence score 0..1 (default: `0`)
- `--theme <mode>` — `auto` (default — both light + dark when detected), `light`, or `dark`
- `--timeout <seconds>` — extraction timeout (default: 60)

## Pre-flight

**Check the CLI is available** before doing anything else. Run exactly one of:

```bash
command -v design-token-extractor >/dev/null 2>&1 && echo installed || echo missing
```

- If `installed`: proceed.
- If `missing`: prefer `npx design-token-extractor` for the invocation (no install required). On first run `npx` will fetch the package. Also remind the user that Playwright's Chromium must be installed once:

  ```bash
  npx playwright install chromium
  ```

**Never** silently `npm install -g` on the user's machine. If they want it installed globally, tell them the command and let them run it.

## Invocation

Build a single `design-token-extractor extract ...` (or `npx design-token-extractor extract ...`) command with the provided flags. Default output directory is `.design-tokens/` at the project root.

```bash
# URL, JSON (default)
npx design-token-extractor extract https://example.com --out .design-tokens/tokens.json

# Local file, CSS vars
npx design-token-extractor extract --file ./reference.html --format css --out .design-tokens/tokens.css

# Dark theme only, filter low-confidence
npx design-token-extractor extract https://example.com --theme dark --min-confidence 0.5 --out .design-tokens/tokens.dark.json
```

**Create the output directory** before running if `--out` points to a subdir that doesn't exist:

```bash
mkdir -p .design-tokens
```

**Exit codes:**

- `0` — success
- `1` — user error (bad URL, missing file, conflicting flags)
- `2` — extraction failure (timeout, auth wall, network)
- `3` — internal error

Do not retry automatically on non-zero exit. Report the exact stderr to the user and suggest the next step (e.g., `--file` for auth-walled sites, `--timeout 120` for slow pages).

## Output

The tool writes a W3C DTCG-compatible structure with these top-level keys:

- `color` — every normalized color (hex / rgba / hsl / gradients)
- `typography` — subcategories `family`, `size`, `weight`, `lineHeight`, `letterSpacing`
- `spacing` — paddings, margins, gaps
- `radius` — border-radius values
- `shadow` — box/text shadows verbatim
- `zIndex` — numeric stacking values
- `breakpoint` — media-query breakpoints (currently empty in v1; populated from source-CSS parsing is a future enhancement)
- `motion` — subcategories `duration`, `easing`

Each token has:

- `$value` — canonical value
- `$type` — DTCG type tag
- `$extensions["com.dte.usage"]` — `{ selectors: [...], count: N }`
- `$extensions["com.dte.confidence"]` — 0.2 / 0.5 / 0.7 / 0.9 stepwise score based on usage count
- `$extensions["com.dte.theme"]` — `"light"` or `"dark"` when detected

## After Extraction

1. **Summarize** — report counts per category (e.g., "Extracted 12 colors, 4 font sizes, 8 spacing values, 3 shadows") and where the file landed.

2. **Offer next steps:**
   - "Inspect the file" — open the output path
   - "Use with `/prototype`" — if the user plans to prototype against this token set, point to `/prototype` and suggest passing `--style` hints that reference the extracted palette
   - "Commit or ignore" — ask whether the user wants `.design-tokens/` in the repo or added to `.gitignore`

3. **Do not modify source code** automatically. Tokens are reference data, not wired configuration. If the user asks to apply them (e.g., generate a Tailwind config from the CSS variables), that's a separate step.

## Failure modes

| Stderr contains            | Cause                               | Recommendation to user                                       |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `File not found`           | bad `--file` path                   | Check spelling / relative path                               |
| `Only http:// or https://` | unsupported scheme                  | Use http(s) URL or `--file` for local                        |
| `requires authentication`  | 401/403 auth wall                   | Save the rendered page locally, then `--file`                |
| `timed out after`          | slow site                           | Retry with `--timeout 120`, or save locally and use `--file` |
| `Renderer crashed`         | Playwright / Chromium issue         | Re-run `npx playwright install chromium`, retry              |
| `ENEEDAUTH` / `EOTP`       | user tried `npm publish` (not this) | Out of scope                                                 |

## Relation to `/prototype`

The `/prototype` skill scans `package.json` and style files to match your project's design language. If you want to match a reference site's tokens, run `/extract-tokens <url>` first, then reference the generated tokens file when invoking `/prototype`:

```
/extract-tokens https://linear.app --format css --out .design-tokens/linear.css
/prototype "pricing table" --style "match tokens in .design-tokens/linear.css"
```

The prototype skill will read the file and use the tokens as visual cues.
