# TEST Evidence: N8N Respond Nonempty Live idea_create Verification

Date: 2026-07-18
Local time: 14:04-14:07 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project / `_02` access: not used
- Git: not run
- Secrets / raw LINE User ID / full webhook payload: not output and not written

## Precheck

- `pwd -P`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Monitor poll started before live LINE message.
- LINE app target: `菲比智能客服 測試_03`
- Worker reply mode: `no_visible_ack_background_n8n`
- Worker `/health`: HTTP `200`

## Live Test Message

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Marker:

```text
T2701-20260718140429
```

Request id:

```text
pline-v3-01KXSX7E4SRVM7CVZ3ST40GA6X
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
- `n8n_background_completed`
- `idea_json_save_enqueued`
- `monitor_claimed`
- `idea_json_saved`
- `idea_json_file_written`
- `idea_json_final_push_completed`
- `idea_json_final_callback_completed`

n8n contract evidence:

- `intent`: `idea_create`
- `tool_called`: `idea_create`
- `saved_record`: `1`
- `request_id_mismatch`: absent

## Dropbox Readback

- Task id: `idea-c49d33a3912574fb1d863961`
- Task status: `completed`
- File: `idea-20260718-140449-c49d33a39125.json`
- Exists: yes
- JSON parse: PASS
- Schema: PASS, exactly 9 allowed fields
- Content category check: matches the water-reminder idea
- Raw LINE User ID shape: not found

## LINE UI Observation

- LINE desktop target window remained `菲比智能客服 測試_03`.
- Accessibility tree changed after the live message, but did not expose readable bot final text.
- Durable `idea_json_final_push_completed` is the primary final-reply evidence for this TEST.

## Minimal Regression

Commands:

```text
node worker/test/worker.test.mjs
node monitor/test/monitor.test.mjs
```

Results:

- Worker tests: PASS (`worker skeleton tests PASS`)
- Monitor tests: PASS (`monitor skeleton tests PASS`)
- Codex `capability_not_yet_enabled` guard remains covered.
- idea_create / Dropbox / duplicate / idempotency remain covered by focused local tests.

## Conclusion

```text
N8N RESPOND NONEMPTY LIVE IDEA_CREATE PASS
```

Risk intentionally left for next handoff:

```text
n8n direct production webhook no-secret probe returned HTTP 200 before this TEST, so n8n-side shared-secret hardening remains required before the Computer Use minimal Gate proceeds.
```

Required next step:

```text
FIX/N8N hardens n8n-side shared-secret enforcement for the production webhook, then TEST can continue toward the Computer Use minimal Gate.
```
