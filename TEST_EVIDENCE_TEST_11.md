# TEST Evidence: TEST-11

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
- FIX-14 evidence confirmed Worker version `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`.
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

## LINE App Control

- Computer Use confirmed the active LINE window title: `菲比智能客服 測試_03`.
- The target was not an `_02` or old-name chat.
- No login, CAPTCHA, 2FA, phone scan, or consent prompt appeared.

## Gate 1 Attempt

Gate 1 run 1 sent:

```text
記一下：今天開始建立 _03 T1101-20260718051847
```

Sanitized Cloudflare tail evidence for run 1:

- Worker version: `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`
- Worker response: HTTP `200`
- Request source: official LINE webhook user agent observed
- `line_event_received`: yes
- `signature_pass`: yes
- `admin_pass`: yes
- `idempotency_pass`: yes
- `line_fast_reply_completed`: yes
- `n8n_background_started`: yes
- `n8n_background_completed`: yes
- `intent`: `idea_create`
- `status`: `completed`
- `tool_called`: `idea_create`
- `saved_record`: `1`
- `codex_task`: `0`

Durable evidence readback for run 1:

- KV marker `evidence:v1:marker:T1101-20260718051847`: `Value not found`
- KV request stage prefix for the tail-observed request id: no stage keys found

Gate 1 result:

```text
N8N MINIMAL PATH PASS: not marked
```

Reason:

```text
Runtime tail shows the idea_create path completed, but TEST-11 required durable marker/request_id evidence as primary proof. The required `evidence:v1` KV records were missing, so the three-consecutive Gate 1 PASS condition cannot be marked.
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
FIX must repair or explain why FIX-14 runtime completion does not persist `evidence:v1` marker/request stage records in `_03` RUNTIME_KV, then return to TEST.
```
