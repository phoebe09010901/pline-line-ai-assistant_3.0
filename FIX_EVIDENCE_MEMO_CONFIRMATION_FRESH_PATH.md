# FIX Evidence - Memo Confirmation Fresh Path

Date: 2026-07-19

Scope: `_03` TEST only.

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project access: prohibited
- Old `_02` resources: not used
- Secrets/raw LINE User ID/full webhook payload: not recorded

## Problem

Fresh Memo A6 confirmation for marker `M3901-20260719065628` reached LINE webhook signature/admin/idempotency stages, but did not emit confirmation-specific stages.

Observed no-secret state before recovery:

- Original delete request: `pline-v3-01KXVQECNYQ18QYT7YMK6SG3R9`
- Original delete task: `memo-d65db6f898980703929e21f2`
- Confirmation request: `pline-v3-01KXVQFWXAYBWPJHPEDXCJF80S`
- Original task state: `queued`, `confirmed=true`
- Confirmation record: pending / not consumed
- Pending queue: missing
- Missing stages: `crud_confirmation_requeued`, `crud_confirmation_reply_completed`

## Root Cause

The live confirmation path needed stronger post-idempotency observability and durability:

- Plain confirmation text can arrive without the `備忘錄` prefix, so CRUD confirmation must run before normal domain/n8n routing.
- The confirmation handler did not persist a no-secret stage immediately before lookup, so live failures after idempotency were hard to distinguish.
- The event-level confirmation completion stage was scheduled asynchronously, which made TEST evidence unreliable if the handler returned quickly.
- Safe punctuation variants such as `確認。` needed to be accepted by the same branch.

## Repair

- CRUD confirmation is handled before Codex approval and before n8n routing.
- Added awaited event stages:
  - `crud_confirmation_check_started`
  - `crud_confirmation_no_pending`
  - `crud_confirmation_requeued`
  - `crud_confirmation_reply_completed`
- `crud_confirmation_check_started` records only safe booleans/counts:
  - `is_confirmation_text`
  - `has_actor_fingerprint`
  - `pending_found`
  - `candidate_count`
- Valid confirmation writes the original task back as `queued + confirmed=true`, restores `crud_task:v1:pending:<task_id>`, consumes the actor-scoped confirmation, and returns webhook HTTP 200.
- Confirmation text accepts safe variants such as `確認。`, `確認！`, and `確認刪除`.
- No n8n call is made for confirmation text.

## M3901 Recovery

Recovery was guarded by no-secret checks:

- Task existed.
- Task domain/operation matched `memo` / `memo_delete`.
- Task status was `queued`.
- Task was already `confirmed=true`.
- Confirmation record was pending and unused/absent-used.

Recovery action:

- Restored `crud_task:v1:pending:memo-d65db6f898980703929e21f2`.
- Marked confirmation consumed.
- Launchd monitor claimed and completed the delete task.

Recovery result:

- Task status: `completed`
- Result status: `completed`
- CRUD final state: `completed`
- `crud_task_final_push_completed`: present on original delete request
- Pending key: absent
- Remote pending queues: `crud=0`, `idea=0`, `codex=0`
- Runner heartbeat: `ready`

## Deployment

- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Worker version from deploy output: `4951b808-48a6-4317-a6f3-4d4055ddcce8`
- Wrangler deployment id observed after deploy: `2b5b9af6-fabe-43ec-a522-d7ce589d39f8`
- Monitor reload: not required; existing runner processed recovered task

## Validation

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- `/health`: reachable; required env present; n8n target is production `/webhook/pline-v3-test-ai-agent`
- Invalid LINE signature POST `/line/webhook`: `401`
- Remote pending queues: empty for CRUD, idea, and codex prefixes
- Secret/private scan effective hits: `0`

## TEST Handoff

TEST should rerun fresh Memo A6 or a fresh full Memo A1-A6.

Expected confirmation evidence for a fresh `確認` event:

- `crud_confirmation_check_started`
- `crud_confirmation_requeued`
- `crud_confirmation_reply_completed`
- No `n8n_background_started` for the confirmation request
- Original delete task becomes terminal `completed`
- Exactly one LINE completion final
