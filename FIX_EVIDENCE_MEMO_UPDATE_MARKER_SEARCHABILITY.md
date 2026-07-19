# FIX Evidence - Memo Update Marker Searchability

Date: 2026-07-19

Scope: `_03` TEST only.

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project access: prohibited
- Old `_02` resources: not used
- Secrets, raw LINE User ID, and full webhook payload were not recorded.

## Problem

Fresh Memo A4 failed after A3 completed for marker `M4101-20260719072959`.

No-secret TEST summary:

- A3 parsed update body correctly:
  - `query`: marker
  - `new_content`: updated water amount
- A3 task completed.
- A4 search by the same marker returned no matching memo.

Root cause shape:

- The update executor replaced `memo.content` with the new content.
- Search matched only `memo.content`.
- The original marker existed only in the pre-update content, so marker-based searchability was lost after update.

## Repair

- Memo JSON now includes safe `search_keys`.
- `memo_create` seeds `search_keys` from memo markers found in the content.
- `memo_update` preserves the original target query/marker in `search_keys` while replacing user-visible `content` with the new content.
- Memo search matches either:
  - `memo.content.includes(query)`, or
  - exact `memo.search_keys.includes(query)`.
- No broad fuzzy search was added.
- Search keys reject path-like values and are capped in count/length.

## Focused Coverage

- Create a memo with a marker.
- Update via `把 <marker> 的內容改成 <new text>`.
- Stored content becomes the new content.
- Stored `search_keys` retain the original marker.
- Search by the marker returns the updated memo.
- Search reply includes the updated amount and excludes the stale amount and command prefix.

## Validation

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- Worker `/health`: PASS; required env present
- Invalid LINE signature POST `/line/webhook`: `401`
- Remote pending queues: `crud=0`, `idea=0`, `codex=0`
- Secret/private scan effective hits: `0`

## Deployment

- Worker code changed: no
- Worker deploy: not required
- Current Worker version remains: `d0084e7a-e209-4eb7-86ca-76e15222cec9`
- Monitor launchd runner: reloaded, state `running`, heartbeat `ready`

## TEST Handoff

TEST should rerun fresh Memo A1-A8.

Expected A4 behavior:

- Search by the original marker finds exactly one updated memo.
- Search visible result reflects the updated content.
- Search visible result does not show stale content or command syntax such as `新增：`.
