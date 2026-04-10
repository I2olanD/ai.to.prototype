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

## Script Tag

The `prototype.min.js` script is served from `https://ai-to-design.com/prototype.min.js`. Add it via a script tag with a Subresource Integrity hash — no file copy needed.

```html
<script src="https://ai-to-design.com/prototype.min.js" integrity="sha384-3G+KXjkUOSYBDks/eO/Og2SUkI6Y7+rWsmUtaxcqVkUdipNwHWsm0PyGvwtv7kRs" crossorigin="anonymous"></script>
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
<script src="https://ai-to-design.com/prototype.min.js" integrity="sha384-3G+KXjkUOSYBDks/eO/Og2SUkI6Y7+rWsmUtaxcqVkUdipNwHWsm0PyGvwtv7kRs" crossorigin="anonymous"></script>
```

## Rules

1. Each variant MUST be fully self-contained — all CSS either inline or in a scoped `<style>` tag within the variant div
2. Variant CSS class names MUST be prefixed per variant (e.g., `.v1-`, `.v2-`) to avoid conflicts
3. Labels MUST be descriptive design-direction names (e.g., "Minimal", "Card Grid"), not ordinal labels
4. The prototype.js script tag MUST be the last element, after all variants, and MUST include the `integrity` and `crossorigin` attributes
5. Multiple `data-aitd-variants` containers on one page work independently
6. Variant content MUST be presentational HTML and scoped CSS only — no `<script>` tags, `<iframe>`, `<object>`, `<embed>`, or inline event handlers (`onclick`, `onerror`, etc.)
7. `data-aitd-label` and `data-aitd-description` MUST be static, developer-authored strings — never populated from untrusted input or runtime variables
