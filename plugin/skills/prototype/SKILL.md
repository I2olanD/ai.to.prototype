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

Use what you find. Match the project's framework, styling approach, and component patterns. If you can't determine the stack, fall back to a standalone HTML file with scoped CSS.

## Generation Rules

Generate the requested number of visually distinct prototypes. Follow all attribute, scoping, prefix, and labeling rules from the [DOM Contract v1](references/dom-contract-v1.md).

1. **Structurally distinct**: Each variant MUST use a fundamentally different layout approach — not just color or typography changes. For example: centered stack, split layout, card grid, full-width hero.

2. **Responsive**: All variants MUST be mobile-first and responsive unless the user explicitly requests desktop-only.

3. **Consistent content**: Use the same text, images, and data across all variants so comparison is fair.

4. **Production quality**: Every variant should be something a developer could ship. Proper semantic HTML, accessible markup, thoughtful spacing.

5. **Safe output**: Never use `innerHTML`, `dangerouslySetInnerHTML`, or unquoted HTML attributes for dynamic content. Use framework-native text rendering (`{variable}` in JSX/Vue/Svelte, `textContent` in plain JS). Variant content must be presentational HTML and CSS only — no `<script>` tags, `<iframe>`, or inline event handlers.

## Output Format

Build the prototype **natively in the project's framework**. The variant picker script discovers variants via `data-aitd-*` attributes (see [DOM Contract v1](references/dom-contract-v1.md)).

**Where to place the prototype:**

- If the user specifies a target (e.g., "put it in the pricing page"), add the variants **to that existing file**. Do NOT create a new page.
- If no target is specified, add the variants to the **homepage / root page** (e.g., `app/page.tsx`, `pages/index.tsx`, `src/routes/+page.svelte`, `index.html`).
- If no framework is detected, create a standalone HTML file (see below).

**Variant picker script (required):**

Every prototype MUST include the variant picker script (`https://ai-to-design.com/prototype.min.js`) as the LAST element after the variants container, with a Subresource Integrity hash. Without it, the toolbar won't appear.

| Framework        | Script tag                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js          | `<Script src="https://ai-to-design.com/prototype.min.js" integrity="sha384-3G+KXjkUOSYBDks/eO/Og2SUkI6Y7+rWsmUtaxcqVkUdipNwHWsm0PyGvwtv7kRs" crossOrigin="anonymous" strategy="afterInteractive" />` (import from `next/script`)   |
| React (Vite/CRA) | `<script src="https://ai-to-design.com/prototype.min.js" integrity="sha384-3G+KXjkUOSYBDks/eO/Og2SUkI6Y7+rWsmUtaxcqVkUdipNwHWsm0PyGvwtv7kRs" crossorigin="anonymous"></script>` in `index.html`, or use a `useEffect` to inject it |
| Vue/Svelte/Astro | `<script src="https://ai-to-design.com/prototype.min.js" integrity="sha384-3G+KXjkUOSYBDks/eO/Og2SUkI6Y7+rWsmUtaxcqVkUdipNwHWsm0PyGvwtv7kRs" crossorigin="anonymous"></script>` in the component or page                           |
| Plain HTML       | `<script src="https://ai-to-design.com/prototype.min.js" integrity="sha384-3G+KXjkUOSYBDks/eO/Og2SUkI6Y7+rWsmUtaxcqVkUdipNwHWsm0PyGvwtv7kRs" crossorigin="anonymous"></script>` before `</body>`                                   |

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
        src="https://ai-to-design.com/prototype.min.js"
        integrity="sha384-3G+KXjkUOSYBDks/eO/Og2SUkI6Y7+rWsmUtaxcqVkUdipNwHWsm0PyGvwtv7kRs"
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

Tell the user the file path and how to open it in their browser.

## After Generation

Ask the user which variant they prefer. Then offer two options:

1. **Refine** — iterate on the chosen variant in the existing prototype page. Keep the variant picker structure (all variants, `data-aitd-variants` wrapper, and script tag) so the user can still compare.

2. **Finalize** — extract only the chosen variant into a clean, standalone component/page:
   1. Remove all variants except the chosen one
   2. Remove the `data-aitd-variants` wrapper element (keep its children)
   3. Remove all `data-aitd-*` attributes from the remaining markup
   4. Remove the variant picker script tag (`prototype.min.js`)
   5. If the project uses a CSP header, remind the user to remove `https://ai-to-design.com` from `script-src`
   6. **Verify**: search the file for any remaining `data-aitd` or `ai-to-design.com` strings — report and remove any found before declaring finalization complete
