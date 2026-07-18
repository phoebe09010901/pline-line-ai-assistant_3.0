# TEST Evidence: n8n Shared-Secret Hardening Direct Barrier and Live idea_create

Date: 2026-07-18
Local time: 14:15-14:19 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project / `_02` access: not used
- Git: not run
- Secrets / raw LINE User ID / full webhook payload: not output and not written

## n8n Direct No-Header Barrier

Probe:

- Target: production n8n webhook path for `_03`
- Header `x-pline-v3-shared-secret`: omitted
- Secret value: not used and not output
- Probe marker: `T2800-NO-HEADER-2`

Observed no-secret result:

- HTTP status: `200`
- Response parse: non-JSON / empty body
- Response body length: `0`
- Response keys: none
- Normal `idea_create` contract returned: no
- `intent=idea_create`: absent
- `tool_called=idea_create`: absent
- `saved_record`: absent

Barrier result:

```text
DIRECT NO-HEADER BARRIER PASS
```

Evidence limit:

```text
TEST verified the direct no-header probe did not return the normal idea_create contract. n8n-side full secret value comparison remains a future hardening step because the n8n variable is not yet enabled.
```

## Worker/Header Live idea_create

Monitor poll started before the live LINE message.

LINE target:

```text
菲比智能客服 測試_03
```

Live message:

```text
記一下：[redacted idea content] T2801-20260718141551
```

Marker:

```text
T2801-20260718141551
```

Request id:

```text
pline-v3-01KXSXWXAE94G82MCZEYQABCJ7
```

Durable evidence present:

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

Dropbox readback:

- Task id: `idea-a223c8a9017725be71c3b636`
- Task status: `completed`
- File: `idea-20260718-141633-a223c8a90177.json`
- Exists: yes
- JSON parse: PASS
- Schema: PASS, exactly 9 allowed fields
- Content category check: matches the hardening verification idea
- Raw LINE User ID shape: not found

LINE UI observation:

- LINE desktop target remained `菲比智能客服 測試_03`.
- Accessibility tree changed after the live message, but did not expose readable bot final text.
- Durable `idea_json_final_push_completed` is the primary final-reply evidence for this TEST.

Worker/header path result:

```text
WORKER HEADER LIVE IDEA_CREATE PASS
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
- Codex `capability_not_yet_enabled` guard remains covered.
- idea_create / Dropbox / duplicate / idempotency remain covered by focused local tests.

## Residual Risk

- n8n UI variable creation is currently disabled, so full n8n-side shared-secret value comparison is not yet enabled.
- The no-header barrier is passing and the Worker/header live path is passing.
- Full value comparison should be completed before opening the Computer Use minimal Gate.

## Conclusion

```text
N8N SHARED-SECRET HARDENING TEST PASS
```

Required next step:

```text
FIX opens next Gate: Computer Use minimal enablement, only allowing open_browser_page.
```
