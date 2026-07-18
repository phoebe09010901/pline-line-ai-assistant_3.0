# TEST Evidence: LINE Mark As Read Live Validation

Date: 2026-07-18
Local time: 15:56-16:00 CST

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

Launchd runner:

- Label: `com.pline.v3.test.codex-monitor`
- State: `running`
- Working directory: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Last exit code: never exited
- Heartbeat before live send: `ready`

Pending queue baseline:

- `idea_json:v1:pending:*`: `0`
- `codex_task:v1:pending:*`: `0`

Worker health:

- Worker: `pline-v3-test-line-gateway`
- Required env flags: true
- Runtime KV bound: true
- Idempotency KV bound: true
- Reply mode: `no_visible_ack_background_n8n`
- Codex final mode: `monitor_callback_exactly_once`

OA state:

- Pre-handoff state: OA Manager `_03` account `菲比智能客服 測試_03` / `@967fvhek`
- Pre-handoff state: Chat off, webhook enabled
- This TEST did not change OA settings.

## Live Message

LINE target:

```text
菲比智能客服 測試_03
```

T-code:

```text
T3001-20260718155646
```

Message:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Request id:

```text
pline-v3-01KXT3NXEQXYVE5Y52R97GQNFV
```

## LINE UI Observation

- First post-send accessibility tree did not expose `已讀`.
- Follow-up screenshot showed grey `已讀` near the latest T3001 sent message.
- This is recorded as LINE desktop UI observation only.
- UI observation is not mixed with durable Worker/KV proof.

## Durable Worker / n8n Evidence

Present stages:

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

n8n contract:

- `intent`: `idea_create`
- `tool_called`: `idea_create`
- `saved_record`: `1`
- `request_id_mismatch`: absent

Mark As Read durable stage:

- Actual stage: `line_mark_as_read_failed`
- Stage status: `failed`
- Token value present in evidence: no
- Raw User ID shape present in evidence: no
- Mark-as-read failure did not block webhook HTTP 200, n8n, Dropbox write, monitor callback, or final push.

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
idea-20260718-155735-8a4dff845617.json
```

Readback:

- Exists: yes
- JSON parse: PASS
- Schema: PASS, exactly 9 allowed fields
- Content category: matches read-validation idea
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
- Worker tests cover `line_mark_as_read_completed`, `line_mark_as_read_skipped_no_token`, and `line_mark_as_read_failed` behavior.
- No unsafe Computer Use open-webpage action was executed.

## Secret / Private Scan

- T3001 evidence did not contain read token value.
- T3001 evidence did not contain raw LINE User ID shape.
- Full webhook payload was not output or written.

## Conclusion

```text
LINE MARK AS READ LIVE PARTIAL
```

Reason:

- PASS: LINE desktop screenshot showed grey `已讀` near the latest T3001 message.
- PASS: Chat off did not break webhook delivery.
- PASS: idea_create / Dropbox JSON / monitor runner / final push did not regress.
- PARTIAL: durable Worker stage was `line_mark_as_read_failed`, not `line_mark_as_read_completed`.

Required next step:

```text
Hand off to FIX to inspect why live LINE Mark As Read API returned the failed stage while preserving the current successful idea_create/Dropbox/final path. No 菲比 action is required unless LINE/OA login, 2FA, CAPTCHA, phone scan, or person-only consent blocks the investigation.
```
