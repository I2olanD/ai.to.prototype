---
title: "Publish design-token-extractor under @ai.to.design npm org"
status: draft
version: "1.0"
---

# Implementation Plan

## Context

User created new npm organization `ai.to.design` on npmjs.com. Package `design-token-extractor` must publish as scoped package `@ai.to.design/design-token-extractor`. Scope rename already staged in `packages/design-token-extractor/package.json`. Plan covers remaining artefacts: docs, lockfile, release workflow, auth/secrets, and first-publish validation.

## Scope & Non-Goals

**In scope:**
- npm package name → scoped (`@ai.to.design/design-token-extractor`)
- Install/usage docs reflect new name
- Release workflow publishes to new org with provenance
- npm auth configured for new org (token or trusted publisher)
- First release validated end-to-end

**Out of scope (preserve):**
- CLI binary name stays `design-token-extractor` (no user-facing rename)
- `$metadata.extractor` literal stays `"design-token-extractor"` (stable DTCG data format — changing breaks consumer parsers)
- Plugin marketplace name (`ai-to-prototype`) — separate concern
- Historic GitHub repo URL `I2olanD/ai.to.prototype` — unchanged

## Context Priming

**Key files:**
- `packages/design-token-extractor/package.json` — name field (staged change)
- `packages/design-token-extractor/package-lock.json` — lockfile name field
- `packages/design-token-extractor/README.md` — install instructions
- `plugin/skills/extract-tokens/SKILL.md` — `npm i` / `npx` references
- `.github/workflows/release.yml` — publish step
- GitHub repo secrets: `NPM_TOKEN`
- npmjs.com: org `ai.to.design` settings, automation token, trusted publisher

**Key decisions:**
- **ADR-1 Scoped package, public access.** `publishConfig.access: public` required because npm defaults scoped packages to private. Already present in package.json.
- **ADR-2 Provenance via GitHub OIDC.** `id-token: write` permission + `--provenance` flag. Already present in workflow. Org must enable provenance for scoped name.
- **ADR-3 Preserve CLI binary name.** `bin.design-token-extractor` unchanged. Users install via `npm i -g @ai.to.design/design-token-extractor`, invoke `design-token-extractor …`.
- **ADR-4 Preserve `$metadata.extractor` literal.** Output format stable across rename. Source/tests keep `'design-token-extractor'` strings.

**Commands:**
```bash
cd packages/design-token-extractor
npm install                  # regenerate lockfile with new name
npm run build
npm test
npm run lint && npm run typecheck
npm publish --dry-run --provenance   # validate publish payload locally (token not required for dry run)
```

---

## Implementation Phases

### Phase 1: Code & Docs Rename

Update all user-facing references from bare `design-token-extractor` (npm install context) to scoped `@ai.to.design/design-token-extractor`. Leave CLI binary name and DTCG metadata literal untouched.

- [x] **T1.1 package.json scope** `[activity: config]`

  1. Prime: Inspect current staged diff — `name` already `@ai.to.design/design-token-extractor`, `publishConfig.access: public` present.
  2. Test: `cat package.json | jq .name` → `@ai.to.design/design-token-extractor`. `jq .publishConfig.access` → `public`.
  3. Implement: No change (already staged). Confirm `bin.design-token-extractor` unchanged.
  4. Validate: `npm pkg get name publishConfig.access bin` in package dir.
  5. Success: Name scoped, public access, CLI binary name preserved.

- [x] **T1.2 Regenerate package-lock.json** `[activity: config]`

  1. Prime: Lockfile currently has `"name": "design-token-extractor"` at root + nested `packages[""].name`.
  2. Test: After `npm install`, `jq .name packages/design-token-extractor/package-lock.json` → scoped name.
  3. Implement: `cd packages/design-token-extractor && npm install`. Commit regenerated lockfile.
  4. Validate: No unrelated dep drift (`git diff package-lock.json` only shows name fields + integrity hashes if any).
  5. Success: Lockfile name matches package.json.

- [x] **T1.3 README install instructions** `[activity: docs]` `[parallel: true]`

  1. Prime: `packages/design-token-extractor/README.md:8` — `npm i -g design-token-extractor`.
  2. Test: Grep result for `npm i -g design-token-extractor` → 0 hits. Grep for `@ai.to.design/design-token-extractor` → ≥1 hit. CLI invocation examples (`design-token-extractor extract …`) remain unchanged.
  3. Implement: Replace install command → `npm i -g @ai.to.design/design-token-extractor`. Leave all `design-token-extractor extract …` CLI examples as-is.
  4. Validate: Render README visually — install block updated; usage blocks unchanged.
  5. Success: Users can copy-paste install command and it resolves to new org.

- [x] **T1.4 Plugin skill install refs** `[activity: docs]` `[parallel: true]`

  1. Prime: `plugin/skills/extract-tokens/SKILL.md` uses `npx design-token-extractor …` (works via bin resolution after install) and `command -v design-token-extractor` (checks binary on PATH — unchanged).
  2. Test: Any bare-name `npm i` / `npm install` references updated to scoped. `npx` references: decide per-case — `npx @ai.to.design/design-token-extractor` (explicit) or keep `npx design-token-extractor` (uses cached binary if installed; otherwise npx cannot resolve bare name).
  3. Implement: Prefer `npx @ai.to.design/design-token-extractor extract …` for reliable cold-machine use. Update `command -v` check to retain bare binary name.
  4. Validate: Manual copy-paste of each command in fresh shell.
  5. Success: Skill works on a machine without prior install.

- [x] **T1.5 Phase Validation** `[activity: validate]`

  Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` in package dir. All green. Existing tests asserting `$metadata.extractor === 'design-token-extractor'` still pass (unchanged literal).

  **Result**: typecheck ✓, lint ✓, build ✓ (ESM 46.44 KB), tests 377 passed / 1 skipped (2026-04-18).

---

### Phase 2: Release Workflow & Auth

Ensure GitHub Actions can publish to the new org with provenance.

- [ ] **T2.1 npm org + package settings** `[activity: ops]` *(manual — user action)*

  1. Prime: Confirm `ai.to.design` org exists on npmjs.com and user is owner/admin.
  2. Test: `npm org ls ai.to.design` (after `npm login`) lists user. `npm access list packages @ai.to.design` returns empty or existing list.
  3. Implement: User action — verify org exists; no package yet exists under scope (first publish will create).
  4. Validate: Screenshot or CLI output confirming org membership.
  5. Success: Org ready to receive first publish.

- [x] **T2.2 NPM_TOKEN scope** `[activity: ops]` *(manual — user action)* — User confirmed token already in place. Option A selected. Risk: if token lacks new-org write, first publish 403s → rotate.

  1. Prime: Current `NPM_TOKEN` GitHub secret was scoped to previous publish context (bare package). Scoped publishes require token with write access to the new org.
  2. Test: Decide path —
     - **Option A (token):** Generate new **Automation** token on npmjs.com with access to `@ai.to.design` org. Replace `NPM_TOKEN` secret in GitHub repo settings.
     - **Option B (trusted publisher, recommended):** Configure npmjs.com → package settings → Trusted Publisher for GitHub Actions (repo `I2olanD/ai.to.prototype`, workflow `release.yml`, env). Remove `NPM_TOKEN` dependency.
  3. Implement: User action via npmjs.com UI + GitHub secrets. Prefer Option B — no long-lived token, tighter provenance binding. Option A viable if trusted publisher not yet supported for first-time org publishes.
  4. Validate: Workflow dry-run (see T2.4) succeeds with chosen auth.
  5. Success: Workflow authenticates and publishes without manual token leakage risk.

- [x] **T2.3 release.yml review** `[activity: config]` — Option A confirmed: `id-token: write`, `--provenance`, `NODE_AUTH_TOKEN`, `registry-url` all present. No edit needed.

  1. Prime: `.github/workflows/release.yml` — `permissions.id-token: write` ✓, `registry-url: 'https://registry.npmjs.org'` ✓, `npm publish --provenance` ✓, working-directory uses package path ✓.
  2. Test: Read workflow end-to-end. Verify no hardcoded old package name. Version-bumping step (`npm version`) works identically for scoped names.
  3. Implement: If Option B (trusted publisher), remove `NODE_AUTH_TOKEN` env from publish step; `setup-node` `registry-url` + OIDC handles auth. If Option A, no workflow edit needed.
  4. Validate: `actionlint` or GitHub web UI workflow syntax check. Diff minimal.
  5. Success: Workflow file reflects chosen auth path.

- [x] **T2.4 Local publish dry-run** `[activity: validate]` — Dry-run success: `@ai.to.design/design-token-extractor@1.3.3`, 3 files (README, dist/cli.js, package.json), 14.2kB, public access. Fixed bin path (`./dist/cli.js` → `dist/cli.js`) to clear auto-correct warning.

  1. Prime: Dry-run validates tarball contents, name, version, access, provenance eligibility without publishing.
  2. Test: `cd packages/design-token-extractor && npm publish --dry-run --access public`. Output shows `package: @ai.to.design/design-token-extractor@<version>`, `access: public`, file list matches `files: ["dist"]`.
  3. Implement: Run locally after T1.5 build completes so `dist/` exists.
  4. Validate: No warnings about missing `access`, no unexpected files (e.g., tests, src/), no pre-existing name collision.
  5. Success: Dry-run matches intended publish payload.

---

### Phase 3: First Publish & Verification

Cut a real release via the workflow and verify end-to-end.

- [ ] **T3.1 Merge & trigger release** `[activity: ops]`

  1. Prime: Workflow triggers on push to `main`. Conventional commit determines bump (feat = minor, fix = patch, BREAKING = major).
  2. Test: Commit with message like `chore: Publishes under @ai.to.design scope` (patch bump). Push to `main`. Watch Actions tab.
  3. Implement: Stage Phase 1+2 changes, commit, push.
  4. Validate: Workflow run reaches "Publish CLI to npm" step and succeeds.
  5. Success: GitHub Release created, tag pushed, workflow green.

- [ ] **T3.2 npm registry verification** `[activity: validate]`

  1. Prime: Published package should be visible under new scope with provenance attestation.
  2. Test:
     - `npm view @ai.to.design/design-token-extractor version` returns new version.
     - `npm view @ai.to.design/design-token-extractor dist.attestations` shows provenance URLs.
     - npmjs.com package page shows "Built and signed on GitHub Actions" badge.
  3. Implement: Run post-workflow.
  4. Validate: All three checks pass.
  5. Success: Package publicly installable with provenance.

- [ ] **T3.3 Fresh-install smoke test** `[activity: e2e-test]`

  1. Prime: Verify install path from a clean environment end-users will hit.
  2. Test:
     ```bash
     cd $(mktemp -d)
     npm i -g @ai.to.design/design-token-extractor
     npx playwright install chromium
     design-token-extractor --version
     design-token-extractor extract https://example.com --out tokens.json
     jq .$metadata.extractor tokens.json   # still "design-token-extractor" (ADR-4)
     ```
  3. Implement: Run after T3.2 confirms registry state.
  4. Validate: CLI binary resolves, `--version` matches tag, extraction produces valid DTCG JSON.
  5. Success: End-user install flow works.

- [ ] **T3.4 Finalize** `[activity: validate]`

  - Update spec README status → completed.
  - Close out decisions log with final auth path (token vs trusted publisher).
  - Confirm prior unscoped package (if any was previously published) is either deprecated with pointer, or was never published (skip).
  - Success: Migration documented, no dangling stale distribution.

---

## Risks

| Risk | Mitigation |
|------|------------|
| `NPM_TOKEN` still scoped to old package → 403 on first publish | T2.2 regenerates or switches to trusted publisher before push |
| Name `@ai.to.design/design-token-extractor` already squatted | T2.4 dry-run surfaces conflict before real publish |
| Users with old global install (`npm i -g design-token-extractor`) don't receive updates | Out of scope; unscoped package not under our control. Note in release notes if applicable |
| Trusted publisher not yet supported for empty scope (first publish) | Fallback: use automation token (Option A) for v1, switch to trusted publisher after |
| `$metadata.extractor` literal accidentally changed | T1.5 existing tests pin the literal — would fail loudly |

## Plan Verification

| Criterion | Status |
|-----------|--------|
| A developer can follow this plan without additional clarification | ✅ |
| Every task produces a verifiable deliverable | ✅ |
| Manual/ops tasks flagged explicitly | ✅ |
| Dependencies explicit (T1 → T2 → T3) | ✅ |
| Parallel opportunities marked (T1.3 \|\| T1.4) | ✅ |
| Risks and mitigations documented | ✅ |
| Preserves stable public contracts (CLI binary, DTCG literal) | ✅ |
