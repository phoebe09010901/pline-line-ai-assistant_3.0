# FIX Evidence: Codex Task created_at Schema Preservation

Date: 2026-07-18T11:40:14+0800

## Scope

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project access: prohibited
- Git commit/push: not executed
- Secret/raw User ID/full webhook payload recorded: none

## Root Cause

Worker queued codex_task records already included `created_at`, but the local monitor normalized task records without preserving that field. The monitor then rewrote the same task key during claim/completed/failed transitions, so completed task records lost the hard schema field.

## Change Summary

- Monitor `normalizeTask()` now preserves `created_at`.
- Monitor `createSyntheticTask()` now keeps the normalized `created_at` instead of overwriting it during queued task creation.
- Completed task records preserve the original `created_at` because lifecycle records reuse the same normalized task object.
- Failed task records preserve the original `created_at`.
- Codex result records now include `created_at` for both completed and failed results.
- No change to smoke file behavior, LINE visible copy, finalizer exactly-once, idea_create, Dropbox JSON schema, or Worker routing.

## Verification

- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `npx wrangler deploy --dry-run`: PASS
- Worker `/health`: reachable
- invalid-signature `POST /line/webhook`: HTTP `401`
- Monitor health: `ready`

## Remote No-Secret Selftest

- Task id: `codex-created-at-selftest-20260718113900`
- Request id: `pline-v3-codex-created-at-selftest-20260718113900`
- Marker: `T2400-20260718113900`
- Selftest disabled live LINE finalizer callback.
- Monitor result: `completed`
- Smoke file content readback: `Codex 任務測試成功`
- Remote completed task record includes `created_at`.
- Remote result record includes the same `created_at`.
- Remote result record:
  - `status=completed`
  - `tests=PASS`
  - `commit=null`
  - `error=null`

## Deployment Note

This FIX changed only the local monitor lifecycle/result writer and tests, but the `_03` Worker was redeployed per Gate handoff requirements.

- Worker version after redeploy: `ca9001fa-cf03-43f7-9911-33f6301dd668`
- Worker dry-run: PASS
- Worker `/health`: reachable
- invalid-signature `POST /line/webhook`: HTTP `401`

## TEST Handoff

TEST should rerun the live Codex Task Gate and confirm:

- `codex_task:v1:task:<task_id>` retains `created_at` after completed state.
- `codex_task:v1:result:<task_id>` includes matching `created_at`.
- The same `task_id` is used through queued/claimed/completed or failed lifecycle.
- Existing smoke file, LINE finalizer, duplicate/replay, failed path, idea_create, and Dropbox regressions remain PASS.
