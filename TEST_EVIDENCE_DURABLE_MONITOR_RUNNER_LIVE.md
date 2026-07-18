# TEST Evidence: Durable Monitor Runner Live idea_create

Date: 2026-07-18
Local time: 15:20-15:27 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project / `_02` access: not used
- Git: not run
- Secrets / raw LINE User ID / full webhook payload: not output and not written

## Runner Precheck

No manual monitor poll / claim-task / drain command was run by TEST.

launchd:

- Label: `com.pline.v3.test.codex-monitor`
- State: `running`
- Working directory: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Program: project-local monitor runner through Node
- Last exit code: never exited

Heartbeat before live send:

- Path: `runtime/monitor-runner/heartbeat.json`
- Status: `ready`
- Updated at: `2026-07-18T07:20:12.185Z`
- Monitor: `pline-v3-test-codex-monitor`

Baseline queue:

- `idea_json:v1:pending:*` count before T2901: `1`
- The baseline pending key pointed to task `idea-0dde004dabcab361ed557fff`, whose task record was already `completed`.
- This indicated a stale completed pending index key existed before the T2901 live send.

## Live Test Message

LINE target:

```text
菲比智能客服 測試_03
```

T-code used:

```text
T2901-20260718152036
```

Message:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Request id:

```text
pline-v3-01KXT1KRBW5MSP8WDT9QR2A3Y4
```

## Durable Worker / n8n Evidence

Present:

- `line_event_received`
- `signature_pass`
- `admin_pass`
- `idempotency_pass`
- `line_visible_ack_skipped`
- `webhook_http_200_returned`
- `n8n_background_started`
- `n8n_background_completed`
- `idea_json_save_enqueued`
- `idea_json_final_outbox_pending`

n8n contract:

- `intent`: `idea_create`
- `tool_called`: `idea_create`
- `saved_record`: `1`
- `request_id_mismatch`: absent

## Pending Index / Runner Evidence

Task id:

```text
idea-4a47aede9a419394a2967bd0
```

Task state after waiting for launchd runner:

- Status: `pending`
- Claimed at: missing
- Completed at: missing
- File name: missing

Pending index:

- T2901 pending key created: yes
- T2901 pending key removed: no
- T2901 pending key value shape: non-JSON pointer to `idea_json:v1:task:idea-4a47aede9a419394a2967bd0`
- Remaining `idea_json:v1:pending:*` count: `2`
- Remaining pending keys:
  - stale completed task pending key: `idea_json:v1:pending:idea-0dde004dabcab361ed557fff`
  - T2901 pending key: `idea_json:v1:pending:idea-4a47aede9a419394a2967bd0`

Runner heartbeat after waiting:

- Status: `error`
- Updated at: `2026-07-18T07:25:30.603Z`
- Last result: `ok=false`, `drained=0`, `claimed=false`
- Safe reason summary: pending index cleanup failed while trying to delete the stale completed pending key.

Runner claim source:

- `monitor_claimed`: absent for T2901
- No durable evidence showed launchd runner claiming T2901.

## Dropbox / Final Evidence

T2901 Dropbox JSON:

- Created: no
- JSON parse/schema: not applicable because no file was produced
- Raw LINE User ID check: no T2901 JSON file exists

Final LINE evidence:

- `idea_json_final_push_completed`: absent
- `idea_json_final_callback_completed`: absent
- LINE final: not evidenced

LINE UI observation:

- LINE desktop target window remained `菲比智能客服 測試_03`.
- No reliable readable final text was exposed by the accessibility tree.

## 1503 Recovery / Duplicate Check

Recovered 1503 file:

```text
idea-20260718-150321-82487259686e.json
```

Readback:

- File count for exact recovery filename: `1`
- JSON parse: PASS
- Schema: PASS, exactly 9 allowed fields
- Content boolean check: includes `1503` and water concept
- Raw LINE User ID shape: not found

Duplicate result:

```text
No duplicate 1503 recovery file was observed.
```

## Minimal Regression

Commands:

```text
node worker/test/worker.test.mjs
node monitor/test/monitor.test.mjs
```

Results:

- Worker tests: PASS (`worker skeleton tests PASS`)
- Monitor tests: PASS (`monitor skeleton tests PASS`)
- Codex `capability_not_yet_enabled` guard remains covered by Worker tests.

## Conclusion

```text
DURABLE MONITOR RUNNER LIVE IDEA_CREATE FAILED
```

Reason:

```text
The live Worker/n8n path succeeded and created a T2901 pending index entry, but the launchd runner did not claim it. Runner heartbeat changed from ready to error because cleanup of a stale completed pending key failed. The queue still contains two idea pending keys, including T2901.
```

Required handoff:

```text
FIX must repair pending-index cleanup and runner error handling so stale completed pending keys do not block scanning/claiming later tasks. After repair, rerun this TEST without manual poll/claim/drain.
```
