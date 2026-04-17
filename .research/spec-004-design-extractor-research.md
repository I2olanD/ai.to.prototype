# Design System Extractor — Requirements Research (Spec 004)

**Date:** 2026-04-15  
**Researcher:** Requirements Team  
**Status:** Ready for PRD synthesis

---

## 1. User Personas

### Persona A: Startup Developer ("Get to Market Fast")
- **Profile:** Junior to mid-level full-stack developer at early-stage startup
- **Goal:** Ship a new product quickly without redesigning existing patterns
- **Current workflow:** Copy design from competitor sites, manually extract colors/fonts, paste into design system
- **Pain point:** Takes 2-4 hours per extraction; error-prone; inconsistent token naming
- **Success metric:** Extract a complete design system in under 15 minutes

### Persona B: Enterprise Designer ("Brand Consistency")
- **Profile:** Design lead or brand manager at mid-to-large company
- **Goal:** Ensure engineering teams use official brand colors, typography, spacing consistently
- **Current workflow:** Create Figma file with tokens, export JSON, document in wiki, email teams
- **Pain point:** Designers and engineers speak different languages; developers ignore brand guidelines; hard to audit compliance
- **Success metric:** Auto-extract from official website; distribute tokens as design tokens; audit compliance across projects

### Persona C: Design System Migrator ("Legacy to Modern")
- **Profile:** Tech lead managing migration from one design system to another
- **Goal:** Extract tokens from legacy site to inform the new design system
- **Current workflow:** Manual documentation; screenshot comparisons; excel spreadsheets
- **Pain point:** Migration takes weeks; manual review catches only 60% of edge cases; shadow systems emerge
- **Success metric:** Extract all tokens from legacy site; validate against new system; flag breaking changes

### Persona D: Agency Integrator ("Client Delivery")
- **Profile:** Designer or developer at design/dev agency
- **Goal:** Match client's existing brand when building microsites, components, or integrations
- **Current workflow:** Hand-code site inspection; ask client for design tokens (often don't have them); iterate on feedback
- **Pain point:** Clients can't articulate their system; back-and-forth delays; reimplements same tokens across client projects
- **Success metric:** One-click extraction from client's site; share tokens with team immediately

### Persona E: Design System Auditor ("Compliance & Debt")
- **Profile:** Design engineer or QA specialist
- **Goal:** Detect design debt, inconsistencies, undocumented patterns, and non-compliant implementations
- **Current workflow:** Manual code review; UI regression testing; screenshot comparisons
- **Pain point:** Hard to spot gradual drift; competitors' sites reveal design capabilities you don't know about; hard to justify refactor to stakeholders
- **Success metric:** Compare official vs. actual tokens; flag drift; generate before/after report

---

## 2. User Stories

### Story 1: Extract from Competitor Inspiration
**As a** startup developer  
**I want to** extract all design tokens (colors, typography, spacing, shadows) from a competitor's website in one action  
**So that** I can match their visual polish without manual inspection or guesswork, and ship my MVP 3x faster.

**Acceptance Criteria:**
- Extract runs without user having to code or write selectors
- Output includes min 8 colors, 3+ typography scales, spacing scale, shadows
- Tokens are exported as JSON compatible with design system tools (CSS variables, Figma, Storybook)
- Takes <2 minutes end-to-end

---

### Story 2: Brand Token Audit & Reporting
**As a** design system lead at an enterprise  
**I want to** run an extraction on our official website and compare it to our documented design tokens  
**So that** I can audit compliance and flag any undocumented styles or variations introduced by devs.

**Acceptance Criteria:**
- Extraction can target a live URL or local HTML file
- Output includes extracted tokens + confidence score per token
- Diff tool shows "Extracted vs. Documented" with color-coded matches/mismatches
- Report is shareable (PDF, JSON, or Markdown)
- Can identify shadow tokens not in official docs (e.g., `.card-shadow-1`, `.card-shadow-2`)

---

### Story 3: Extract Theme Variants
**As a** developer working on a design system that supports light/dark modes  
**I want to** extract both the light and dark theme tokens from a site in a single run  
**So that** I understand how colors, backgrounds, and text contrast shift between themes.

**Acceptance Criteria:**
- Extraction detects and applies prefers-color-scheme media queries
- Output separates light and dark tokens with clear naming (e.g., `color-bg-primary-light`, `color-bg-primary-dark`)
- Reports computed CSS values (resolved from variables, not raw var() references)
- Can extract multiple themes (e.g., 3 distinct color themes in a switch)

---

### Story 4: Responsive Breakpoint Discovery
**As a** frontend developer new to a codebase  
**I want to** extract breakpoints, grid layouts, and responsive patterns from a website  
**So that** I don't have to guess the intended mobile/tablet/desktop behavior when building new components.

**Acceptance Criteria:**
- Extraction discovers all media query breakpoints used on the site
- Output includes min-width and max-width values; identifies breakpoint names if present (e.g., `sm`, `md`, `lg`)
- Reports which components change at each breakpoint
- Can output as Tailwind config snippet or CSS variable breakpoint map

---

### Story 5: Animation & Motion Token Extraction
**As a** animator/interaction designer  
**I want to** extract transition durations, easing functions, and animation keyframes from a site  
**So that** I can match the site's micro-interaction feel and ensure consistency with approved motion principles.

**Acceptance Criteria:**
- Extraction discovers transition-duration, transition-timing-function, animation-delay values
- Identifies and deduplicates easing functions (e.g., `cubic-bezier(...)` used in 3 places becomes 1 token)
- Can optionally extract keyframe definitions (non-destructively)
- Output includes motion usage map (which elements use which animations)

---

### Story 6: Component Pattern Discovery
**As a** design system architect  
- **I want to** extract structural patterns from a site's UI (button styles, card layouts, form inputs, modals, tabs, etc.)  
**So that** I can document and reuse those patterns across the design system without re-inventing components.

**Acceptance Criteria:**
- Extraction identifies button variants (e.g., primary, secondary, outline, disabled)
- Maps form inputs and their states (focus, error, disabled, filled)
- Discovers and names semantic components (e.g., "Hero Section", "Feature Card", "Navigation Bar")
- Output includes selectors and CSS for each pattern, ready to refactor into components
- Reports component usage frequency (to prioritize which ones to build)

---

### Story 7: Design Token Documentation Generation
**As a** contractor or new team member  
**I want to** extract tokens from the official design system site and auto-generate documentation  
**So that** I can onboard faster and reference tokens without asking the design team.

**Acceptance Criteria:**
- Extraction produces Markdown documentation of all tokens with visual swatches
- Includes usage examples (e.g., "use `color-primary` for CTAs and nav items")
- Can generate interactive Storybook-compatible token documentation
- Output is version-controllable (JSON) and committable to the repo

---

### Story 8: Legacy System Deprecation Mapping
**As a** tech lead managing design system migration  
**I want to** extract tokens from the old site AND the new site, then see a mapping of which tokens map to which new tokens  
**So that** I can create a migration guide and systematically update all references without breaking old code.

**Acceptance Criteria:**
- Can extract and compare two different URLs/files
- Shows mapping recommendations (e.g., old `.primary-blue` → new `.color-primary`)
- Flags breaking changes (e.g., removed tokens, changed spacing scale)
- Generates a migration checklist with before/after code samples
- Identifies usage count per token to prioritize migration effort

---

## 3. What Should Be Extracted?

### 3.1 Color Tokens
**What to extract:**
- **Palette colors:** All hex/rgb/hsl values used in `background-color`, `color`, `border-color`, `outline-color`
- **Semantic colors:** Named colors tied to purpose (e.g., `error-red`, `success-green`, `primary-blue`)
- **Gradients:** Linear, radial, conic gradient definitions
- **Theme variants:** Separate light/dark mode colors with media query detection
- **Color opacity/alpha:** Track semantic transparency (e.g., `.button:hover { opacity: 0.8 }`)
- **CSS variable resolution:** Follow custom property chains (e.g., `var(--primary)` → `#3B82F6`)

**Output format:**
```json
{
  "colors": {
    "primary": { "value": "#3B82F6", "usage": ["buttons", "links", "active-states"], "count": 23 },
    "primary-dark": { "value": "#1E40AF", "usage": ["buttons"], "count": 5 },
    "success": { "value": "#10B981", "usage": ["status-indicators"], "count": 8 }
  }
}
```

---

### 3.2 Typography Tokens
**What to extract:**
- **Font families:** All `font-family` values; identify system fonts vs. web fonts (Google Fonts, @font-face, etc.)
- **Font sizes:** All `font-size` values across the site (often a limited palette: 12px, 14px, 16px, 20px, 24px, 32px, etc.)
- **Font weights:** Bold, semi-bold, normal, light; map to named weights (e.g., 400=Regular, 600=Semi-Bold)
- **Line heights:** All `line-height` values; flag semantic ones (heading line-height vs. body line-height)
- **Letter spacing:** All `letter-spacing` values
- **Text transforms:** Uppercase/lowercase/capitalize usage patterns
- **Text decoration:** Underline, overline, line-through patterns
- **Font smoothing:** `-webkit-font-smoothing`, `text-rendering` hints

**Output format:**
```json
{
  "typography": {
    "font-families": [
      { "name": "sans", "value": "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", "usage": ["body"] },
      { "name": "mono", "value": "'Fira Code', monospace", "usage": ["code"] }
    ],
    "font-sizes": [
      { "name": "sm", "value": "14px", "usage": 45 },
      { "name": "base", "value": "16px", "usage": 120 }
    ],
    "font-weights": [
      { "name": "regular", "value": 400, "usage": 150 },
      { "name": "semibold", "value": 600, "usage": 45 }
    ],
    "line-heights": [
      { "name": "tight", "value": 1.2, "usage": ["headings"] },
      { "name": "normal", "value": 1.5, "usage": ["body-text"] }
    ]
  }
}
```

---

### 3.3 Spacing Tokens
**What to extract:**
- **Padding/margin scale:** All `padding`, `margin`, `gap`, `padding-*` values
- **Identify pattern:** Most sites follow a scale (0, 4px, 8px, 16px, 24px, 32px, 48px, 64px) or multiples of a base unit
- **Semantic spacing:** Identify how spacing is used (element spacing vs. grid gap vs. inset padding)
- **Container widths:** Max-width values for containers (e.g., `max-width: 1200px`)
- **Height/width constants:** Fixed dimensions for common elements (buttons, icons, etc.)

**Output format:**
```json
{
  "spacing": {
    "unit": "4px",
    "scale": [
      { "name": "xs", "value": "4px", "usage": 5 },
      { "name": "sm", "value": "8px", "usage": 23 },
      { "name": "md", "value": "16px", "usage": 95 },
      { "name": "lg", "value": "24px", "usage": 65 }
    ],
    "container-width": { "value": "1200px", "usage": 3 }
  }
}
```

---

### 3.4 Border Radius Tokens
**What to extract:**
- **Border radius values:** All `border-radius`, `border-*-radius` values (0px, 4px, 8px, 12px, 9999px, etc.)
- **Categorize:** Small (buttons), medium (cards), large (sections), pill-shaped (avatars)
- **Variants:** Different radius for different component types

**Output format:**
```json
{
  "border-radius": [
    { "name": "none", "value": "0px" },
    { "name": "sm", "value": "4px", "usage": ["button"] },
    { "name": "md", "value": "8px", "usage": ["card", "input"] },
    { "name": "full", "value": "9999px", "usage": ["avatar"] }
  ]
}
```

---

### 3.5 Shadow Tokens
**What to extract:**
- **Box shadows:** All `box-shadow` values; resolve from CSS variables if needed
- **Text shadows:** All `text-shadow` values (less common)
- **Filter drops:** `filter: drop-shadow(...)` values
- **Depth levels:** Identify if shadows create visual hierarchy (e.g., "subtle", "medium", "prominent")
- **Shadow on hover/focus:** Interaction shadows

**Output format:**
```json
{
  "shadows": [
    { "name": "sm", "value": "0 1px 2px 0 rgba(0, 0, 0, 0.05)", "usage": 8 },
    { "name": "md", "value": "0 4px 6px -1px rgba(0, 0, 0, 0.1)", "usage": 23 },
    { "name": "lg", "value": "0 10px 15px -3px rgba(0, 0, 0, 0.1)", "usage": 5 }
  ]
}
```

---

### 3.6 Z-Index Tokens
**What to extract:**
- **Z-index values:** All `z-index` declarations; identify stacking contexts
- **Semantic layering:** Map z-index values to purposes (dropdowns, modals, tooltips, notifications)
- **Document conflicts:** Flag overlapping z-index values

**Output format:**
```json
{
  "z-index": [
    { "name": "dropdown", "value": 1000, "usage": ["select", "popover"] },
    { "name": "sticky", "value": 20, "usage": ["header"] },
    { "name": "modal", "value": 1050, "usage": ["dialog"] }
  ]
}
```

---

### 3.7 Breakpoints / Media Queries
**What to extract:**
- **All media queries:** All `min-width`, `max-width`, `min-height`, `max-height` breakpoint values
- **Orientation:** portrait/landscape queries if used
- **Pixel density:** `-webkit-min-device-pixel-ratio` for retina support
- **Naming convention:** If breakpoints have semantic names (sm, md, lg), extract those
- **Responsive patterns:** Which components change at which breakpoints

**Output format:**
```json
{
  "breakpoints": [
    { "name": "sm", "value": "640px", "usage": 45 },
    { "name": "md", "value": "768px", "usage": 78 },
    { "name": "lg", "value": "1024px", "usage": 56 }
  ],
  "responsive-patterns": {
    "grid": { "mobile": "1col", "tablet": "2col", "desktop": "3col" },
    "font-size": { "mobile": "14px", "desktop": "16px" }
  }
}
```

---

### 3.8 Animation / Motion Tokens
**What to extract:**
- **Transition properties:** `transition-duration`, `transition-timing-function`, `transition-delay`
- **Animation definitions:** `@keyframes` rules; extract animation names and durations
- **Easing functions:** Cubic-bezier, ease-in, ease-out, etc.; deduplicate identical curves
- **Duration patterns:** Common durations (150ms, 200ms, 300ms, 500ms)
- **Interaction timing:** On hover, focus, active, disabled states

**Output format:**
```json
{
  "motion": {
    "durations": [
      { "name": "fast", "value": "150ms", "usage": 12 },
      { "name": "normal", "value": "300ms", "usage": 34 }
    ],
    "easing-functions": [
      { "name": "ease-in-out", "value": "cubic-bezier(0.4, 0, 0.2, 1)", "usage": 45 }
    ],
    "animations": {
      "fade": { "duration": "300ms", "easing": "ease-in-out" }
    }
  ]
}
```

---

### 3.9 Component Patterns (Optional, Advanced)
**What to extract:**
- **Button variants:** Primary, secondary, outline, ghost, disabled states
- **Form inputs:** Text, checkbox, radio, select, textarea; focus/error states
- **Cards:** Image, title, description, action patterns
- **Navigation:** Nav bars, sidebars, breadcrumbs, pagination
- **Alerts/Notifications:** Success, error, warning, info styles
- **Modals/Dialogs:** Backdrop, sizing, close behavior
- **Tables:** Header, row, cell, hover states
- **Lists:** Ordered, unordered, description lists; separator patterns

**Output format:**
```json
{
  "components": {
    "button": {
      "variants": [
        {
          "name": "primary",
          "selectors": [".btn.btn-primary", "[data-type='primary']"],
          "styles": { "background-color": "#3B82F6", "color": "#FFFFFF", "padding": "8px 16px" },
          "states": ["hover", "active", "disabled"],
          "count": 23
        }
      ]
    }
  }
}
```

---

## 4. Acceptance Criteria

### AC 1: Data Extraction Accuracy
- **Criterion:** Extracted tokens must match visual rendering (not CSS variable definitions alone)
- **How to verify:** Extract a known design system site (e.g., shadcn/ui); compare output to official tokens; tolerance ±5%
- **Example:** If site uses `var(--primary)` resolving to `#3B82F6`, output must show `#3B82F6`, not the variable name

### AC 2: Token Deduplication
- **Criterion:** Identical values across different property names must be merged and reported as used in multiple places
- **How to verify:** If `color-primary` and `primary-color` are both `#3B82F6`, extraction produces one token with usage count of 2
- **Example:** `{ "value": "#3B82F6", "usage": ["buttons", "links"] }`

### AC 3: Complete Coverage
- **Criterion:** Extraction must find ≥90% of tokens in use on the extracted page/site
- **How to verify:** Manually inspect rendered page and spot-check tokens; cross-reference with computed styles
- **Success:** No significant visual property goes unexported (e.g., doesn't miss a shadow used on 10 elements)

### AC 4: Resolves CSS Variables
- **Criterion:** Custom properties (`--var` chains) must be resolved to final computed values
- **How to verify:** Input site with `:root { --primary: #3B82F6; } button { color: var(--primary); }` → output reports button color as `#3B82F6`
- **Fallback:** If circular/unresolvable, report as "unresolved" with source variable name

### AC 5: Handles Theme Switching
- **Criterion:** Dark mode, theme variants, or multiple color schemes are extracted separately with clear naming
- **How to verify:** Extract site with `prefers-color-scheme: dark` media query → output separates light/dark tokens
- **Example:** `color-bg-primary-light: #FFFFFF`, `color-bg-primary-dark: #1F2937`

### AC 6: Responsive Data Included
- **Criterion:** Breakpoints and responsive patterns are documented
- **How to verify:** Extraction lists all media query breakpoints and which components respond at each breakpoint
- **Example:** `breakpoints: [{ "640px": ["nav", "hero"] }, { "1024px": ["grid"] }]`

### AC 7: Confidence Scoring
- **Criterion:** Each extracted token includes a confidence score (0-1) indicating likelihood it's a true design token vs. one-off value
- **How to verify:** Tokens used 10+ times score 0.9+; used once score 0.3-0.5
- **Purpose:** Helps users prioritize which tokens to formalize

### AC 8: Format Agnostic Output
- **Criterion:** Tokens can be exported to multiple formats (JSON, CSS vars, Tailwind config, Figma JSON)
- **How to verify:** Extract → export as JSON, CSS, Tailwind config; each format is syntactically correct
- **Purpose:** Tokens work in any design system / framework

### AC 9: Handles Auth/Redirects Gracefully
- **Criterion:** If a URL is behind auth or redirects, extraction provides clear error message (not silent failure)
- **How to verify:** Attempt extraction on auth-protected page → error message explains why + suggests alternatives
- **Example:** "This page requires authentication. Try extracting from the publicly visible landing page instead."

### AC 10: Performance / Timeouts
- **Criterion:** Extraction completes within 60 seconds for typical websites; 2+ minute sites get timeout warning
- **How to verify:** Test on 10 representative sites; measure extraction time
- **Success:** 90% of sites extract in <30 seconds

---

## 5. Edge Cases & Handling Strategy

### Edge Case 1: Heavy JS Rendering (SPAs, CSR)
**Scenario:** Site renders DOM with JavaScript; static HTML crawl misses dynamic styles.  
**Risk:** Extraction returns incomplete token set.  
**Solution (v1 approach):**
- Use headless browser (Puppeteer, Playwright) to render JS
- Wait for document ready + 2-second network idle
- Extract from rendered DOM, not raw HTML
- Trade-off: Slower extraction (ok if within 60s budget)
- **Cost:** Complexity, infrastructure overhead
- **v1 Decision:** Include headless rendering as core feature (not optional)

---

### Edge Case 2: Authentication Walls
**Scenario:** Tokens only visible after login (e.g., design tokens on internal design system site).  
**Risk:** Cannot extract.  
**Solution (v1 approach):**
- Detect 401/403 responses; report error clearly
- Option: Allow users to provide local HTML file instead of URL
- Option: Support cookie/token injection (advanced, v2)
- **v1 Decision:** Local file support in v1; cookie injection in v2

---

### Edge Case 3: Inconsistent Design System
**Scenario:** Site has 47 shades of gray, 12 font sizes, no clear palette.  
**Risk:** Output is noise; hard to identify "real" tokens vs. one-offs.  
**Solution (v1 approach):**
- Confidence scoring: Flag tokens used only once as low confidence
- Clustering: Group similar values (e.g., 8 grays similar to #CCCCCC)
- Recommendations: Suggest simplified palette (e.g., "consider grouping these 8 into 3 tokens")
- **v1 Decision:** Include clustering + recommendations; let user decide what to keep

---

### Edge Case 4: Dark Mode / Multiple Themes
**Scenario:** Site supports light/dark/high-contrast modes; colors change per theme.  
**Risk:** Extraction conflates light/dark colors as separate tokens.  
**Solution (v1 approach):**
- Detect and extract each theme variant separately
- Output: `color-primary-light: #3B82F6`, `color-primary-dark: #1E3A8A`
- Document which theme is primary
- **v1 Decision:** Support light/dark detection; multi-theme (3+) as v2 feature

---

### Edge Case 5: CSS-in-JS, Sass, Tailwind, Plain CSS
**Scenario:** Site might use any combo: Tailwind, styled-components, CSS modules, plain CSS.  
**Risk:** Hard to extract if CSS is minified, bundled, obfuscated.  
**Solution (v1 approach):**
- Always extract from **computed styles** (DOM inspection), not source code
- This is framework-agnostic; works regardless of CSS preprocessing
- Limitation: Can't recover original variable names if CSS is minified (report as best-effort)
- **v1 Decision:** Computed styles only; source reconstruction as v2 feature

---

### Edge Case 6: CSS Custom Properties Shadowing
**Scenario:** `--primary: blue` defined at `:root`, but redefined to `red` on `.dark-mode`.  
**Risk:** Which value do we extract?  
**Solution (v1 approach):**
- Extract both with context (e.g., "root scope" vs. "dark-mode scope")
- Report usage count per scope
- Default to most-common scope; flag scope-specific overrides
- **v1 Decision:** Document scope; extract all with usage context

---

### Edge Case 7: Inline Styles & Style Attributes
**Scenario:** Some styles are inline, some are in stylesheets.  
**Risk:** Inline styles dominate if we weight all equally.  
**Solution (v1 approach):**
- Track source (inline vs. stylesheet); report separately
- Warn if high % of inline styles (anti-pattern)
- Weight stylesheet tokens higher (2x) in deduplication
- **v1 Decision:** Include source metadata; warn on high inline %

---

### Edge Case 8: Generated / Utility-First Frameworks
**Scenario:** Site uses Tailwind; tokens are implicit in config, not visible in CSS values.  
**Risk:** Extraction sees `class="w-4 h-4"` but not the underlying spacing token.  
**Solution (v1 approach):**
- For known frameworks (Tailwind, Bootstrap), detect and parse their config if available
- Fall back to computed DOM styles if config not available
- Document which approach was used
- **v1 Decision:** Computed styles primary; framework detection as optional enhancement

---

### Edge Case 9: Fonts Behind CDN / @font-face
**Scenario:** Font files hosted on third-party CDN; extraction sees `font-family` reference but not the actual font.  
**Risk:** Hard to identify if font is sans-serif, serif, monospace if not specified.  
**Solution (v1 approach):**
- Extract `font-family` string as-is
- Attempt to download @font-face declaration to determine font file type
- If unavailable, report the CSS definition; let user verify
- **v1 Decision:** Extract font-family + @font-face declarations; best-effort metadata

---

### Edge Case 10: Responsive Design with Mobile-First / Desktop-First
**Scenario:** Site uses `@media (min-width: 768px)` (mobile-first) or `@media (max-width: 768px)` (desktop-first).  
**Risk:** Hard to infer intended breakpoints without understanding the strategy.  
**Solution (v1 approach):**
- Extract all media queries with raw conditions
- Infer breakpoints from most common `min-width` or `max-width` values
- Document mobile-first vs. desktop-first intent based on media query strategy
- **v1 Decision:** Extract raw media queries; infer strategy; document clearly

---

### Edge Case 11: Interaction States (hover, focus, active)
**Scenario:** Button color changes on `:hover`, `:focus`, `:active`.  
**Risk:** Are these separate tokens or variants of the same token?  
**Solution (v1 approach):**
- Extract each state as a variant: `button-primary` (base), `button-primary-hover` (variant)
- Group by semantic state; document which states are supported
- Include guidance on how to implement (e.g., CSS pseudo-classes)
- **v1 Decision:** Extract state variants; group by component

---

### Edge Case 12: Animated Transitions vs. Static Tokens
**Scenario:** Hover effect uses `transition: background-color 300ms ease-in-out`.  
**Risk:** Is `300ms` a token or implementation detail?  
**Solution (v1 approach):**
- Extract motion tokens (duration, easing) if used 2+ times
- Group motion tokens by usage pattern (hover, state-change, loading, etc.)
- Document which states use which durations
- **v1 Decision:** Extract motion tokens; include usage context

---

## 6. Scope Boundaries

### ✅ IN SCOPE (v1)

#### Data Extraction
- Extract via URL (headless browser rendering)
- Extract from local HTML file
- Computed style inspection (no source code parsing)
- CSS variables resolution (with scope awareness)
- Light/dark mode detection via prefers-color-scheme media query
- All token categories: colors, typography, spacing, radius, shadows, z-index, breakpoints, motion

#### Deduplication & Grouping
- Merge identical values; report usage count
- Cluster similar values (e.g., group 8 grays into suggested 3)
- Confidence scoring per token
- Deduplicate across light/dark variants

#### Output Formats
- JSON (canonical format)
- CSS custom properties (--var format)
- ES6 object export (JavaScript)
- Markdown with color swatches + usage examples

#### Features
- Extraction API endpoint (Claude Code skill)
- CLI for batch extraction
- Comparison mode (two URLs → diff report)
- Confidence filtering (show tokens with score ≥0.5)
- Component pattern detection (basic: buttons, cards, inputs)
- Clear error handling for auth, redirects, timeouts

#### Performance & Safety
- 60-second timeout with clear messaging
- Auth detection + helpful error messages
- GDPR-compliant (no data retention)
- Rate limiting (v1: simple IP-based)
- Headless browser cleanup (no resource leaks)

---

### ❌ OUT OF SCOPE (v1, future versions)

#### Advanced Extraction
- Source code parsing (v2: Detect original Sass/CSS variable names)
- Framework-specific config parsing (v2: Read tailwind.config.js automatically)
- Design file import (v2: Read Figma/XD/Sketch files directly)
- AI-powered semantic naming (v2: Use LLM to rename tokens intelligently)
- Design system validation (v2: Compare against W3C WCAG standards)

#### Advanced Features
- Multi-theme extraction (v2: 3+ distinct color schemes)
- Cookie/auth injection (v2: Extract from protected pages with credentials)
- Accessibility compliance audit (v2: Check contrast ratios, spacing, etc.)
- Component code generation (v2: Generate React/Vue/Svelte from extracted patterns)
- Figma sync (v2: Push extracted tokens to Figma libraries)
- Storybook integration (v2: Auto-generate Storybook stories with tokens)
- Design token versioning (v2: Track token changes over time)

#### Infrastructure
- Self-hosted deployment (v1: SaaS only)
- Private/VPC networks (v1: Public URLs only)
- Large-scale batch processing (v1: Single URL at a time)
- Data warehousing (v1: No persistent storage)
- Custom webhook notifications (v2)

#### User Features
- Interactive token editor (v2: Refine extracted tokens in UI)
- Token diff visualization (v1: JSON comparison; v2: visual diff)
- Collaborative review workflows (v2: Share links, comment on tokens)
- Design system benchmarking (v2: Compare against industry standards)

---

### Design Decisions & Rationale

#### Why Computed Styles, Not Source Code?
- **Pro:** Framework-agnostic, works on any site, even minified/obfuscated CSS
- **Con:** Can't recover original variable names; harder to attribute to source files
- **v1 Decision:** Prioritize usability over fidelity; users can manually rename
- **v2:** Add optional source mapping if source maps available

#### Why Headless Rendering?
- **Pro:** Captures dynamically-rendered styles, JS-injected CSS, SPA component styling
- **Con:** Slower, requires browser instance, more infrastructure
- **v1 Decision:** Required (accept performance cost); acceptable within 60s budget
- **Alt:** Offer "fast mode" (static HTML only) as optional for simple sites

#### Why Local File Support?
- **Pro:** Solves auth problem; allows extraction from design system docs you wrote
- **Con:** Users have to download HTML manually
- **v1 Decision:** Include file upload option; URL primary, file secondary
- **v2:** Cookie/token injection for auth

#### Why JSON as Canonical Format?
- **Pro:** Parseable by any tool, language-agnostic, easy to extend
- **Con:** Not human-friendly, requires tooling to visualize
- **v1 Decision:** JSON + Markdown export with examples for human readability

#### Why Confidence Scoring?
- **Pro:** Helps users distinguish real tokens from one-off values
- **Con:** Score algorithm subjective; could mislead users
- **v1 Decision:** Include; document scoring algorithm clearly
- **Example:** 1 usage = 0.2, 2-5 usages = 0.5, 5-10 = 0.7, 10+ = 0.9

#### Why No Code Generation (v1)?
- **Pro:** Would be amazing (extract → use immediately)
- **Con:** Requires deep framework knowledge, error-prone, massive scope
- **v1 Decision:** Tokens only; users implement components
- **v2:** Can add React/Vue/Svelte component generators

---

## Summary Table

| Aspect | v1 Scope | v1 Out of Scope | Notes |
|--------|----------|-----------------|-------|
| **Input** | URL, local file | Auth-protected URLs, API responses | File upload addresses auth; v2 for credentials |
| **Rendering** | Headless browser (JS) | Server-side rendering simulation | SPAs work; CSR works |
| **Extraction** | Computed DOM styles | Source code, config files | Framework-agnostic |
| **Tokens** | Colors, type, spacing, radius, shadows, z-index, breakpoints, motion | Accessibility audits, compliance checks | Component patterns basic |
| **Themes** | Light/dark only | 3+ theme variants | v2 feature |
| **Output** | JSON, CSS vars, JS, Markdown | Figma sync, Storybook integration | Extensible format |
| **Comparison** | Two URLs → diff report | Multi-version history | v2: versioning |
| **Performance** | <60s typical | Batch processing | Per-URL, single run |
| **Infrastructure** | SaaS only | Self-hosted, VPC, private networks | v2 consideration |

---

## Research Conclusions

1. **Strong user demand:** All 5 personas have clear, repeated pain points; design system extraction solves real problems
2. **Achievable scope:** v1 extraction (colors, typography, spacing, etc.) is well-defined and buildable within 60-second budget
3. **Extensible design:** Confidence scoring, multi-format output, and comparison mode lay groundwork for v2 features
4. **Framework agnostic:** Computed DOM inspection is the right approach to be universally useful
5. **Clear boundaries:** Out-of-scope features (code gen, Figma sync, advanced themes) are v2+ candidates; v1 focuses on solid extraction + output

---

**Next Step:** Convert research to PRD (design system, API contract, feature checklist, rollout plan)

