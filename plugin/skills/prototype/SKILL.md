---
name: prototype
description: Generate multiple visually distinct UI component prototypes with an in-browser variant picker to flip through them. Scans your project's design dependencies to match your design language.
user-invocable: true
argument-hint: "[component description] [--variants N] [--style direction] [--framework name]"
license: MIT
metadata:
  contract-version: "1.0"
  author: ai.to.design
---

# Prototype

Generate multiple visually distinct prototypes of a UI component, wrapped in a variant picker that lets you flip through them in the browser.

## Arguments

- `$ARGUMENTS` — the component description (e.g., "hero section", "pricing table", "testimonial cards")
- `--variants N` — number of variants to generate (default: 4, min: 2, max: 9)
- `--style [direction]` — style constraint (e.g., "minimalist", "bold", "corporate", "playful")
- `--framework [name]` — force a CSS framework (e.g., "tailwind", "plain-css")

## Before Generating

**Scan the project to determine the rendering framework and design language:**

1. Read `package.json` — identify the rendering framework (Next.js, React, Vue, Svelte, Astro, etc.) and UI libraries (shadcn/ui, @radix-ui, @mui/material, @chakra-ui, antd, daisyui, etc.)
2. Check for `tailwind.config.*` — if present, use Tailwind CSS utility classes
3. Look for CSS variables, design tokens, or theme files in `src/` or `styles/`
4. Check for existing component patterns in the project to match naming and structure conventions
5. Identify the project's routing convention (e.g., `app/` for Next.js App Router, `pages/` for Pages Router, `src/routes/` for SvelteKit)
6. Look for explicit design inputs and treat them as the source of truth, ahead of anything inferred from dependencies:
   - token files from `/extract-tokens` (default location `.design-tokens/`)
   - a concept brief or design-system spec produced by the `application-design-concept` skill
   - a file the user names in `--style` (e.g., `--style "match tokens in .design-tokens/linear.css"`)

Use what you find. Match the project's framework, styling approach, and component patterns. If you can't determine the stack, fall back to a standalone HTML file with scoped CSS.

## Variant Plan

Before writing any code, decide what makes each variant different and print it as a table, one row per variant, across four axes:

| # | Label | Layout structure | Density | Emphasis | Visual tone |
|---|-------|------------------|---------|----------|-------------|
| 1 | Centered Stack | single centered column | airy | headline first | quiet, monochrome |
| 2 | Split Media | 50/50 image + copy | balanced | image first | warm, photographic |

- No two variants may share the same **layout structure**. If you run out of genuinely different structures, generate fewer variants and say so.
- The **Label** column becomes each variant's `data-aitd-label`.
- Print the plan and continue straight to generation. Don't wait for approval; the user reacts to the rendered variants, not the table.

## Generation Rules

Generate the requested number of visually distinct prototypes. Follow all attribute, scoping, prefix, and labeling rules from the [DOM Contract v1](references/dom-contract-v1.md).

1. **Structurally distinct**: Each variant MUST implement its row of the variant plan, with a fundamentally different layout approach — not just color or typography changes. For example: centered stack, split layout, card grid, full-width hero.

2. **Responsive**: All variants MUST be mobile-first and responsive unless the user explicitly requests desktop-only.

3. **Consistent content**: Use the same text, images, and data across all variants so comparison is fair.

4. **Production quality**: Every variant should be something a developer could ship. Proper semantic HTML, accessible markup, thoughtful spacing.

5. **Jigs (live tuning)**: Every variant exposes 3–8 of its key design values as CSS custom properties listed in `data-aitd-jigs`, so the user can adjust them in the browser and see changes immediately (see [DOM Contract v1](references/dom-contract-v1.md#jigs-optional-per-variant)):
   - Always include the accent or surface color, the main spacing (gap or padding), and the corner radius.
   - If the component animates, always add duration and easing, plus the distance, scale, or delay the motion uses.
   - Prefix the names per variant (`--v1-accent`, `--v2-dur`), declare them **on the variant element** (`[data-aitd-variant="1"] { --v1-dur: 240ms; }` in a scoped `<style>`, or `style={{ "--v1-dur": "240ms" }}` in JSX), and read them with `var()` everywhere they're used, including Tailwind arbitrary values like `duration-[var(--v1-dur)]` or `bg-[var(--v1-accent)]`.
   - Use plain values the picker can offer controls for: `ms`/`s` times, `px`/`rem` lengths, hex colors, unitless numbers, and `cubic-bezier()` or keyword easings.
   - Keep `prefers-reduced-motion` handling for any animation.

6. **Safe output**: Never use `innerHTML`, `dangerouslySetInnerHTML`, or unquoted HTML attributes for dynamic content. Use framework-native text rendering (`{variable}` in JSX/Vue/Svelte, `textContent` in plain JS). Variant content must be presentational HTML and CSS only — no `<script>` tags, `<iframe>`, or inline event handlers.

## Output Format

Build the prototype **natively in the project's framework**. The variant picker script discovers variants via `data-aitd-*` attributes (see [DOM Contract v1](references/dom-contract-v1.md)).

**Where to place the prototype:**

- If the user specifies a target (e.g., "put it in the pricing page"), add the variants **to that existing file**. Do NOT create a new page.
- If no target is specified, create a **dedicated prototype route** so production pages stay untouched. It still renders inside the app's root layout, so variants are judged in real context:

  | Framework | Route |
  |-----------|-------|
  | Next.js App Router | `app/prototype/<slug>/page.tsx` |
  | Next.js Pages Router | `pages/prototype/<slug>.tsx` |
  | SvelteKit | `src/routes/prototype/<slug>/+page.svelte` |
  | Nuxt / Vue Router | `pages/prototype/<slug>.vue`, or a route registered next to the existing ones |
  | Astro | `src/pages/prototype/<slug>.astro` |
  | React (Vite/CRA) without a router | render the prototype component from the root component behind `?prototype=<slug>` |

  `<slug>` is the component in kebab-case (e.g., `pricing-table`).
- If no framework is detected, create a standalone HTML file `prototype-<slug>.html` (see below).

**Variant picker script (required):**

Every prototype MUST include the variant picker script (`https://ai-to-design.com/runtime/1.7.0/prototype.min.js`) as the LAST element after the variants container, with a Subresource Integrity hash. Without it, the toolbar won't appear.

| Framework        | Script tag                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js          | `<Script src="https://ai-to-design.com/runtime/1.7.0/prototype.min.js" integrity="sha384-a+WNjccfHG7OOsJY7mkexKLMN5WDN+i7b9CaKOqRCG5FOMF+2o0gkBELeFGaekqo" crossOrigin="anonymous" strategy="afterInteractive" />` (import from `next/script`)   |
| React (Vite/CRA) | `<script src="https://ai-to-design.com/runtime/1.7.0/prototype.min.js" integrity="sha384-a+WNjccfHG7OOsJY7mkexKLMN5WDN+i7b9CaKOqRCG5FOMF+2o0gkBELeFGaekqo" crossorigin="anonymous"></script>` in `index.html`, or use a `useEffect` to inject it |
| Vue/Svelte/Astro | `<script src="https://ai-to-design.com/runtime/1.7.0/prototype.min.js" integrity="sha384-a+WNjccfHG7OOsJY7mkexKLMN5WDN+i7b9CaKOqRCG5FOMF+2o0gkBELeFGaekqo" crossorigin="anonymous"></script>` in the component or page                           |
| Plain HTML       | `<script src="https://ai-to-design.com/runtime/1.7.0/prototype.min.js" integrity="sha384-a+WNjccfHG7OOsJY7mkexKLMN5WDN+i7b9CaKOqRCG5FOMF+2o0gkBELeFGaekqo" crossorigin="anonymous"></script>` before `</body>`                                   |

**Content Security Policy:** If the project uses a CSP header, add `https://ai-to-design.com` to `script-src`. Remove it again after finalizing (step removes the script tag).

### Framework example (Next.js + Tailwind)

```tsx
import Script from "next/script";

export default function PrototypeHeroSection() {
  return (
    <>
      <div data-aitd-variants>
        <div data-aitd-variant="1" data-aitd-label="Minimal">
          {/* variant 1 — native JSX + Tailwind */}
        </div>
        <div data-aitd-variant="2" data-aitd-label="Split Layout">
          {/* variant 2 — native JSX + Tailwind */}
        </div>
      </div>
      <Script
        src="https://ai-to-design.com/runtime/1.7.0/prototype.min.js"
        integrity="sha384-a+WNjccfHG7OOsJY7mkexKLMN5WDN+i7b9CaKOqRCG5FOMF+2o0gkBELeFGaekqo"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </>
  );
}
```

### Plain HTML fallback

When no framework is detected, generate a standalone HTML file with a minimal CSS reset (`box-sizing: border-box`, system font stack, `img { max-width: 100% }`), the variant container per [DOM Contract v1](references/dom-contract-v1.md), and the picker script (with SRI hash) before `</body>`.

## Save & Preview

Tell the user the file path and the URL to open (dev server route, or the HTML file path).

The picker remembers the selected variant per page for the browser session, so reloads and hot reloads stay on the variant being reviewed. `?aitd=<n>` in the URL opens variant `n` directly, which is useful for sharing a link to a specific variant.

## Verify Visually

Look at what you built before handing it over. This is best effort: if you can't do it, say so and move on.

1. Get a URL the browser can load: the running dev server route (ask the user to start it if needed), or `file://<absolute path>` for a standalone HTML file.
2. For every variant `n`, take a mobile and a desktop screenshot. Playwright is already installed if the user has run `/extract-tokens`; otherwise `npx playwright install chromium` is a one-time ~200 MB download, so ask first.

   ```bash
   npx playwright screenshot --viewport-size=375,812 --full-page --wait-for-timeout=1000 "<url>?aitd=<n>&aitd-toolbar=off" .prototype-shots/v<n>-mobile.png
   npx playwright screenshot --viewport-size=1280,800 --full-page --wait-for-timeout=1000 "<url>?aitd=<n>&aitd-toolbar=off" .prototype-shots/v<n>-desktop.png
   ```

   `aitd-toolbar=off` hides the picker so it doesn't cover the variant. If the URL already has a query string, append the parameters with `&`. If a browser automation tool (e.g., Claude in Chrome) is available, it can be used instead.
3. Read every screenshot and fix these problems before presenting:
   - horizontal overflow or clipped content on mobile
   - broken or overlapping layout at either width
   - two variants that look alike, which means the variant plan wasn't followed
   - unreadable text contrast
   - missing images or unstyled content
4. Delete `.prototype-shots/` when done, unless the user wants to keep it; then suggest adding it to `.gitignore`.

## After Generation

Ask the user which variant they prefer. Point out the **Jigs** button in the toolbar: it adjusts the variant's colors, spacing, and motion live, **Replay** re-runs entrance animations (optionally at 0.5× or 0.25× speed), and **Copy** puts the tuned values on the clipboard as CSS. Tuned values are kept across reloads for the browser session.

Before refining or finalizing, ask whether they tuned any jigs; if so, have them paste the **Copy** output and write those values into the variant's declarations.

Then offer three options:

1. **Refine** — iterate on the chosen variant in the existing prototype page. Keep the variant picker structure (all variants, `data-aitd-variants` wrapper, and script tag) so the user can still compare.

2. **Explore round** — go deeper in the chosen direction. Keep the chosen variant as `data-aitd-variant="1"` (same label) and replace the others with new variants that vary *within* its direction: same layout family, different density, emphasis, or tone. Print a new variant plan first. Repeat until the user is ready to finalize.

3. **Finalize** — extract only the chosen variant into a clean, standalone component/page:
   1. Remove all variants except the chosen one
   2. Remove the `data-aitd-variants` wrapper element (keep its children)
   3. Remove all `data-aitd-*` attributes (including `data-aitd-jigs`) from the remaining markup, after writing any pasted jig values into the code. Keep the custom properties if they read well as component tokens; otherwise inline them as plain values
   4. Remove the variant picker script tag (`prototype.min.js`)
   5. If the project uses a CSP header, remind the user to remove `https://ai-to-design.com` from `script-src`
   6. If the prototype lived in a dedicated prototype route, move the chosen variant into a real component in the project's component folder, render it where the user wants it, and delete the prototype route file (and any now-empty `prototype/` directory)
   7. **Verify**: search the project for any remaining `data-aitd`, `ai-to-design.com`, or prototype-route references — report and remove any found before declaring finalization complete
