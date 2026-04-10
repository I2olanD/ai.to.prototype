# ai.to.interface-design

Generate multiple structurally distinct UI component prototypes with an in-browser variant picker.

## Install

### Claude Code

```bash
claude plugin marketplace add I2olanD/ai.to.interface-design
claude plugin install ai-to-interface-design@ai-to-interface-design
```

### OpenCode

Copy the `plugin/skills/prototype` folder from this repo into one of OpenCode's [skill directories](https://opencode.ai/docs/skills/):

**Project-local** (scoped to one project):
```
.opencode/skills/prototype/
```

**Global** (available in all projects):
```
~/.config/opencode/skills/prototype/
```

The folder must contain `SKILL.md` and the `references/` subfolder.

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
- [OpenCode](https://opencode.ai)

## Security

The variant picker script is loaded from `https://ai-to-design.com/prototype.min.js` with a Subresource Integrity hash. If your project uses a Content Security Policy, add `https://ai-to-design.com` to `script-src` while prototyping. Remove it after finalizing your chosen variant.

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

## License

MIT
