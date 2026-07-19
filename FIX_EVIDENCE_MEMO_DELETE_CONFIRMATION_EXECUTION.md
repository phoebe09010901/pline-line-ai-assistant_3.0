# FIX Evidence: Memo Delete Confirmation Execution

Date: 2026-07-19

Scope:

- Project: `菲比 LINE 智能助理_03`
- Root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Monitor: `pline-v3-test-codex-monitor`
- Dropbox boundary: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old projects, `_02`, old Dropbox data, old workflows, secrets, raw LINE User ID, and full webhook payloads were not used.

## TEST Failure Input

Latest Memo CRUD run:

- A1 create: PASS
- A2 search: PASS
- A3 update: PASS
- A4 search: PASS
- A5 delete request: PASS, returned `needs_confirmation` and did not delete
- A6 confirmation: Worker recorded confirmation handling, but the delete task stayed `confirmed=true`, `status=queued`, while `crud_task:v1:pending:*` was empty

## Root Cause

- Valid confirmation requeued the original task, but the prior `needs_confirmation` final state remained in `crud_task:v1:final:<task_id>`.
- A completed final callback could later be suppressed by that old final state.
- The confirmation path also lacked a durable stage that explicitly recorded the requeue transition.
- The observed live task needed the pending index restored after it had already been confirmed.

## Repair

- On valid confirmation, Worker now writes the original task back as `status=queued`, `confirmed=true`.
- Worker writes `crud_task:v1:pending:<task_id>` pointing to the original task key.
- Worker transitions the old final state to `confirmation_accepted`, so a later monitor completion is allowed to push the real completed final.
- Worker records `crud_confirmation_requeued` in no-secret evidence.
- Confirmation remains exactly-once: repeated confirmation sees the used confirmation and does not requeue again.
- Monitor already executes confirmed `memo_delete` by deleting only the uniquely matched `_03` memo JSON.

## Live Recovery

The known A6 delete task was safely recovered after deploy:

- task status: `completed`
- confirmed: `true`
- pending key: removed
- result status: `completed`
- final status: `completed`
- monitor runner `total_drained` increased by `1`

No raw LINE User ID, secret, full payload, Dropbox path, or private memo body was recorded in this evidence.

## Validation

- Worker syntax and unit tests: PASS
- Monitor syntax and unit tests: PASS
- Focused Worker coverage:
  - confirmation reply finds actor-scoped pending confirmation
  - original task is requeued with `confirmed=true`
  - final state transitions from `needs_confirmation` to `confirmation_accepted`
  - repeated confirmation does not requeue again
- Focused monitor coverage:
  - confirmed memo delete task reaches terminal `completed`
  - pending index is removed
  - target memo JSON file is removed
  - A5 no-direct-delete behavior remains intact
- Worker `/health`: PASS.
- Invalid signature `/line/webhook`: HTTP `401`.
- Remote `crud_task:v1:pending:*`: empty after recovery.
- Monitor launchd runner: `running`; heartbeat `ready`.

## Deploy / Reload

- Worker deployed version: `edb6529f-2fec-4c1a-81ee-8bc878eb3009`.
- Monitor launchd runner reloaded.

## TEST Handoff

TEST can rerun Memo CRUD from fresh A1, or recheck A6 evidence. Fresh full rerun is preferred for final gate confidence.
