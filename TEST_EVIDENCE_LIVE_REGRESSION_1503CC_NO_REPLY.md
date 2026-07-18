# TEST Evidence: Live Regression 1503cc No Reply / Read Observation

Date: 2026-07-18
Local time: 15:03-15:08 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project / `_02` access: not used
- Git: not run
- Secrets / raw LINE User ID / full webhook payload: not output and not written

## Field Report

菲比 reported a live LINE input around 15:03 CST:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

No new LINE message was sent by TEST.

## Health Snapshot

- Worker `/health`: HTTP `200`
- Worker reply mode: `no_visible_ack_background_n8n`
- Codex final mode: `monitor_callback_exactly_once`
- Required env flags: true
- Monitor health: `ready`
- Monitor supported fixed actions: `create_smoke_file`, `save_idea_json`

## Request Location

Because the message had no T-code marker, TEST used approximate time, latest remote `evidence:v1:summary:*` keys, stage timestamps, and recent Dropbox file times.

Identified request id:

```text
pline-v3-01KXT0JM1YHRN0W22P7C147AJW
```

No marker was present in the summary.

## Durable Evidence

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

n8n contract evidence:

- `intent`: `idea_create`
- `tool_called`: `idea_create`
- `saved_record`: `1`
- `request_id_mismatch`: absent

Task state:

- Task id: `idea-82487259686e7b01ced7621a`
- Action: `save_idea_json`
- Status: `pending`
- Claimed at: missing
- Completed at: missing
- Final state: missing

Missing:

- `monitor_claimed`
- `idea_json_saved`
- `idea_json_file_written`
- `idea_json_final_push_completed`
- `idea_json_final_callback_completed`

Dropbox readback:

- No new Dropbox idea JSON existed after 14:50 CST in the fixed `_03` Dropbox directory.
- No Dropbox JSON matched `1503` / water content.

## Diagnosis

```text
The 15:03 1503cc message reached Worker, passed signature/admin/idempotency, returned webhook HTTP 200, and completed n8n as idea_create. It did not fail with request_id_mismatch. It stopped after save_idea_json enqueue because the idea task remained pending and was not claimed by monitor, so no Dropbox JSON and no final LINE push were produced.
```

Root-cause comparison:

- Same shape as the original `1153` pending-monitor case before recovery.
- Not the same as `T2601` / 12:53 request-id mismatch failures.
- Different from `T2701` and `T2801`, which passed when TEST explicitly had monitor poll running before the live message.

## LINE Read Observation

- 菲比 appshot: some earlier messages showed gray `已讀`.
- Latest 15:03 message did not stably show `已讀`.
- Computer Use accessibility tree confirmed the target window was `菲比智能客服 測試_03`, but did not expose stable `已讀` text for the latest message.
- This is recorded as LINE desktop / LINE OA setting observation only.
- It is not treated as proof for or against webhook HTTP `200`, Worker receipt, n8n completion, Dropbox write, or final push.

## Conclusion

```text
LIVE REGRESSION 1503CC NO REPLY FAILED
```

Required handoff:

```text
FIX must provide a durable always-on monitor/queue runner or Worker-side timeout/failure final for save_idea_json tasks that remain pending. N8N is not the blocker for this request because n8n completed successfully. LINE read-state should remain a separate LINE desktop/OA setting observation.
```
