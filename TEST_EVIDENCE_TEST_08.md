# TEST Evidence: TEST-08

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
- FIX-11 evidence: n8n workflow published as `FIX-11 continue on AI error`
- LINE app target was confirmed as `菲比智能客服 測試_03`
- Wrangler tail: readable, but did not consistently capture every LINE event
- n8n Executions panel for workflow `kcMcBQos5cxsnWU1`: no saved executions available for per-run correlation

## Gate 1 Run 1

Sent by Computer Use through LINE app:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Observed evidence:

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
  - `n8n_background_completed`
- Background completion fields:
  - `intent=idea_create`
  - `status=completed`
  - `tool_called=idea_create`
  - `saved_record=1`

Gate 1 run 1 result:

- LINE event=1: yes
- Worker invocation=1: yes
- signature PASS: yes
- admin PASS: yes
- idempotency PASS: yes
- n8n execution=1: yes
- AI Agent execution=1: inferred from successful n8n contract path
- intent=`idea_create`: yes
- tool_called=`idea_create`: yes
- data record=1: yes
- LINE reply=1: yes, fast ACK path completed
- Codex task=0: yes, intent was `idea_create`
- no duplicate: no duplicate tail event observed for this request
- no old-scope resource: no old-scope resource was used by this TEST thread

## Gate 1 Subsequent Attempts

Sent by Computer Use through LINE app:

```text
記一下：[REDACTED_IDEA_CONTENT]
記一下：[REDACTED_IDEA_CONTENT]
記一下：[REDACTED_IDEA_CONTENT]
```

Observed evidence:

- LINE app displayed the sent messages in target chat `菲比智能客服 測試_03`.
- LINE app displayed fast ACK replies for these messages.
- Cloudflare tail did not emit matching LINE webhook/background n8n events for these attempts during the observation windows.
- n8n Executions panel showed no saved executions available for per-run correlation.

Gate 1 subsequent attempts result:

- LINE reply=1: visible fast ACK replies
- Worker invocation/signature/admin/idempotency/background n8n/tool evidence: not fully proven for each attempt
- Therefore these attempts cannot count toward the required three consecutive fully evidenced Gate 1 successes.

Gate 1 final result:

```text
N8N MINIMAL PATH PASS: not marked
```

Only one fully evidenced Gate 1 success was obtained; the required three consecutive successful runs were not proven.

## Gate 2

Gate 2 was not executed because Gate 1 did not reach the required three consecutive fully evidenced successes.

Result:

```text
CODEX MINIMAL PATH PASS: not marked
```

## Handoff

Hand off to FIX or observability repair. The functional path appears improved for one run, but TEST cannot mark PASS until Cloudflare/n8n evidence can reliably prove three consecutive `idea_create` runs and then the `codex_task` run.
