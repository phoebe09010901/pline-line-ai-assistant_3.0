# TEST Evidence: Live Regression Recovery Readback

Date: 2026-07-18
Local time: 12:38-12:52 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project / `_02` access: not used
- Git: not run
- Secrets / raw LINE User ID / full webhook payload: not output and not written

## Readiness

- `pwd -P`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker `/health`: HTTP `200`
- Worker reply mode: `no_visible_ack_background_n8n`
- Codex final mode: `monitor_callback_exactly_once`
- Codex finalizer path: `/test/codex-finalize`
- Latest `_03` Worker deployment version: `493e4b8a-91da-479e-81e0-229fd1eb72c7`
- Monitor health: `ready`
- Monitor supported fixed actions: `create_smoke_file`, `save_idea_json`
- Remote runtime KV namespace: `_03` namespace `10cdfe018b3942b483faeaca6e517ae5`

## 1153 idea_create Recovery

Request id:

```text
pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R
```

Task id:

```text
idea-8748409c3efdcc4f5363d2eb
```

Recovered evidence:

- `line_event_received`: present
- `signature_pass`: present
- `admin_pass`: present
- `idempotency_pass`: present
- `line_visible_ack_skipped`: present
- `webhook_http_200_returned`: present
- `n8n_background_completed`: present
- `intent`: `idea_create`
- `tool_called`: `idea_create`
- `saved_record`: `1`
- `idea_json_save_enqueued`: present
- `monitor_claimed`: present
- `idea_json_saved`: present
- `idea_json_file_written`: present
- `idea_json_final_push_completed`: present
- `idea_json_final_callback_completed`: present
- Task status: `completed`
- Final state: `completed`

Dropbox readback:

- File: `idea-20260718-115346-8748409c3efd.json`
- Exists: yes
- JSON parse: PASS
- Schema: PASS, exactly 9 allowed fields
- Content check: includes the reported `1153` marker and the course-video idea terms
- Raw LINE User ID shape: not found

Result:

```text
1153 idea_create recovery PASS
```

## Open-Webpage Codex Request Recovery

Request id:

```text
pline-v3-01KXSP35BTPS6GH5VM25JF9BJV
```

Task id:

```text
pline-v3-codex-1784347208503
```

Recovered evidence:

- `line_event_received`: present
- `signature_pass`: present
- `admin_pass`: present
- `idempotency_pass`: present
- `line_visible_ack_skipped`: present
- `webhook_http_200_returned`: present
- `n8n_background_completed`: present
- `intent`: `codex_task`
- `tool_called`: `codex_task`
- Processing notice: delivered before recovery
- `codex_task_capability_not_enabled`: present
- `codex_task_result_recorded`: present
- `codex_task_final_failure_notice_completed`: present
- `codex_task_final_callback_completed`: present
- Task status: `failed`
- Failure reason: `capability_not_yet_enabled`
- Result status: `failed`
- Result changed files: `0`
- Final state: `failure_notice_completed`

Negative checks:

- No `codex_execution_completed` evidence for this request
- No `smoke_file_written` evidence for this request
- No arbitrary Computer Use or browser action was executed by TEST
- No successful `create_smoke_file` result was recorded for this request

Result:

```text
capability_not_yet_enabled recovery PASS
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
- idea_create contract and Dropbox enqueue/save/finalizer coverage: PASS
- Dropbox duplicate/suppression coverage: PASS
- Codex smoke fixed-action coverage: PASS
- Capability guard for open-webpage / Computer Use request: PASS
- Duplicate/idempotency coverage: PASS

## LINE Read Receipt Observation

- LINE desktop `已讀` display remains a UI/OA setting observation only.
- It is not used as backend proof for webhook HTTP `200`, final push, Dropbox JSON write, or finalizer completion.
- This TEST turn did not change LINE Developers or OA Manager settings.

## Supplemental Live Case: 12:53 idea_create No Immediate Reply

菲比 reported a new live input around 12:53 CST:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

No new LINE message was sent by TEST.

Identified request id:

```text
pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF
```

No-secret evidence:

- `line_event_received`: present
- `signature_pass`: present
- `admin_pass`: present
- `idempotency_pass`: present
- `line_visible_ack_skipped`: present
- `webhook_http_200_returned`: present
- `n8n_background_started`: present
- `n8n_background_contract_failed`: present
- Failure reason: `request_id_mismatch`

Missing evidence:

- `n8n_background_completed`: missing
- `intent=idea_create`: missing
- `tool_called=idea_create`: missing
- `idea_json_save_enqueued`: missing
- `monitor_claimed`: missing
- `idea_json_file_written`: missing
- `idea_json_final_push_completed`: missing

Dropbox readback:

- Recent Dropbox JSON files were present after the recovery work, but none of the safely inspected files matched `2000` or the water reminder text.
- No Dropbox JSON could be attributed to this 12:53 message.

Diagnosis:

```text
This is not the same root cause as the original 1153 pending monitor case. The 12:53 message reached Worker and started n8n, but failed the Worker n8n contract with request_id_mismatch before any save_idea_json task was created. Because no idea task exists, bounded drain / targeted monitor recovery had nothing to claim.
```

Recommended handoff:

```text
N8N/FIX must repair the live request_id contract recurrence for idea_create. Monitor always-on/drain remains useful for pending tasks, but it cannot recover this case because the workflow failed before enqueue.
```

## Conclusion

```text
LIVE REGRESSION RECOVERY PARTIAL
```

Next handoff:

```text
First repair the new 12:53 n8n request_id_mismatch regression, then open the next Gate: Computer Use minimal enablement, only allowing open_browser_page.
```
