# Specification: 001-npm-org-migration

## Status

| Field | Value |
|-------|-------|
| **Created** | 2026-04-18 |
| **Current Phase** | Initialization |
| **Last Updated** | 2026-04-18 |

## Documents

| Document | Status | Notes |
|----------|--------|-------|
| product-requirements.md | skipped | Scoped rename only — requirements trivial |
| solution-design.md | skipped | No new architecture; changes = rename + workflow edits |
| implementation-plan.md | completed | 3 phases, 13 tasks |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-18 | Start directly with PLAN | Small scope: npm org rename + workflow/settings update. PRD/SDD overhead not justified. |
| 2026-04-18 | Local only, no spec branch | User working directly on main. |

## Context

User created new npm organization `ai.to.design`. Need update release workflow and all relevant settings so packages publish there instead of current location.

---
*This file is managed by the specification-management skill.*
