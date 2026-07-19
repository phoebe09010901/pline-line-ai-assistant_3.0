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

## Memo / Calendar Basic CRUD Baseline Extension

The current DOC Gate extends the accepted baseline with two fixed LINE entry prefixes:

- `備忘錄`
- `行事曆`

Included in this document-only extension:

- deterministic trim + first-word routing
- memo CRUD action list
- calendar CRUD action list
- confirmation requirements
- actor fingerprint and exactly-once confirmation boundary
- fixed `_03` Dropbox memo directory
- authorized TEST Calendar boundary
- natural Traditional Chinese reply contract
- no-secret, no raw LINE User ID, no full-payload documentation boundary

Excluded from this document-only extension:

- n8n workflow edits
- Cloudflare Worker edits
- LINE Developers or LINE app operation
- Google Calendar live operation
- Dropbox file creation or inspection
- Git commit or push
- Google Tasks
- email, attachments, multi-agent, FORMAL, real-time wake, WebSocket, or broad regex routing

## Post-Baseline TEST Extension

The accepted TEST project now includes a fixed Dropbox idea JSON save path for Path A. The extension keeps the same clean-room boundaries and uses only:

```text
/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03
```

No Dropbox JSON files, temp files, secrets, raw LINE User IDs, or full webhook payloads belong in the repository.

TEST note: Dropbox JSON write/schema and duplicate behavior have live `_03` evidence, but the final success LINE reply after JSON save still needs FIX evidence before `DROPBOX IDEA JSON PATH PASS` can be marked.

Latest TEST rerun note: after Worker version `3ba57849-b02c-4b6e-a066-8da95575563c`, three new live Dropbox JSON files passed parse/schema/fingerprint checks and duplicate reprocess stayed idempotent. Formal LINE success final evidence `idea_json_final_push_completed` remained missing, so the extension remains `DROPBOX IDEA JSON PATH PARTIAL`.

Latest accepted TEST note: after durable exactly-once finalizer Worker version `cbadc5a1-4e07-44b2-853d-335c5486b11b`, three live Dropbox JSON files passed parse/schema/fingerprint checks, each run produced `idea_json_final_push_completed`, and repeated finalizer callback produced no second push or JSON file. The extension is marked `DROPBOX IDEA JSON PATH PASS`. Evidence: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

Natural final TEST note: after Worker version `dbda345b-a3b4-41ca-bc8b-a12c8547179c`, normal `idea_create` no longer emits a visible fixed ACK while webhook HTTP 200 is retained. Three live ideas saved JSON and produced one natural final each. The extension is marked `IDEA NATURAL FINAL REPLY WITHOUT ACK PASS`. Evidence: `TEST_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.
