# FIX Evidence: FIX-14

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- LINE channel inspected: `菲比智能客服 測試_03`
- LINE channel id: `2010748091`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Old project access: none
- `_02` channel/resource usage: none
- Secrets, tokens, raw LINE User IDs, raw LINE signatures, and full LINE message text: not recorded
- LINE Gate messages: not sent by this FIX thread

## TEST-10 Failure Being Repaired

TEST-10 sent valid Gate 1 candidate `T1001-20260718050632`, but observed no visible ACK and no durable `evidence:v1` marker. LINE Developers settings had already passed Verify and endpoint active checks in FIX-13.

## LINE Delivery Finding

LINE Developers Webhook errors for `_03` channel showed:

- Date: `2026/07/18`
- Time: `06:06:36`
- Reason: `request_timeout`
- Detail: timeout on `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`
- Count: `1`

This explains the apparent no-invocation symptom: LINE delivery reached the webhook route but timed out before a successful user-visible ACK/evidence sequence was completed.

## Root Cause

FIX-12 added durable evidence writes to `RUNTIME_KV`, but the LINE webhook path awaited multiple evidence writes before completing the fast ACK / webhook response path. If `RUNTIME_KV` writes were slow, the LINE platform could time out the webhook request before the user message produced visible ACK or durable marker evidence.

## Repair

- Changed LINE webhook foreground evidence writes to `queueEvidenceStage(...)`.
- `queueEvidenceStage(...)` uses `ctx.waitUntil(...)` when available, so evidence writes continue in Worker background without blocking the LINE webhook response.
- Kept n8n background evidence writes durable inside the background task; they no longer block LINE's immediate webhook response.
- Added unit coverage proving `handleLineWebhook(...)` returns HTTP `200` even when `RUNTIME_KV.put(...)` never resolves.
- Did not change LINE secrets, raw User ID, n8n workflow, or LINE channel identity.

## Deploy / Verify

- `npx wrangler deploy --dry-run`: PASS
- Worker deployed URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Deployed Worker version: `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`
- Deployment created: `2026-07-17T21:14:47.259Z`
- Worker `/health`: reachable; required env flags true; FIX-12 evidence read path present.
- Synthetic invalid-signature `POST /line/webhook`: HTTP `401`.
- LINE Developers Verify after deploy: `Success`.
- Cloudflare tail observed LINE official Verify `POST /line/webhook` on Worker version `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`, response HTTP `200`.
- LINE Developers Webhook errors page still showed only the pre-FIX-14 `request_timeout` row at `06:06:36` during this check.

## Validation

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `python3 -m json.tool N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`: PASS
- `npx wrangler deploy --dry-run`: PASS

## Remaining TEST Responsibility

TEST must rerun Gate 1 three consecutive `idea_create` messages and then Gate 2. Gate PASS is not marked by FIX-14.
