# FIX Evidence: FIX-08

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Repair target: TEST-04 live Worker invocation `canceled` / no LINE reply
- Old project access: none
- Secrets, tokens, raw LINE User IDs, and raw LINE signatures: not recorded
- LINE Gate messages: not sent by this FIX thread

## Root Cause

TEST-04 showed that live `/line/webhook` entered Worker version `19c6ece9-5d6f-4b62-a4fd-060c22c26f12`, then the invocation was canceled after about two seconds with no response status and no LINE reply.

The Worker was synchronously waiting for the full chain:

```text
LINE webhook -> n8n production webhook -> AI Agent/tool contract -> LINE Reply API -> Worker 200
```

This made the LINE webhook response path depend on slow n8n/AI execution and exposed it to live invocation cancellation before LINE could receive a reply.

## Repair

- Changed Worker LINE webhook mode to `fast_ack_then_background_n8n`.
- After signature/admin/idempotency pass, Worker now sends a fast LINE ACK first.
- n8n production webhook execution and contract validation now run in `ctx.waitUntil(...)` background work.
- Added no-secret stage logs:
  - `line_event_received`
  - `signature_pass`
  - `admin_pass`
  - `idempotency_pass`
  - `line_fast_reply_completed`
- `line_fast_reply_failed`
- `line_push_final_completed`
- `line_push_final_failed`
- `n8n_background_started`
- `n8n_background_completed`
- `n8n_background_failed`
- `n8n_background_contract_failed`
- For `codex_task`, background processing sends a final LINE Push API message after n8n contract validation.
- LINE Reply API and Push API fetch exceptions are converted into no-secret failure reasons for tail/debug visibility.
- Did not add a general queue, arbitrary command path, FORMAL path, old-scope fallback, or old resource reference.

## Validation

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- `python3 -m json.tool N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`: PASS
- `npx wrangler deploy --dry-run`: PASS

Worker unit coverage now verifies:

- `line_reply_mode` is `fast_ack_then_background_n8n`.
- Background n8n processing validates an `idea_create` contract.
- Background `codex_task` processing calls n8n first, then LINE Push API for final reply.
- Live webhook logic calls LINE Reply API before the n8n webhook and returns `status: accepted`.

## Cloudflare Deployment

- Deploy command: `npx wrangler deploy`
- Deploy status: success
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Current Version ID: `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`
- KV binding `RUNTIME_KV`: `10cdfe018b3942b483faeaca6e517ae5`
- KV binding `IDEMPOTENCY_KV`: `1f857def085d466abed722e9222002e3`
- Required Worker secret names present:
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_CHANNEL_SECRET`
  - `LINE_TEST_ADMIN_USER_IDS`
  - `N8N_SHARED_SECRET`

## Readiness

- Worker `/health`: reachable
- Worker `/health` required env flags: all true
- Worker `/health` n8n URL: `https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent`
- Worker `/health` line reply mode: `fast_ack_then_background_n8n`
- Worker `/health` codex task final mode: `background_push_final`
- Wrangler deployments list: latest 100% version `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`
- Wrangler tail: command starts and is readable; no events occurred during the observation window
- n8n production webhook path readiness:
  - `GET /webhook/pline-v3-test-ai-agent`: registered path, returns method-specific 404 asking for POST
  - `OPTIONS /webhook/pline-v3-test-ai-agent`: 204

## Remaining TEST Responsibility

TEST must rerun Gate 1 three consecutive `idea_create` messages and then Gate 2. Gate PASS is not marked by FIX-08.

For Gate evidence, TEST should expect:

- LINE visible reply from the fast ACK path.
- Worker stage logs through `line_fast_reply_completed`.
- Background Worker stage logs through `n8n_background_completed` for successful n8n contract processing.
- n8n execution/tool evidence from the target workflow.
