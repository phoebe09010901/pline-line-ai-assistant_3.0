# TEST Evidence: T3002 OA Chat Off Auto-Read with Mark-As-Read Disabled

Date: 2026-07-18
Local time: 16:06-16:08 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project / `_02` access: not used
- Git: not run
- Secrets / raw LINE User ID / full webhook payload: not output and not written

## Precheck

cwd:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03
```

Worker health:

- Worker: `pline-v3-test-line-gateway`
- Required env flags: true
- Runtime KV bound: true
- Idempotency KV bound: true
- Reply mode: `no_visible_ack_background_n8n`
- `line_mark_as_read.enabled`: `false`
- `line_mark_as_read.mode`: `disabled_chat_off_auto_read`
- Expected disabled stage: `line_mark_as_read_skipped_disabled`

OA state:

- Pre-handoff state: `_03` OA Manager account `菲比智能客服 測試_03 / @967fvhek`
- Pre-handoff state: Chat off, webhook enabled
- This TEST did not change OA settings.

Launchd runner:

- Label: `com.pline.v3.test.codex-monitor`
- State: `running`
- Working directory: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Heartbeat before send: `ready`

Pending queue baseline:

- `idea_json:v1:pending:*`: `0`
- `codex_task:v1:pending:*`: `0`

## Live Message

LINE target:

```text
菲比智能客服 測試_03
```

T-code:

```text
T3002-20260718160604
```

Message:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Request id:

```text
pline-v3-01KXT46DF26Q4N9C4GS1B6PC58
```

## LINE UI Observation

- First post-send screenshot did not clearly show `已讀` for the latest T3002 message.
- Follow-up screenshot showed grey `已讀` beside the latest T3002 sent message.
- This is recorded as LINE desktop UI observation only.

## Durable Worker / n8n Evidence

Present stages:

- `line_event_received`
- `signature_pass`
- `admin_pass`
- `idempotency_pass`
- `webhook_http_200_returned`
- `line_visible_ack_skipped`
- `line_mark_as_read_skipped_disabled`
- `n8n_background_started`
- `n8n_background_completed`
- `idea_json_save_enqueued`
- `monitor_claimed`
- `idea_json_saved`
- `idea_json_file_written`
- `idea_json_final_push_completed`
- `idea_json_final_callback_completed`

Absent for this request:

- `line_mark_as_read_failed`

n8n contract:

- `intent`: `idea_create`
- `tool_called`: `idea_create`
- `saved_record`: `1`
- `request_id_mismatch`: absent

Mark-as-read mode:

- API call disabled by config.
- Durable disabled stage: `line_mark_as_read_skipped_disabled`
- Reason: `LINE_MARK_AS_READ_DISABLED`
- Token value present in evidence: no
- Raw User ID shape present in evidence: no

No fixed ACK:

- `line_visible_ack_skipped` present.

## Monitor / Pending Queue

- Monitor claim source: launchd runner `pline-v3-test-codex-monitor`
- TEST did not run manual `monitor poll`, `claim-task`, or `drain`.
- Pending queue after completion:
  - `idea_json:v1:pending:*`: `0`
  - `codex_task:v1:pending:*`: `0`
- Heartbeat after completion: `ready`

## Dropbox / JSON Evidence

Dropbox JSON:

```text
idea-20260718-160636-04fe510ef176.json
```

Readback:

- Exists: yes
- JSON parse: PASS
- Schema: PASS, exactly 9 allowed fields
- Content category: matches read/chat-off validation idea
- Raw LINE User ID shape: not found
- `actor_fingerprint` raw User ID shape: not found
- `line_event_key` raw event/user ID shape: not found

## LINE Final Evidence

- Durable `idea_json_final_push_completed`: present
- Durable `idea_json_final_callback_completed`: present
- Natural final UI text was not used as primary proof.

## Regression

Commands:

```text
node worker/test/worker.test.mjs
node monitor/test/monitor.test.mjs
```

Results:

- Worker tests: PASS
- Monitor tests: PASS
- Worker tests cover disabled mark-as-read behavior.
- No unsafe Computer Use open-webpage action was executed.

## Secret / Private Scan

- T3002 evidence did not contain read token value.
- T3002 evidence did not contain raw LINE User ID shape.
- Full webhook payload was not output or written.

## Conclusion

```text
LINE READ CHAT OFF AUTO-READ T3002 PASS
```

Reason:

- PASS: LINE desktop screenshot showed grey `已讀` near the latest T3002 message.
- PASS: Worker health showed mark-as-read disabled in `disabled_chat_off_auto_read` mode.
- PASS: Durable evidence included `line_mark_as_read_skipped_disabled`.
- PASS: `line_mark_as_read_failed` was absent for this request.
- PASS: Chat off did not break webhook delivery.
- PASS: idea_create / Dropbox JSON / monitor runner / final push did not regress.

Required next step:

```text
RELEASE can perform git status, secret scan, commit, and push if the controller is ready to close this TEST scope. No 菲比 action is required.
```
