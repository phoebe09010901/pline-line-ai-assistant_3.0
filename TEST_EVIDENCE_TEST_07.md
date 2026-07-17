# TEST Evidence: TEST-07

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- LINE target window: `菲比智能客服 測試_03`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Worker version observed in tail: `02b1fa59-4d4c-4119-8dc8-5699183d5456`
- Old project access: none
- Secrets, tokens, raw LINE User IDs, and raw LINE signatures: not recorded

## Pre-Gate Readiness

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker `/health`: reachable
- Worker `/health` required env flags: all true
- Worker `/health` n8n URL: production `/webhook/pline-v3-test-ai-agent`
- Worker `/health` line reply mode: `fast_ack_then_background_n8n`
- Worker `/health` codex task final mode: `background_push_final`
- FIX-10 evidence: n8n workflow published as `FIX-10 request_id contract`
- LINE app target was confirmed as `菲比智能客服 測試_03`
- Wrangler tail: readable after restart

## Gate 1 Attempt

Sent by Computer Use through LINE app:

```text
記一下：今天開始建立 _03 T0701-20260717200544
```

Observed evidence:

- LINE app displayed the sent message in target chat `菲比智能客服 測試_03`
- LINE app displayed the fast ACK reply:

```text
已收到 _03 TEST 訊息，我會繼續處理。
```

- The initial tail session did not emit the matching event during the observation window, so this attempt cannot count as a fully evidenced Gate 1 pass.

After restarting tail, sent by Computer Use through LINE app:

```text
記一下：今天開始建立 _03 T0701B-20260717200704
```

Observed evidence:

- LINE app displayed the sent message in target chat `菲比智能客服 測試_03`
- LINE app displayed the fast ACK reply:

```text
已收到 _03 TEST 訊息，我會繼續處理。
```

- Cloudflare tail observed one `POST /line/webhook` request for Worker `pline-v3-test-line-gateway`
- Worker script version in tail: `02b1fa59-4d4c-4119-8dc8-5699183d5456`
- Worker response status: `200`
- Worker stage logs:
  - `line_event_received`
  - `signature_pass`
  - `admin_pass`
  - `idempotency_pass`
  - `line_fast_reply_completed`
  - `n8n_background_started`
  - `n8n_background_contract_failed`
- `n8n_background_contract_failed` reason: `request_id_mismatch`

Gate 1 required evidence result:

- LINE event=1: yes for evidenced candidate
- Worker invocation=1: yes for evidenced candidate
- signature PASS: yes
- admin PASS: yes
- idempotency PASS: yes
- LINE reply=1: yes, fast ACK
- n8n execution=1: background call started, but contract failed
- AI Agent execution=1: not proven
- intent=`idea_create`: not proven
- tool_called=`idea_create`: not proven
- data record=1: not proven
- Codex task=0: no Codex task evidence observed
- no duplicate: no duplicate tail event observed for the evidenced candidate during the wait window
- no old-scope resource: no old-scope resource was used by this TEST thread

Result:

```text
N8N MINIMAL PATH PASS: not marked
```

Because the evidenced Gate 1 candidate still failed background n8n contract validation with `request_id_mismatch`, the required three consecutive successful Gate 1 runs were not completed.

## Gate 2

Gate 2 was not executed because Gate 1 already failed before the three-run pass condition.

Result:

```text
CODEX MINIMAL PATH PASS: not marked
```

## Handoff

Hand off to FIX. The next repair should inspect the live n8n production response actually returned to Worker and ensure it preserves the Worker `request_id`; the FIX-10 local/published intent did not eliminate the live `request_id_mismatch`.
