# TEST Evidence: TEST-12

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Target LINE app chat: `菲比智能客服 測試_03`
- Old project access: none
- Secrets, tokens, raw LINE User IDs, raw LINE signatures, and full LINE message text: not recorded

## Readiness

- `pwd -P`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- FIX-15 evidence confirmed Worker version `5a41bd15-789f-43ce-9bd0-2365d9dcef21`.
- Worker `/health`: reachable
- Required env flags: true for `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TEST_ADMIN_USER_IDS`, `N8N_WEBHOOK_URL`, and `N8N_SHARED_SECRET`
- Worker modes:
  - `line_reply_mode`: `fast_ack_then_background_n8n`
  - `codex_task_final_mode`: `background_push_final`
- Evidence block:
  - persistence: `RUNTIME_KV`
  - prefix: `evidence:v1`
  - read path: `/test/evidence`
  - guard header: `x-pline-v3-shared-secret`
- KV namespace used for fallback readback: `pline-v3-test-runtime`
- KV namespace id: `10cdfe018b3942b483faeaca6e517ae5`
- Worker source/config evidence shows FIX-15 marker-first persistence and deterministic stage keys.

## LINE App Control

- Computer Use confirmed the active LINE window title: `菲比智能客服 測試_03`.
- The target was not an `_02` or old-name chat.
- No login, CAPTCHA, 2FA, phone scan, or consent prompt appeared.

## Gate 1 Attempt

Gate 1 run 1 sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Observed evidence:

- LINE app target chat: `菲比智能客服 測試_03`
- Visible LINE fast ACK for run 1: observed in LINE app after the sent message
- KV marker `evidence:v1:marker:T1201-20260718053133`: `Value not found` across repeated readbacks
- KV marker prefix `evidence:v1:marker:T1201`: empty
- KV request stage prefix `evidence:v1:request:`: no matching stage records found

Gate 1 result:

```text
N8N MINIMAL PATH PASS: not marked
```

Reason:

```text
The LINE fast ACK was visible, but FIX-15 durable marker/stage evidence was still absent. TEST-12 requires no-secret marker/stage evidence for Gate proof, so the three-consecutive Gate 1 PASS condition cannot be marked.
```

## Gate 2 Attempt

Gate 2 was not executed because Gate 1 run 1 could not be marked PASS under the durable evidence requirement.

```text
CODEX MINIMAL PATH PASS: not marked
```

## Conclusion

```text
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must inspect why the deployed FIX-15 Worker can produce a visible LINE fast ACK while `_03` RUNTIME_KV still has no `evidence:v1` marker or deterministic request stage records for the Gate marker.
```
