# FIX Evidence: Memo Delete Target Matching and Confirmation

Date: 2026-07-19

Scope:

- Project: `菲比 LINE 智能助理_03`
- Root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Monitor: `pline-v3-test-codex-monitor`
- Dropbox boundary: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old projects, `_02`, old Dropbox data, old workflows, secrets, raw LINE User ID, and full webhook payloads were not used.

## TEST Failure Input

Fresh Memo rerun after the create/update repair:

- A1 create: PASS, marker `M3601-20260719023036`
- A2 search: PASS; stored content did not include `新增：`
- A3 update: PASS
- A4 search after update: PASS
- A5 delete request: safe failure, but returned `needs_clarification` instead of confirmation

The A5 failure was safe because no direct deletion occurred, but it did not satisfy the delete-confirmation requirement.

## Root Cause

- `memo_delete` used the whole command text as the query.
- A request such as `刪除 M3601-...` searched for the literal string including `刪除`, so it could miss the updated memo even when the marker/content existed.
- Worker and monitor both needed delete-target normalization, not only search/update normalization.

## Repair

- Worker CRUD sanitization now strips delete command prefixes for `memo_delete` query fields:
  - `刪除`
  - `删除`
  - `刪掉`
  - `移除`
- Monitor runtime uses the same delete-target normalization before matching memo JSON.
- Monitor task body normalization also stores the cleaned delete query, so evidence/query preview does not keep the command word.
- If exactly one memo matches, monitor returns terminal `needs_confirmation`, creates a short-TTL confirmation state, and does not delete immediately.
- If zero or multiple memos match, monitor keeps terminal clarification behavior.

## Confirmation Safety

Focused tests verified confirmation state:

- actor-fingerprint scoped
- pending status
- short expiry timestamp present
- no raw LINE User ID
- no local absolute path
- no Dropbox path
- visible reply asks for confirmation and contains only a safe candidate summary

## Validation

- Worker syntax and unit tests: PASS
- Monitor syntax and unit tests: PASS
- Focused Worker coverage:
  - `memo_delete` body text `刪除 <marker>` maps to clean query without `刪除`.
- Focused monitor coverage:
  - create -> update -> delete by updated marker/content returns `needs_confirmation`.
  - queued delete task becomes terminal `needs_confirmation`, writes confirmation id, and removes pending index.
  - no-match delete/update paths remain terminal clarification.
- Worker `/health`: PASS.
- Invalid signature `/line/webhook`: HTTP `401`.
- Remote `crud_task:v1:pending:*`: empty.
- Monitor launchd runner: `running`; heartbeat `ready`.

## Deploy / Reload

- Worker deployed version: `e5a8e2f9-9d7b-4391-9dd7-0caf709e082e`.
- Monitor launchd runner reloaded; current pid observed: `33348`.

## TEST Handoff

TEST can rerun Memo CRUD from a fresh A1, or continue from A5 if the current memo state is known unique. Fresh full rerun is preferred to avoid state pollution from prior memo attempts.
