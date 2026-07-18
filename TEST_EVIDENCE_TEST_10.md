# TEST Evidence: TEST-10

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
- FIX-13 evidence confirmed `_03` LINE channel `菲比智能客服 測試_03` / `2010748091`
- FIX-13 evidence confirmed `Use webhook`, webhook redelivery, and error statistics aggregation enabled
- FIX-13 evidence confirmed LINE official endpoint API active=true and LINE Developers Verify Success
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
記一下：[REDACTED_IDEA_CONTENT]
```

Observed evidence:

- LINE app target chat: `菲比智能客服 測試_03`
- Visible LINE ACK for run 1: not observed during the test window
- KV marker readback immediately after send: `Value not found`
- KV marker readback after additional wait: `Value not found`
- Final KV marker readback after redelivery/background wait: `Value not found`

Gate 1 result:

```text
N8N MINIMAL PATH PASS: not marked
```

Reason:

```text
Gate 1 run 1 did not produce durable `evidence:v1` marker evidence or visible LINE ACK. The required three consecutive evidenced successes cannot be met.
```

## Gate 2 Attempt

Gate 2 was not executed because Gate 1 run 1 failed and the three-consecutive Gate 1 condition was already broken.

```text
CODEX MINIMAL PATH PASS: not marked
```

## Conclusion

```text
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must inspect why user-sent LINE messages in the confirmed `_03` LINE app chat still do not produce Worker durable evidence after FIX-13, despite LINE official Verify and endpoint active=true passing.
```
