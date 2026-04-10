# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this plugin or in `prototype.min.js`, please report it responsibly.

**Contact**: Open a private security advisory on the GitHub repository.

**Response timeline**: You can expect an initial response within 72 hours and a resolution or mitigation plan within 14 days.

## Scope

The following components are in scope for security reports:

- `plugin/skills/prototype/SKILL.md` (generation instructions)
- `plugin/skills/prototype/references/dom-contract-v1.md` (DOM attribute schema)
- `prototype.min.js` served from `https://ai-to-design.com`

## SRI Hash Rotation

The plugin pins `prototype.min.js` via a Subresource Integrity hash. When the script is updated, a new plugin version is released with the updated hash. Users should pull plugin updates to stay current.
