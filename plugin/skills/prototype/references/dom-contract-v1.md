# DOM Contract v1

The canonical attribute schema for prototype.js variant discovery.

## Container (required)

```html
<div data-aitd-variants>
  <!-- 2-9 variant children -->
</div>
```

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `data-aitd-variants` | Yes | - | Marks a variant group container |

## Variant (required per child)

```html
<div data-aitd-variant="1" data-aitd-label="Minimal">
  <!-- fully self-contained HTML/CSS -->
</div>
```

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `data-aitd-variant` | Yes | integer (1-based) | Variant index |
| `data-aitd-label` | Yes | string | Descriptive design-direction name shown in prototype |
| `data-aitd-description` | No | string | Longer description (tooltip) |

## Jigs (optional, per variant)

```html
<div data-aitd-variant="1" data-aitd-label="Rise In" data-aitd-jigs="--v1-dur --v1-ease --v1-accent --v1-gap">
  <style>
    [data-aitd-variant="1"] { --v1-dur: 480ms; --v1-ease: cubic-bezier(0.2, 0.8, 0.2, 1); --v1-accent: #4f46e5; --v1-gap: 16px; }
    .v1-card { animation: v1-rise var(--v1-dur) var(--v1-ease) both; border-color: var(--v1-accent); }
  </style>
  ...
</div>
```

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `data-aitd-jigs` | No | custom-property names, separated by spaces or commas | Exposes these CSS custom properties as live controls in the toolbar's **Jigs** panel |

- Names must match `--[A-Za-z0-9_-]+`; anything else is ignored.
- Declare each property **on the variant element or an ancestor**. The runtime writes adjusted values as inline custom properties on the variant element, and a declaration on a descendant would override them.
- The control is picked from the property's current value: a slider for `ms`/`s` times, `px`/`rem`/`em`/`%` lengths, and unitless numbers; a color picker for opaque hex/`rgb()` colors; presets plus free text for easings; free text for anything else.

## Configuration (optional, on container)

| Attribute | Default | Values | Description |
|-----------|---------|--------|-------------|
| `data-aitd-transition` | `"crossfade"` | `crossfade`, `slide`, `none` | Transition style |
| `data-aitd-theme` | `"auto"` | `light`, `dark`, `auto` | Picker toolbar theme |
| `data-aitd-branding` | `"true"` | `true`, `false` | Show ai.to.design branding |
| `data-aitd-position` | `"bottom-center"` | `bottom-center`, `bottom-left`, `bottom-right`, `top-center` | Toolbar position |

## Runtime (managed by prototype.js)

| Attribute | Description |
|-----------|-------------|
| `data-aitd-active` | Set on the currently visible variant |
| `data-aitd-dock` | Set on the fixed toolbar dock appended to `<body>` (one per toolbar position) |

## Runtime behavior

- **Initial variant.** `?aitd=<n>` in the page URL opens the variant whose `data-aitd-variant` is `n`, in every group that has one. Otherwise the variant last selected in this browser session is restored, matched by `data-aitd-label` and stored in `sessionStorage` per page path and group. Otherwise variant 1 is shown.
- **Group identity.** A non-empty `data-aitd-variants="<id>"` value names the group for persistence. Without it, the group's position among the page's containers is used. Give groups explicit ids when a page has several and their order may change.
- **Multiple groups.** Toolbars that share a `data-aitd-position` stack in one dock instead of overlapping.
- **Late and re-rendered markup.** Containers are picked up whenever they appear, including inside larger inserted subtrees. A container whose variant children are replaced (HMR, re-render) is re-initialised on its restored selection. Toolbars of removed containers are removed.
- **Screenshots.** `?aitd-toolbar=off` applies the selection (and any tuned jig values) without mounting toolbars, so automated screenshots show the variant unobstructed.
- **Jigs.** The **Jigs** toolbar button appears only while the active variant declares `data-aitd-jigs`. Adjusted values persist for the session per variant label. **Reset** restores the authored values. **Copy** yields `--name: value;` declarations. **Replay** restarts the variant's CSS animations, and the speed control (1×, 0.5×, 0.25×) also slows hover and click transitions inside the variant.
- **Transitions.** `crossfade` fades, `slide` fades and shifts 16px in the direction of travel, and `none` swaps instantly. Both animated transitions fall back to an instant swap under `prefers-reduced-motion: reduce`.

## Script Tag

The `prototype.min.js` script is served from `https://ai-to-design.com/runtime/1.6.5/prototype.min.js`. Add it via a script tag with a Subresource Integrity hash — no file copy needed.

```html
<script src="https://ai-to-design.com/runtime/1.6.5/prototype.min.js" integrity="sha384-AO+HioGDSWzoCpTyDSD9J8CkFAL1MgoFeiweG21ZP1qj2VlW4qsP22VydYyl54um" crossorigin="anonymous"></script>
```

Always placed AFTER all variant containers.

## Complete Example

> This example shows the variant DOM structure only. The enclosing HTML page (DOCTYPE, head, body) is defined by the `/prototype` skill.

```html
<div data-aitd-variants>
  <div data-aitd-variant="1" data-aitd-label="Minimal">
    <style>.v1 { padding: 80px; text-align: center; }</style>
    <section class="v1">...</section>
  </div>
  <div data-aitd-variant="2" data-aitd-label="Card Grid">
    <style>.v2 { display: grid; gap: 24px; }</style>
    <section class="v2">...</section>
  </div>
  <div data-aitd-variant="3" data-aitd-label="Split Layout">
    <style>.v3 { display: grid; grid-template-columns: 1fr 1fr; }</style>
    <section class="v3">...</section>
  </div>
  <div data-aitd-variant="4" data-aitd-label="Glassmorphism">
    <style>.v4 { backdrop-filter: blur(20px); }</style>
    <section class="v4">...</section>
  </div>
</div>
<script src="https://ai-to-design.com/runtime/1.6.5/prototype.min.js" integrity="sha384-AO+HioGDSWzoCpTyDSD9J8CkFAL1MgoFeiweG21ZP1qj2VlW4qsP22VydYyl54um" crossorigin="anonymous"></script>
```

## Rules

1. Each variant MUST be fully self-contained: its styling must not depend on, or leak into, another variant. With plain CSS, put it inline or in a scoped `<style>` tag within the variant div. With utility classes (Tailwind), CSS modules, or framework-scoped styles (Vue `scoped`, Svelte, Astro), the framework-native approach already satisfies this rule.
2. Class names a variant introduces in a `<style>` tag MUST be prefixed per variant (e.g., `.v1-`, `.v2-`) to avoid conflicts. Utility classes and module-scoped class names are exempt.
3. Labels MUST be descriptive design-direction names (e.g., "Minimal", "Card Grid"), not ordinal labels
4. The prototype.js script tag MUST be the last element, after all variants, and MUST include the `integrity` and `crossorigin` attributes
5. Multiple `data-aitd-variants` containers on one page work independently
6. Variant content MUST be presentational HTML and scoped CSS only — no `<script>` tags, `<iframe>`, `<object>`, `<embed>`, or inline event handlers (`onclick`, `onerror`, etc.)
7. `data-aitd-label`, `data-aitd-description`, and `data-aitd-jigs` MUST be static, developer-authored strings — never populated from untrusted input or runtime variables
