# TEST Evidence: TEST-05

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- LINE target window: `菲比智能客服 測試_03`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Worker version observed in tail: `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`
- Old project access: none
- Secrets, tokens, raw LINE User IDs, and raw LINE signatures: not recorded

## Pre-Gate Readiness

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker `/health`: reachable
- Worker `/health` required env flags: all true
- Worker `/health` n8n URL: production `/webhook/pline-v3-test-ai-agent`
- Worker `/health` line reply mode: `fast_ack_then_background_n8n`
- Worker `/health` codex task final mode: `background_push_final`
- FIX-08 evidence: fast ACK/background n8n repair deployed
- LINE app target was confirmed as `菲比智能客服 測試_03`
- Wrangler tail: readable

## Gate 1 Run 1

Sent by Computer Use through LINE app:

```text
記一下：今天開始建立 _03 T0501-20260717194130
```

Observed evidence:

- LINE app displayed the sent message in target chat `菲比智能客服 測試_03`
- Cloudflare tail observed one `POST /line/webhook` request for Worker `pline-v3-test-line-gateway`
- Worker script version in tail: `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`
- Worker response status: `502`
- Worker stage logs:
  - `line_event_received`
  - `signature_pass`
  - `admin_pass`
  - `idempotency_pass`
  - `line_fast_reply_failed`
- `line_fast_reply_failed` reason: `line_reply_http_401`
- LINE app visible reply after waiting: none
- No `n8n_background_started` was observed after the fast reply failure.

Gate 1 required evidence result:

- LINE event=1: yes
- Worker invocation=1: yes
- signature PASS: yes
- admin PASS: yes
- idempotency PASS: yes
- n8n execution=1: no
- AI Agent execution=1: no
- intent=`idea_create`: not proven
- tool_called=`idea_create`: not proven
- data record=1: not proven
- LINE reply=1: no
- Codex task=0: no Codex task evidence observed
- no duplicate: no duplicate tail event observed during the wait window
- no old-scope resource: no old-scope resource was used by this TEST thread

Result:

```text
N8N MINIMAL PATH PASS: not marked
```

Because Gate 1 run 1 failed at fast LINE Reply API with `line_reply_http_401`, the required three consecutive successful Gate 1 runs were not attempted.

## Gate 2

Gate 2 was not executed because Gate 1 already failed before the three-run pass condition.

Result:

```text
CODEX MINIMAL PATH PASS: not marked
```

## Handoff

Hand off to FIX. The next repair should correct the LINE Reply API authorization/channel token path for `_03` so fast ACK can complete before background n8n starts.
