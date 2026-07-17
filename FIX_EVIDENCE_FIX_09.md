# FIX Evidence: FIX-09

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Repair target: TEST-05 `line_fast_reply_failed`, reason `line_reply_http_401`
- Old project access: none
- Secrets, tokens, raw LINE User IDs, and raw LINE signatures: not recorded
- LINE Gate messages: not sent by this FIX thread

## TEST-05 Failure

- LINE target: `菲比智能客服 測試_03`
- Worker version observed by TEST: `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`
- Worker stage logs reached:
  - `line_event_received`
  - `signature_pass`
  - `admin_pass`
  - `idempotency_pass`
  - `line_fast_reply_failed`
- Failure reason: `line_reply_http_401`

## Root Cause

The Worker Reply API code path already used the correct LINE endpoint, bearer header shape, and JSON body:

```text
POST https://api.line.me/v2/bot/message/reply
Authorization: Bearer <LINE_CHANNEL_ACCESS_TOKEN>
Content-Type: application/json
```

The 401 was therefore consistent with the deployed Cloudflare Worker secret `LINE_CHANNEL_ACCESS_TOKEN` being invalid, stale, or not the current `_03` Messaging API channel token.

## Channel Clean-Room Confirmation

- LINE Developers channel page confirmed: `菲比智能客服 測試_03`
- Channel id: `2010748091`
- Channel name does not contain `_02`
- The `_02` channel visible in the account was not opened or used
- Messaging API page was scoped to `菲比智能客服 測試_03`

## Repair

- Read the current `_03` Messaging API long-lived channel access token from the confirmed `_03` channel page into memory only.
- No-secret token validation: LINE API `/v2/bot/info` returned HTTP `200`.
- Updated Cloudflare Worker secret by name only:
  - `LINE_CHANNEL_ACCESS_TOKEN`
- Added Worker-side token normalization:
  - trims accidental surrounding whitespace
  - accepts either raw token or accidental `Bearer ...` secret form without producing `Bearer Bearer ...`
- Added unit coverage for Reply API endpoint, authorization header, content type, and JSON body.

## Validation

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `python3 -m json.tool N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`: PASS
- `npx wrangler deploy --dry-run`: PASS

## Cloudflare Deployment

- Secret update status: `LINE_CHANNEL_ACCESS_TOKEN` uploaded successfully
- Deploy command: `npx wrangler deploy`
- Deploy status: success
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Current Version ID: `97f20405-6ed9-4cfb-801d-218ae1f21c61`
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
- Wrangler deployments list: latest 100% version `97f20405-6ed9-4cfb-801d-218ae1f21c61`
- Wrangler tail: command starts and is readable; no events occurred during the observation window

## Remaining TEST Responsibility

TEST must rerun Gate 1 three consecutive `idea_create` messages and then Gate 2. Gate PASS is not marked by FIX-09.
