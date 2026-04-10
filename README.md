# ai.to.interface-design

A Claude Code and OpenCode plugin that generates multiple structurally distinct UI component prototypes with an in-browser variant picker.

## Install

### Claude Code

```bash
claude plugin marketplace add I2olanD/ai.to.interface-design
claude plugin install ai-to-interface-design@ai-to-interface-design
```

### OpenCode

Add to your `opencode.json`:

```json
{
  "plugin": ["ai-to-interface-design"]
}
```

The plugin auto-installs via Bun the next time OpenCode starts. The `/prototype` command works the same way as in Claude Code.

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

- [Claude Code](https://claude.com/claude-code) CLI, or
- [OpenCode](https://opencode.ai) with Bun available

## License

MIT
