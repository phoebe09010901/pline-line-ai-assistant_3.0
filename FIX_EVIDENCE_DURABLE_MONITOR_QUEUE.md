# FIX Evidence: Durable Monitor Queue Runner

Date: 2026-07-18

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Monitor: `pline-v3-test-codex-monitor`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project, `_02`, old Dropbox, old secret store, old logs, old User ID, raw User ID, secrets, and full webhook payload were not used or recorded.

## Problem

The live 15:03 idea message reached Worker and n8n, but stopped after `save_idea_json` enqueue because the local monitor was not always running.

No-secret request id:

```text
pline-v3-01KXT0JM1YHRN0W22P7C147AJW
```

No-secret task id:

```text
idea-82487259686e7b01ced7621a
```

## Repair

- Added a durable monitor `runner` command.
- Added project-local launchd agent:
  - `monitor/com.pline.v3.test.codex-monitor.plist`
- Added runner heartbeat:
  - `runtime/monitor-runner/heartbeat.json`
- Added Worker-side pending queue indexes:
  - `codex_task:v1:pending:<task_id>`
  - `idea_json:v1:pending:<task_id>`
- Monitor runner now scans the pending indexes instead of the full task history.
- Monitor removes pending indexes after terminal completion/failure/duplicate.
- Manual legacy scan remains available for old tasks that were created before pending indexes existed.
- Monitor can recover stale `claimed` / `running` records after a bounded stale-claim interval.
- Monitor preserves `final_reply_text` when it claims and rewrites an idea task.

## Live Recovery

Recovered pending task:

```text
idea-82487259686e7b01ced7621a
```

Result:

- `monitor_claimed`: present
- Dropbox JSON written: yes
- `idea_json_saved`: present
- `idea_json_file_written`: present
- `idea_json_final_callback_completed`: present
- `idea_json_final_push_completed`: present
- Task status: `completed`
- Final status: `completed`

Dropbox JSON file:

```text
idea-20260718-150321-82487259686e.json
```

No-secret JSON validation:

- parse: PASS
- schema keys: PASS
- `schema_version`: `1.0`
- `source`: `line`
- `intent`: `idea_create`
- `status`: `saved`
- `actor_fingerprint`: hash-only
- `line_event_key`: hash-only
- raw User ID present: no
- secret/token words present: no

## Runner Readiness

launchd:

- label: `com.pline.v3.test.codex-monitor`
- state: `running`
- `KeepAlive`: enabled
- `RunAtLoad`: enabled
- working directory: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`

Heartbeat:

- exists: yes
- status: `ready`
- monitor: `pline-v3-test-codex-monitor`
- mode: durable poll loop

Queue state after recovery:

- `idea_json:v1:pending:` empty
- `codex_task:v1:pending:` empty

## Deployment

Worker deployed:

```text
187a2454-4b4a-464d-9175-88d43017a833
```

Worker URL:

```text
https://pline-v3-test-line-gateway.phy4175.workers.dev
```

## Verification

- `node --check monitor/src/monitor.js`: PASS
- `node --check worker/src/index.js`: PASS
- `node --test monitor/test/monitor.test.mjs`: PASS
- `node --test worker/test/worker.test.mjs`: PASS
- Worker `/health`: reachable, required env true
- Monitor `health`: ready, runner and pending prefixes present
- Invalid signature `/line/webhook`: `401`
- Pending queue prefixes after recovery: empty

## Handoff

Hand off to TEST to send a new idea_create live message without manually starting monitor poll. Expected evidence: Worker/n8n enqueue, pending index, monitor claim, Dropbox JSON write, callback completed, and natural LINE final.

## Follow-up: Pending Index Cleanup Error Handling

Date: 2026-07-18

TEST live T2901 found the runner running but stuck on a stale completed pending index. Root cause:

- `wrangler kv key delete` was called with unsupported `--force`.
- The delete error escaped the single pending-key cleanup path.
- The runner marked heartbeat `error` and did not continue to the later active T2901 pending task.

Repair:

- Removed unsupported `--force` from Wrangler KV delete.
- Isolated per-key get/parse/delete failures.
- Missing or unreadable task records now best-effort cleanup and continue.
- Terminal task pending index cleanup is warning-only.
- Delete failure writes no-secret `monitor_pending_index_cleanup_warning` when a request id exists, then continues to later pending keys.
- Active pending tasks still claim exactly once, write Dropbox JSON, callback the Worker finalizer, and remove their own pending index.

T2901 recovery:

- T-code: `T2901-20260718152036`
- request id: `pline-v3-01KXT1KRBW5MSP8WDT9QR2A3Y4`
- task id: `idea-4a47aede9a419394a2967bd0`
- Dropbox JSON: `idea-20260718-152127-4a47aede9a41.json`
- task status: `completed`
- final status: `completed`
- `monitor_claimed`: present
- `idea_json_file_written`: present
- `idea_json_final_callback_completed`: present
- `idea_json_final_push_completed`: present

No-secret JSON validation:

- parse: PASS
- schema keys: PASS
- `actor_fingerprint`: hash-only
- `line_event_key`: hash-only
- raw User ID present: no
- secret/token words present: no

Queue / runner state after repair:

- launchd label `com.pline.v3.test.codex-monitor`: running
- heartbeat: `ready`
- `idea_json:v1:pending:` count: `0`
- `codex_task:v1:pending:` count: `0`
- 1503 recovery file `idea-20260718-150321-82487259686e.json`: count `1`

Verification:

- `node --check monitor/src/monitor.js`: PASS
- `node --check worker/src/index.js`: PASS
- `node --test monitor/test/monitor.test.mjs`: PASS
- `node --test worker/test/worker.test.mjs`: PASS
- Worker `/health`: reachable, required env true
- Worker deploy: not required for this follow-up; monitor-only repair.
