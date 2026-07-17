# TEST Evidence: TEST-13

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
- FIX-16 evidence confirmed final Worker version `8a23d5c0-e014-4cbd-b594-9f7814eeb6c1`.
- Worker `/health`: reachable
- Required env flags: true for `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TEST_ADMIN_USER_IDS`, `N8N_WEBHOOK_URL`, and `N8N_SHARED_SECRET`
- Worker evidence block confirms `runtime_kv_bound=true`, `idempotency_kv_bound=true`, and `selfcheck_secret_configured=true`.
- Remote KV fallback check with `--remote` successfully read prior marker `T1201-20260718053133`.
- KV namespace used for remote readback: `pline-v3-test-runtime`
- KV namespace id: `10cdfe018b3942b483faeaca6e517ae5`

## LINE App Control

- Computer Use confirmed the active LINE window title: `菲比智能客服 測試_03`.
- The target was not an `_02` or old-name chat.
- No login, CAPTCHA, 2FA, phone scan, or consent prompt appeared.

## Gate 1 Result

```text
N8N MINIMAL PATH PASS
```

Gate 1 run 1:

- Marker: `T1301-20260718054524`
- Request id: `pline-v3-01KXS0N7YEARHRBBPF4T7XX1GF`
- Remote marker readback: PASS
- Remote stage keys: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, `n8n_background_started`, `n8n_background_completed`
- n8n evidence: `intent=idea_create`, `status=completed`, `tool_called=idea_create`, `saved_record=1`, `codex_task=0`

Gate 1 run 2:

- Marker: `T1302-20260718054632`
- Request id: `pline-v3-01KXS0Q9FYR7ZC6G0ZFMNC2JF6`
- Remote marker readback: PASS
- Remote stage keys: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, `n8n_background_started`, `n8n_background_completed`
- n8n evidence: `intent=idea_create`, `status=completed`, `tool_called=idea_create`, `saved_record=1`, `codex_task=0`

Gate 1 run 3:

- Marker: `T1303-20260718054707`
- Request id: `pline-v3-01KXS0RBNFYJ73GHGD0ZWQQE45`
- Remote marker readback: PASS
- Remote stage keys: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, `n8n_background_started`, `n8n_background_completed`
- n8n evidence: `intent=idea_create`, `status=completed`, `tool_called=idea_create`, `saved_record=1`, `codex_task=0`

## Gate 2 Result

```text
CODEX MINIMAL PATH PASS: not marked
```

Gate 2 message:

```text
請 Codex 在 _03 專案建立測試檔案 T1304-20260718054759
```

Gate 2 durable evidence:

- Marker: `T1304-20260718054759`
- Request id: `pline-v3-01KXS0SZ02CAGW3RYJDKZQ5V9K`
- Remote marker readback: PASS
- Remote stage keys: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, `n8n_background_started`, `n8n_background_completed`, `line_push_final_completed`
- n8n evidence: `intent=codex_task`, `status=completed`, `tool_called=codex_task`, `codex_task=1`, `action=create_smoke_file`, `task_id_present=true`
- LINE final evidence: `line_push_final_completed`, `final_mode=background_push_final`

Gate 2 missing evidence:

- `monitor claim=1`: not proven
- `Codex execution=1`: not proven
- Live file creation by monitor: not proven
- `codex-smoke.txt` existed before Gate 2 with content `Codex 已打通`; its mtime remained `2026-07-18 03:39:02`, so it was not counted as live Gate 2 creation evidence.

## Conclusion

```text
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must add or connect `_03` TEST monitor claim / Codex execution evidence for `codex_task`, so Gate 2 can prove monitor claim=1, Codex execution=1, and live smoke-file creation instead of relying on a preexisting local file.
```
