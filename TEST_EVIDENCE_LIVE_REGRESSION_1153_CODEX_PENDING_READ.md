# TEST Evidence: Live Regression 1153 / Codex Pending / LINE Read Observation

Date: 2026-07-18
Local time: 12:38 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project / `_02` access: not used
- Git: not run
- Secrets / raw LINE User ID / full webhook payload: not output and not written

## Health Snapshot

- Worker `/health`: HTTP `200`
- Worker reply mode: `no_visible_ack_background_n8n`
- Codex final mode: `monitor_callback_exactly_once`
- Codex finalizer path: `/test/codex-finalize`
- Monitor health: `ready`
- Monitor supported fixed actions: `create_smoke_file`, `save_idea_json`
- Remote runtime KV namespace: `_03` namespace `10cdfe018b3942b483faeaca6e517ae5`

## Field Report A: 1153 idea_create No Reply

Safe request id:

```text
pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R
```

No-secret evidence found:

- `line_event_received`: present
- `signature_pass`: present
- `admin_pass`: present
- `idempotency_pass`: present
- `line_visible_ack_skipped`: present
- `webhook_http_200_returned`: present
- `n8n_background_started`: present
- `n8n_background_completed`: present
- `intent`: `idea_create`
- `tool_called`: `idea_create`
- `saved_record`: `1`
- `idea_json_save_enqueued`: present
- `idea_json_final_outbox_pending`: present

Missing evidence:

- `monitor_claimed`: missing
- `idea_json_file_written`: missing
- `idea_json_final_push_completed`: missing
- Durable final state: missing

Remote task state:

- Task prefix: `idea_json:v1`
- Task id: `idea-8748409c3efdcc4f5363d2eb`
- Action: `save_idea_json`
- Status: `pending`
- Claimed at: missing
- Completed at: missing

Dropbox readback:

- New JSON files existed around the time window, but no safe content check matched `1153` or the course-video idea.
- No JSON file could be attributed to this field report.

Diagnosis:

```text
Worker and n8n accepted the idea_create request, but the save_idea_json monitor task stayed pending. The live failure is after n8n contract success and before monitor claim / Dropbox write / finalizer push.
```

## Field Report B: Codex Computer-Use Request Pending

Safe request id:

```text
pline-v3-01KXSP35BTPS6GH5VM25JF9BJV
```

Safe task id:

```text
pline-v3-codex-1784347208503
```

No-secret evidence found:

- `line_event_received`: present
- `signature_pass`: present
- `admin_pass`: present
- `idempotency_pass`: present
- `line_visible_ack_skipped`: present
- `webhook_http_200_returned`: present
- `n8n_background_started`: present
- `n8n_background_completed`: present
- `intent`: `codex_task`
- `tool_called`: `codex_task`
- `codex_task_enqueued`: present
- `codex_task_processing_notice_completed`: present

Remote task state:

- Task prefix: `codex_task:v1`
- Status: `queued`
- Action stored: `create_smoke_file`
- Result record: missing
- Final state: missing
- Monitor claimed: missing

Diagnosis:

```text
The processing message was legitimately delivered after enqueue, but no monitor claim/result/finalizer happened afterward. Separately, the live user request was outside the current fixed safe smoke-task scope, yet n8n/Worker accepted it as a codex_task with action create_smoke_file. This should not stay queued or later execute the smoke action as if it satisfied the request.
```

## LINE Read Receipt Observation

- 菲比 reported LINE desktop still did not clearly show `已讀`.
- This is recorded as a LINE desktop / LINE Developers / LINE OA Manager setting observation.
- It is not treated as proof for or against:
  - webhook HTTP `200`
  - `line_visible_ack_skipped`
  - final push delivery
  - Dropbox JSON persistence
- This TEST turn did not modify LINE Developers or OA Manager settings.
- Follow-up should inspect only `_03` LINE Developers / LINE OA Manager read-receipt or chat-mode settings with Computer Use. If login, 2FA, CAPTCHA, phone scan, or person-only consent appears, stop for 菲比.

## Conclusion

Main live regression:

```text
The current live design depends on an external/local _03 monitor poller being active. Both field reports created remote KV work that remained unclaimed, so user-visible final replies were not sent.
```

Additional safety regression:

```text
Out-of-scope codex_task requests can be classified/enqueued as the fixed smoke action instead of receiving a natural unsupported/failed final.
```

Recommended handoff:

```text
FIX: provide a durable live monitor runner/daemon or Worker-side timeout/failure final for unclaimed monitor work; reject or fail unsupported codex_task instructions naturally; keep LINE read-receipt settings as a separate _03 OA/Developers UI check.
```
