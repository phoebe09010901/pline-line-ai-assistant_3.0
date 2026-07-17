# BASELINE

## Baseline Type

Clean-room minimal documentation and architecture baseline.

## Files In Baseline

- `README.md`
- `PROJECT_STATE.md`
- `CHANGELOG.md`
- `CODEX_NOTES.md`
- `BASELINE.md`
- `ARCHITECTURE.md`
- `TEST_PLAN.md`
- `SECURITY.md`
- `.env.example`
- `.gitignore`

## Baseline Boundaries

Included:

- Minimal dual-path architecture.
- TEST-only component names.
- Environment variable placeholders.
- Security and scope rules.
- Gate 1 and Gate 2 test criteria.

Excluded:

- Worker implementation.
- n8n workflow implementation.
- Local monitor implementation.
- Live LINE, Cloudflare, n8n, or GitHub operation.
- Production release.

## Required Clean-Room Checks

- cwd must be `/Users/phoebe/Documents/菲比 LINE 智能助理_03`.
- `_03` must not contain symlinks pointing outside the project.
- `_03` must not reuse old Git history, remotes, branches, tags, submodules, or worktrees.
- `_03` must not use external resources that are not explicitly created for this project.

## Baseline Acceptance

This DOC baseline is accepted when all ten required files exist in the project root and describe only the minimal dual-path `_03` scope.
