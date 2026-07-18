# FIX Evidence: Codex Task Minimal Closed Loop

Date: 2026-07-18T11:26:40+0800

## Scope

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Safe runtime directory: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke`
- Smoke file: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt`
- Required smoke file content: `Codex 任務測試成功`
- Old project access: prohibited
- Git commit/push: not executed
- Secret/raw User ID/full webhook payload recorded: none

## Change Summary

- Codex task record now uses a structured closed-loop shape:
  - `task_id`
  - `task_type=codex_task`
  - `project`
  - `project_path`
  - `instruction`
  - `status=queued`
  - `created_at`
- Worker stores task-scoped `finalize_token` and encrypted `line_user_ref` for live LINE final; raw LINE User ID is not stored.
- Worker sends only the natural processing notice after task enqueue succeeds:
  - `收到～這件事需要一點時間，我處理完成後再告訴妳 🛠️`
- Worker no longer sends codex_task completion final before monitor execution.
- Monitor claims queued codex tasks, writes the fixed smoke file, reads it back, and writes a result record.
- Completed result record shape includes:
  - `task_id`
  - `status=completed`
  - `summary`
  - `tests=PASS`
  - `changed_files`
  - `commit=null`
  - `error=null`
- Monitor calls Worker `/test/codex-finalize` after completion/failure.
- Worker validates task id, request id, and task-scoped token before sending the final LINE push.
- Worker records durable exactly-once final state under `codex_task:v1:final:<task_id>`.
- Repeated callbacks return already-completed behavior and do not send a second final.
- Failure path sends only:
  - `這次沒有順利完成，我先停在安全狀態，沒有假裝處理成功 🙏`

## Worker Deployment

- Worker: `pline-v3-test-line-gateway`
- URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Deployed version: `3f0f167c-71b1-4e89-aa1c-6f559507ed46`
- KV bindings observed by Wrangler dry-run/deploy:
  - `RUNTIME_KV`: `10cdfe018b3942b483faeaca6e517ae5`
  - `IDEMPOTENCY_KV`: `1f857def085d466abed722e9222002e3`

## No-Secret Readiness

- `/health`: reachable
- `/health` `codex_task_final_mode`: `monitor_callback_exactly_once`
- `/health` `codex_finalizer.path`: `/test/codex-finalize`
- `/health` codex smoke target path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt`
- `/health` codex smoke target content: `Codex 任務測試成功`
- Direct invalid-signature `POST /line/webhook`: HTTP `401`
- Invalid empty `POST /test/codex-finalize`: HTTP `400`
- Monitor health: `ready`

## Local and Remote Verification

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- `npx wrangler deploy --dry-run`: PASS
- `npx wrangler deploy`: PASS

Monitor selftest:

- Marker: `T2300-20260718093000`
- Request id: `pline-v3-codex-closed-loop-selftest-20260718093000`
- Task id: `codex-closed-loop-selftest-20260718093000`
- Selftest result: `completed`
- `codex_execution`: true
- `file_written`: true
- Local smoke file readback: `Codex 任務測試成功`
- Remote result record:
  - `status=completed`
  - `tests=PASS`
  - `commit=null`
  - `error=null`
- Remote evidence stages found:
  - `monitor_claimed`
  - `codex_execution_completed`
  - `smoke_file_written`
  - `codex_task_result_recorded`
  - `codex_task_final_callback_completed`

Selftest note:

- The selftest disabled live finalizer callback to avoid sending LINE messages during FIX verification.
- Live Gate should exercise the full callback and LINE final path with a real codex_task LINE event.

## TEST Handoff

TEST should run `Codex Task 最小工作閉環 Gate`:

- Send one explicit natural-language codex_task message to `_03` LINE channel.
- Expect one processing notice after safe enqueue/hand-off.
- Run or confirm monitor poll claims the task.
- Verify smoke file content exactly equals `Codex 任務測試成功`.
- Verify remote result record `status=completed`, `tests=PASS`, `commit=null`, `error=null`.
- Verify durable evidence:
  - `codex_task_enqueued`
  - `codex_task_processing_notice_completed`
  - `monitor_claimed`
  - `codex_execution_completed`
  - `smoke_file_written`
  - `codex_task_result_recorded`
  - `codex_task_final_callback_completed`
  - `codex_task_final_push_completed`
- Verify duplicate/replay does not re-execute and does not send a second final.
- Verify idea_create / Dropbox JSON regression remains PASS.
