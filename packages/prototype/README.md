# @ai.to.design/prototype

In-browser variant-picker runtime for the [`ai-to-prototype`](https://github.com/I2olanD/ai.to.prototype) Claude Code plugin.

It renders a carousel toolbar that lets you flip through generated UI component variants.
The `prototype` skill injects the built bundle into a page temporarily while you pick variants, then strips it out on cleanup.

## What it is

A single self-contained IIFE (`dist/prototype.min.js`, ~20 KB / ~7 KB gzipped, no dependencies) that scans the DOM for `data-aitd-*` attributes and mounts a variant picker.

## Contract

The runtime discovers variants via data attributes on the page:

- Container: `data-aitd-variants`
- Per variant: `data-aitd-variant` (1-based index), `data-aitd-label`, optional `data-aitd-description`, optional `data-aitd-jigs` (CSS custom properties exposed as live controls)
- Optional container config: `data-aitd-transition`, `data-aitd-theme`, `data-aitd-position`, `data-aitd-branding`
- Managed at runtime: `data-aitd-active` on the visible variant, `data-aitd-dock` on the toolbar dock

Runtime behavior:

- `?aitd=<n>` opens variant `n`; otherwise the last selection in this browser session is restored. `?aitd-toolbar=off` hides the picker for screenshots.
- **Jigs**: variants that list custom properties in `data-aitd-jigs` get a panel to adjust them live (sliders, color picker, easing presets), replay animations at 1×/0.5×/0.25×, reset, and copy the values as CSS.
- Toolbars of several groups stack instead of overlapping.
- Containers rendered late or re-rendered by HMR (Next.js, Vue, Svelte) are picked up and keep their selection.

See the [DOM contract](https://github.com/I2olanD/ai.to.prototype/blob/main/plugin/skills/prototype/references/dom-contract-v1.md) for the full spec.

## License

MIT
