# FIX Evidence: Memo Confirmation Handler Path

Date: 2026-07-19

Scope:

- Project: `菲比 LINE 智能助理_03`
- Root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Monitor: `pline-v3-test-codex-monitor`
- Dropbox boundary: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old projects, `_02`, old Dropbox data, old workflows, secrets, raw LINE User ID, and full webhook payloads were not used.

## TEST Failure Input

Latest fresh Memo run:

- A1 create: PASS
- A2 search: PASS
- A3 update: PASS
- A4 search: PASS
- A5 delete request: PASS, confirmation prompt shown and no direct delete
- A6 confirmation: event reached line/signature/admin/idempotency evidence, but `crud_confirmation_reply_completed` was missing

Observed state after A6:

- Original delete task was `status=queued`, `confirmed=true`
- Confirmation id was present
- Confirmation record was still `pending`
- `crud_task:v1:pending:*` was empty
- User-visible completion final was missing

## Root Cause

- CRUD confirmation handling was too narrow around the post-idempotency path:
  - It accepted only exact text `確認`.
  - It ran after the Codex approval check even though CRUD confirmation is a plain no-prefix reply and should be handled first.
  - The evidence status did not distinguish `confirmed` from no-pending cases clearly enough.
- The live state also showed a partially accepted confirmation: original task was marked confirmed/queued, but pending index and confirmation consumption were incomplete.

## Repair

- CRUD confirmation handler now runs before Codex approval handling and before n8n/background routing.
- Confirmation text accepts safe variants:
  - `確認`
  - `確認。`
  - `確認！`
  - `確認刪除`
  - `確認刪掉`
  - `確認移除`
- Valid confirmation requeues the original task, writes `crud_task:v1:pending:<task_id>`, changes old final state to `confirmation_accepted`, marks confirmation used, and records `crud_confirmation_requeued`.
- Event-level evidence now records actual confirmation status such as `confirmed` or `no_pending_confirmation`.
- No-pending confirmation still replies with `目前沒有待確認的動作。`.

## Focused Tests

- Plain `確認。` without `備忘錄` prefix is handled before n8n.
- Actor-scoped pending delete confirmation is found and requeues the original task.
- `crud_confirmation_reply_completed` is written for the confirmation event.
- No n8n background stage is started for the confirmation event.
- Repeated confirmation does not requeue twice.
- No-pending confirmation remains a safe no-op reply.

## Live Recovery

The known M3801 delete task was safely recovered after deploy:

- task status: `completed`
- confirmed: `true`
- confirmation status: `used`
- pending key: removed
- result status: `completed`
- final status: `completed`
- monitor runner drained the recovered task

No raw LINE User ID, secret, full payload, Dropbox path, or private memo body was recorded in this evidence.

## Validation

- Worker syntax and unit tests: PASS
- Monitor syntax and unit tests: PASS
- Worker `/health`: PASS.
- Invalid signature `/line/webhook`: HTTP `401`.
- Remote `crud_task:v1:pending:*`: empty after recovery.
- Monitor launchd runner: `running`; heartbeat `ready`.

## Deploy

- Worker deployed version: `1208b460-c0eb-45dd-bbb5-a8939ced78de`.
- Monitor source was not changed in this fix; runner remained ready and processed the recovered task.

## TEST Handoff

TEST can rerun fresh Memo A1-A6. A focused A5/A6 rerun is also acceptable if current memo state is known unique.
