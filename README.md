# ai.to.interface-design

A Claude Code marketplace plugin that generates multiple structurally distinct UI component prototypes with an in-browser variant picker.

## Install

```bash
claude plugin add --marketplace github:I2olanD/ai.to.interface-design
```

## Usage

```
/prototype "hero section"
/prototype "pricing table" --variants 6 --style minimalist
/prototype "testimonial cards" --framework tailwind
```

### What it does

1. Scans your project for framework and design language (Next.js, React, Vue, Svelte, Astro, Tailwind, etc.)
2. Generates structurally distinct variants — different layouts, not just color swaps
3. Adds a variant picker toolbar so you can flip through them in the browser

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI

## License

MIT
