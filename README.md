# ai.to.prototype

A toolkit for AI-assisted UI design - concept work, design-token extraction, and rapid component prototyping with an in-browser variant picker.

Ships as a Claude Code / OpenCode plugin bundling three skills, plus a standalone CLI for design-token extraction.

## Quick Start

Get from zero to a token file in about 60 seconds.

```bash
# 1. Install the CLI (Node.js >= 18 required)
npm i -g @ai.to.design/design-token-extractor

# 2. Install the headless browser (one-time, ~200 MB)
npx playwright install chromium

# 3. Extract tokens from any public site
design-token-extractor extract https://example.com --out tokens.json
```

You will see an `Extracting design tokens...` spinner, then `✔ Done`, and a `tokens.json` file is written to the current directory.

See [Example Outputs](#example-outputs) for what that file contains, and [Troubleshooting](#troubleshooting) if the first run fails.

## What's in the box

### Skills (plugin)

| Skill | Slash command | What it does |
|-------|---------------|--------------|
| `prototype` | `/prototype` | Generates multiple structurally distinct prototypes of a UI component, wrapped in an in-browser variant picker so you can flip through them. Scans your project to match framework and design language. |
| `extract-tokens` | `/extract-tokens` | Extracts design tokens (colors, typography, spacing, radius, shadow, motion) from any public URL or local HTML file into W3C DTCG JSON, CSS variables, JS, or Markdown. Wraps the `design-token-extractor` CLI under headless Chromium. |
| `application-design-concept` | (auto-invoked) | Develops design concepts, visual identities, and design systems with a real point of view. Moves through brief → position → system → audit → showcase to counter generic AI design output. |

### CLI (`packages/design-token-extractor`)

A standalone Node CLI (`design-token-extractor`) that produces a W3C DTCG-compatible token set from any public website or local HTML file. The `extract-tokens` skill wraps it; you can also use it directly. See [`packages/design-token-extractor/README.md`](packages/design-token-extractor/README.md).

## Install

### Quick Install

```bash
npx skills add I2olanD/ai.to.prototype
```

### Alternative Install

```bash
git clone https://github.com/I2olanD/ai.to.prototype.git
cd ai.to.prototype
./install.sh
```

Auto-detects Claude Code and OpenCode, installs for all found tools.

### Manual Install

#### Claude Code

```bash
claude plugin marketplace add I2olanD/ai.to.prototype
claude plugin install ai-to-prototype@ai-to-prototype
```

#### OpenCode

Copy the skill folders you want from `plugin/skills/` into one of OpenCode's [skill directories](https://opencode.ai/docs/skills/):

**Project-local** (scoped to one project):
```
.opencode/skills/<skill-name>/
```

**Global** (available in all projects):
```
~/.config/opencode/skills/<skill-name>/
```

Each skill folder must contain `SKILL.md`; `prototype` and `application-design-concept` also include a `references/` subfolder that must be copied alongside.

### CLI (standalone)

```bash
npm i -g @ai.to.design/design-token-extractor
npx playwright install chromium
```

The `extract-tokens` skill will fall back to `npx @ai.to.design/design-token-extractor` if the CLI is not installed globally.

## Usage

### `/prototype` - generate UI variants

```
/prototype "hero section"
/prototype "pricing table" --variants 6 --style minimalist
/prototype "testimonial cards" --framework tailwind
```

Flags: `--variants N` (2–9, default 4), `--style <direction>`, `--framework <name>`.

What it does:

1. Scans your project for framework and design language (Next.js, React, Vue, Svelte, Astro, Tailwind, shadcn/ui, MUI, Chakra, etc.), and uses `.design-tokens/` files or a design-concept brief if you have one
2. Prints a variant plan (layout, density, emphasis, tone per variant), then generates structurally distinct variants - different layouts, not just color swaps
3. Puts them on a dedicated prototype route (e.g. `app/prototype/pricing-table/page.tsx`) unless you name a target file, with a variant picker toolbar to flip through them
4. Exposes each variant's key colors, spacing, and motion values as **Jigs**: live controls in the toolbar with animation replay in slow motion, and a Copy button so the tuned values go back into the code
5. Screenshots every variant at mobile and desktop width (via Playwright, when available) and fixes layout problems before handing over
6. Lets you refine the winner, run an explore round of new variants within its direction, or finalize: extract just that variant into a real component and strip all picker scaffolding and the prototype route

The picker remembers your selection across reloads, and `?aitd=<n>` opens variant `n` directly.

### `/extract-tokens` - pull a design token set

```
/extract-tokens https://linear.app
/extract-tokens https://stripe.com --format css --out .design-tokens/stripe.css
/extract-tokens --file ./reference.html --theme dark --min-confidence 0.5
```

Flags: `--format json|css|js|md` (default `json`), `--out <path>`, `--min-confidence 0..1`, `--theme auto|light|dark`, `--timeout <seconds>`.

Output covers `color`, `typography`, `spacing`, `radius`, `shadow`, `zIndex`, `breakpoint`, `motion`, each token wrapped in W3C DTCG `$value` / `$type` / `$extensions` envelopes with usage count, confidence score, and detected theme.

### `application-design-concept` - concept and system work

Auto-invoked when you ask for a design concept, visual direction, design system, brand language, mood, aesthetic direction, theme, design tokens, style guide, art direction, or visual identity - anything upstream of writing components.

Walks through five stages: **Brief** (who, what, why, what feeling) → **Position** (one anchor, what we reject) → **System** (typography, color, spacing, motion, voice, components) → **Audit** (anti-slop sweep + human-touch check) → **Showcase** (optional proof artifact). References include an aesthetic-lineages catalog, a concept-brief template, an anti-slop checklist, and a design-system spec template.

### Combined flow

```
/extract-tokens https://linear.app --format css --out .design-tokens/linear.css
/prototype "pricing table" --style "match tokens in .design-tokens/linear.css"
```

## Example Outputs

Each token is a W3C DTCG `$value` / `$type` / `$extensions` envelope.
The `$extensions` carry a `com.dte.confidence` score and a `com.dte.usage` block with the `selectors` that use the token and their `count`.

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
  },
  "typography": {
    "size": {
      "font-size-1": {
        "$value": 16,
        "$type": "dimension",
        "$extensions": {
          "com.dte.usage": { "selectors": ["body"], "count": 1 },
          "com.dte.confidence": 0.8,
          "com.dte.source": "stylesheet",
          "com.dte.theme": "light"
        }
      }
    },
    "family": {},
    "weight": {}
  }
}
```

Eight top-level categories are always present (empty when no tokens are observed): `color`, `typography`, `spacing`, `radius`, `shadow`, `zIndex`, `breakpoint`, `motion`.

Four output formats are available via `--format`: `json` (default), `css`, `js`, and `md`.

See [`packages/design-token-extractor/README.md`](packages/design-token-extractor/README.md) for the full output reference, including css, js, and md samples.

## Real World Use Cases

### Audit before a design-system migration

Capture a confidence-filtered baseline of your current site and commit it, so you can diff against it as the migration progresses.

```bash
design-token-extractor extract https://our-site.com --min-confidence 0.5 --out baseline.json
```

### Match a reference brand, then prototype

Pull a reference brand's tokens as CSS, then generate components that match them.

```bash
design-token-extractor extract https://linear.app --format css --out .design-tokens/linear.css
```

```
/prototype "pricing table" --style "match tokens in .design-tokens/linear.css"
```

### Extract from an auth-walled or bot-blocking site

Save the rendered page to a local HTML file and extract from that, bypassing login walls and headless-browser blocks.

```bash
design-token-extractor extract --file ./page.html --out tokens.json
```

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI, or
- [OpenCode](https://opencode.ai)
- Node.js >= 18 (for the `design-token-extractor` CLI used by `/extract-tokens`)

## Troubleshooting

The CLI uses these exit codes: `0` success, `1` user error (bad flag, URL, or file), `2` extraction or network failure, `3` internal error.

| Symptom | Fix |
|---------|-----|
| Browser error or "Executable doesn't exist" on first run | Run `npx playwright install chromium` (the most common first-run miss). |
| "Extraction timed out after 60s" | Raise the limit with `--timeout 120`, or use `--file` on a saved page. |
| "Refusing to navigate to private host ..." | Add `--allow-private-hosts` for localhost or internal IPs. |
| Site blocks headless browsers or needs login | Save the page and use `--file ./page.html`. |
| ENOENT / EACCES writing output | Ensure the `--out` parent directory exists and is writable. |

## Roadmap

Planned for v2 (not yet implemented, alongside the current v1 limitations):

- Source-CSS parsing: resolve `var()` chains and populate breakpoint tokens from `@media` rules (today the extractor reads computed styles only, so `breakpoint` is empty).
- `--fast` static-only mode: skip the Chromium download for simple static pages (the flag is accepted today but warns and falls back to the headless renderer).
- `--user-agent` override: currently reserved and ignored.

Both packages (`design-token-extractor` and `prototype`) release in lockstep at the same version.

## Security

The `/prototype` variant picker script is loaded from a versioned URL (`https://ai-to-design.com/runtime/<version>/prototype.min.js`) with a Subresource Integrity hash. If your project uses a Content Security Policy, add `https://ai-to-design.com` to `script-src` while prototyping. Remove it after finalizing your chosen variant.

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

## License

MIT
