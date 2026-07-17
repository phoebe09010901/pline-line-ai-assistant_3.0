# FIX Evidence: FIX-13

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- LINE channel inspected: `菲比智能客服 測試_03`
- LINE channel id: `2010748091`
- Bot basic id: `@967fvhek`
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Expected webhook: `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`
- Old project access: none
- `_02` channel/resource usage: none
- Secrets, tokens, raw LINE User IDs, raw LINE signatures, and full LINE message text: not recorded
- LINE Gate messages: not sent by this FIX thread

## TEST-09 Failure Being Repaired

TEST-09 sent valid Gate 1 candidates `T0901-20260718045141` and `T0901A-20260718045215`, but observed no visible ACK, no Worker invocation in live tail, and no durable KV marker records. This pointed to LINE delivery / webhook route rather than n8n contract processing.

## LINE Developers / OA Manager Findings

- Directly opened LINE Developers channel `2010748091`, not the visible non-`_03` tab.
- Breadcrumb and heading confirmed `菲比智能客服 測試_03`.
- Webhook URL was already correct: `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`.
- `Use webhook`: enabled.
- `Webhook redelivery`: was disabled before FIX-13.
- `Error statistics aggregation`: was disabled before FIX-13.
- LINE Official Account Manager confirmed account `菲比智能客服 測試_03` / `@967fvhek`.
- OA Manager Messaging API status: active.
- OA Manager Channel ID: `2010748091`.
- OA Manager webhook URL: correct.

## Repair

- Enabled `Webhook redelivery` for `_03` LINE Developers channel.
- Accepted LINE's redelivery caution dialog; Worker already has idempotency handling for duplicate webhook event IDs.
- Enabled `Error statistics aggregation` for `_03` LINE Developers channel.
- No Worker code change was required.
- No Worker deploy was required.
- No secret/token was changed or written.

## Verify / Readiness

- Worker route synthetic invalid-signature POST:
  - `POST /line/webhook` with invalid signature returned HTTP `401`.
  - This proves route reachability and signature rejection without creating a fake LINE event.
- LINE Developers Verify before switch repair:
  - UI result: `Success`.
  - Cloudflare tail observed LINE official `POST /line/webhook`.
  - Worker response: HTTP `200`.
  - Worker version: `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`.
- LINE official API status check using in-memory token only:
  - Bot info: HTTP `200`.
  - Webhook endpoint API: HTTP `200`.
  - Endpoint: `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`.
  - Active: `true`.
- Final LINE Developers switch state:
  - `Use webhook`: enabled.
  - `Webhook redelivery`: enabled.
  - `Error statistics aggregation`: enabled.
- LINE Developers Verify after switch repair:
  - UI result: `Success`.
- Worker `/health`:
  - required env flags true.
  - FIX-12 evidence read path present.
- Wrangler deployments list:
  - current latest deployment remains Worker version `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`.

## Validation

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `POST /line/webhook` invalid signature route check: HTTP `401`

## Remaining TEST Responsibility

TEST must rerun Gate 1 three consecutive `idea_create` messages and then Gate 2. Gate PASS is not marked by FIX-13.
