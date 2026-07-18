# TEST Evidence: Durable Monitor Runner Second Live idea_create

Date: 2026-07-18
Local time: 15:32-15:36 CST

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
- Last exit code: never exited

Heartbeat before live send:

- Status: `ready`
- Updated at: `2026-07-18T07:32:51.003Z`
- Last result: `ok=true`, `drain_complete`

Pending queue baseline:

- `idea_json:v1:pending:*`: `0`
- `codex_task:v1:pending:*`: `0`

## Live Test Message

LINE target:

```text
菲比智能客服 測試_03
```

T-code used:

```text
T2902-20260718153255
```

Message:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Request id:

```text
pline-v3-01KXT29N4CBP3J3AVDVKSDKZ91
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

## Pending Index / Runner Evidence

Task id:

```text
idea-ef60f64a6f511ce02c065eaa
```

Task state:

- Status: `completed`
- Claimed at: `2026-07-18T07:33:29.612Z`
- Completed at: `2026-07-18T07:33:42.725Z`
- Pending key exists after completion: no

Runner evidence:

- `monitor_claimed` stage present.
- `monitor_claimed` runner: `pline-v3-test-codex-monitor`.
- `idea_json_saved` runner: `pline-v3-test-codex-monitor`.
- `idea_json_file_written` runner: `pline-v3-test-codex-monitor`.
- `idea_json_final_callback_completed` runner: `pline-v3-test-codex-monitor`.
- No manual TEST poll/claim/drain was run.

Pending queue after completion:

- `idea_json:v1:pending:*`: `0`
- `codex_task:v1:pending:*`: `0`

Heartbeat after completion:

- Status: `ready`
- Updated at: `2026-07-18T07:35:20.673Z`
- Last result: `ok=true`, `drain_complete`

## Dropbox / JSON Evidence

Dropbox JSON:

```text
idea-20260718-153325-ef60f64a6f51.json
```

Readback:

- Exists: yes
- JSON parse: PASS
- Schema: PASS, exactly 9 allowed fields
- Content category check: matches the runner cleanup verification idea
- Raw LINE User ID shape: not found

## LINE Final Evidence

- Durable `idea_json_final_push_completed`: present
- Durable `idea_json_final_callback_completed`: present
- LINE desktop target window remained `菲比智能客服 測試_03`.
- Accessibility tree changed after the live message, but did not expose readable final text.
- Durable final evidence is primary.

## Duplicate Recovery Checks

1503 recovery:

- File: `idea-20260718-150321-82487259686e.json`
- Exact file count: `1`
- JSON parse/schema/raw-ID checks: PASS
- Duplicate file: absent

T2901 recovery:

- File: `idea-20260718-152127-4a47aede9a41.json`
- Exact file count: `1`
- JSON parse/schema/raw-ID checks: PASS
- Duplicate file: absent

T2902:

- File: `idea-20260718-153325-ef60f64a6f51.json`
- Exact file count: `1`
- JSON parse/schema/raw-ID checks: PASS

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
- No unsafe Computer Use open-webpage action was executed.

## Conclusion

```text
DURABLE MONITOR RUNNER SECOND LIVE IDEA_CREATE PASS
```

Required next step:

```text
RELEASE can perform git status, secret scan, commit, and push if the controller is ready to close this TEST scope. No 菲比 action is required.
```
