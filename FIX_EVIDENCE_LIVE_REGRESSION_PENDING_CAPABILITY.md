# FIX Evidence: Pending Monitor / Capability Not Yet Enabled

Date: 2026-07-18

Scope:

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Runtime KV: `pline-v3-test-runtime`
- Idempotency KV: `pline-v3-test-idempotency`
- No old project, `_02`, old secret store, old logs, old User ID, raw User ID, secrets, or full webhook payload were used or recorded.

Root Cause:

- `idea_create` could remain pending when the local monitor was not claiming the queued `save_idea_json` task.
- A codex_task request for a capability not enabled in this Gate could be accepted as the fixed smoke action and remain in processing.
- This is not a permanent rejection of Computer Use. Browser/Computer Use actions require a later explicit authorization Gate.

Code Repair:

- Worker now checks codex_task user intent against the currently enabled fixed smoke capability before enqueue.
- If the request needs a capability not enabled in this Gate, Worker does not enqueue a smoke task and does not send a processing notice.
- The user-visible final is natural and truthful: the operation is not yet open and was not executed.
- Durable evidence uses capability-boundary terms:
  - `codex_task_capability_not_enabled`
  - `codex_task_capability_notice_completed`
  - reason `capability_not_yet_enabled`
- Monitor now supports bounded `drain`.
- Monitor now supports targeted `claim-task` for one known task id/action.
- Monitor now supports targeted `mark-capability-not-enabled` for legacy queued codex tasks that must be closed without executing them.

Live Recovery:

- Pending idea request `pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R` now has durable stages:
  - `monitor_claimed`
  - `idea_json_saved`
  - `idea_json_file_written`
  - `idea_json_final_callback_completed`
  - `idea_json_final_push_completed`
- Its task `idea-8748409c3efdcc4f5363d2eb` is `completed`.
- Capability-not-enabled codex request `pline-v3-01KXSP35BTPS6GH5VM25JF9BJV` now has durable stages:
  - `codex_task_capability_not_enabled`
  - `codex_task_result_recorded`
  - `codex_task_final_callback_completed`
  - `codex_task_final_failure_notice_completed`
- Its task `pline-v3-codex-1784347208503` is `failed`, result `tests=FAIL`, `changed_files=[]`, `commit=null`, `error=capability_not_yet_enabled`.
- No arbitrary Computer Use/browser action was executed.

Deployment / Readiness:

- Deployed Worker version: `493e4b8a-91da-479e-81e0-229fd1eb72c7`
- `/health`: reachable; required env present; Runtime KV and Idempotency KV bound.
- Synthetic invalid-signature `/line/webhook`: HTTP `401`.

Local Verification:

- `node --check worker/src/index.js`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- `npx wrangler deploy --dry-run`: PASS

TEST Handoff:

- Recheck that `1153` idea_create is saved and has final LINE push evidence.
- Recheck that the browser/Computer Use request is closed as `capability_not_yet_enabled`, with no arbitrary execution.
- Recheck that new not-yet-enabled capability requests do not enqueue smoke tasks and do not remain processing.
- Recheck existing idea_create, Dropbox JSON, Codex smoke, finalizer exactly-once, idempotency, and admin allowlist regressions.
