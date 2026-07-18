# TEST Evidence: N8N request_id Recurrence Repair Live Verification

Date: 2026-07-18
Local time: 13:19-13:24 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project / `_02` access: not used
- Git: not run
- Secrets / raw LINE User ID / full webhook payload: not output and not written

## Precheck

- `pwd -P`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker `/health`: HTTP `200`
- Worker reply mode: `no_visible_ack_background_n8n`
- Codex final mode: `monitor_callback_exactly_once`
- Required env flags: true
- Monitor poll: started before live LINE message
- LINE app target: `菲比智能客服 測試_03`

## Live Test Message

```text
記一下：今天喝水提醒修復驗證 T2601-20260718131959
```

Marker:

```text
T2601-20260718131959
```

Request id:

```text
pline-v3-01KXSTP8HJ3AF374NNY5W6KV86
```

## Durable Evidence

Present:

- `line_event_received`
- `signature_pass`
- `admin_pass`
- `idempotency_pass`
- `line_visible_ack_skipped`
- `webhook_http_200_returned`
- `n8n_background_started`
- `n8n_background_contract_failed`

Failure reason:

```text
request_id_mismatch
```

Missing:

- `n8n_background_completed`
- `intent=idea_create`
- `tool_called=idea_create`
- `idea_json_save_enqueued`
- `monitor_claimed`
- `idea_json_file_written`
- `idea_json_final_push_completed`

Dropbox:

- No `save_idea_json` task was created for this request.
- No Dropbox JSON was attributed to this T2601 marker.

LINE UI observation:

- No new bot final reply appeared in the LINE desktop accessibility tree after the live message.

## 12:53 Old Request

The prior 12:53 request remains useful as comparison evidence:

```text
pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF
```

It had the same failure shape:

- Worker received
- `signature/admin/idempotency` PASS
- webhook HTTP `200`
- n8n started
- `n8n_background_contract_failed`
- reason `request_id_mismatch`
- no `save_idea_json` task

Because both failures occur before task enqueue, monitor bounded drain / targeted recovery cannot repair them.

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
- idea_create / Dropbox / duplicate / idempotency remain covered by focused local tests.

## Conclusion

```text
N8N REQUEST_ID RECURRENCE REPAIR LIVE VERIFY FAILED
```

Diagnosis:

```text
The synthetic N8N harness may pass, but the live production webhook path used by Worker still returns a contract shape that fails Worker validation with request_id_mismatch. The failure occurs before idea task enqueue, so monitor/poller availability is not the blocker for this new live run.
```

Required handoff:

```text
N8N/FIX must inspect the live production workflow execution for request pline-v3-01KXSTP8HJ3AF374NNY5W6KV86, confirm the published production webhook version actually uses the canonical Normalize Input request_id, and align the live response contract before TEST can open the next Computer Use minimal Gate.
```
