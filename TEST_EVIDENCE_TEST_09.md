# TEST Evidence: TEST-09

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Target LINE app chat: `菲比智能客服 測試_03`
- Old project access: none
- Secrets, tokens, raw LINE User IDs, raw LINE signatures, and full LINE message text: not recorded

## Readiness

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
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

Pre-Gate note:

- A first probe was sent with malformed marker `T0901-2026071801438302`.
- This marker does not match the Worker pattern `Tdddd-YYYYMMDDHHMMSS` and was not counted as Gate evidence.

Valid Gate 1 candidate messages sent:

```text
記一下：今天開始建立 _03 T0901-20260718045141
記一下：今天開始建立 _03 T0901A-20260718045215
```

Observed evidence:

- LINE app target chat: `菲比智能客服 測試_03`
- Visible LINE ACK for valid candidates: not observed during the test window
- Wrangler live tail while sending `T0901A-20260718045215`: no Worker log emitted during the observation window
- KV marker readback:
  - `evidence:v1:marker:T0901-20260718045141`: `Value not found`
  - `evidence:v1:marker:T0901A-20260718045215`: `Value not found`

Gate 1 result:

```text
N8N MINIMAL PATH PASS: not marked
```

Reason:

```text
No durable KV evidence or live tail evidence showed LINE event=1 / Worker invocation=1 for the valid TEST-09 Gate 1 candidates.
```

## Gate 2 Attempt

Gate 2 was not executed because Gate 1 did not reach three consecutive evidenced successes.

```text
CODEX MINIMAL PATH PASS: not marked
```

## Conclusion

```text
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must inspect why live LINE messages to `菲比智能客服 測試_03` did not invoke Worker `pline-v3-test-line-gateway` or produce `evidence:v1` marker records after FIX-12, then return to TEST.
```
