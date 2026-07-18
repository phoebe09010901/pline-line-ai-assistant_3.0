# FIX Evidence: idea_create Natural Final Without Visible ACK

Date: 2026-07-18T09:16:51+0800

## Scope

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory reference: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old project access: prohibited
- Git execution: none
- Secret/raw User ID/full webhook payload recorded: none

## Change Summary

- Removed the LINE-visible fixed idea ACK text `已收到 _03 TEST 訊息，我會繼續處理。` from the normal webhook path.
- Kept the LINE webhook HTTP `200` acceptance response so LINE delivery does not require a visible processing message.
- Changed Worker reply mode to `no_visible_ack_background_n8n`.
- Added durable no-secret evidence stages:
  - `line_visible_ack_skipped`
  - `webhook_http_200_returned`
- Updated evidence summary with `visible_ack_skipped` and `webhook_http_200` booleans.
- idea_create finalizer now sends a natural n8n `reply_text` only after monitor `save_idea_json` completion.
- If the saved final text is missing, too long, or contains internal implementation terms, Worker uses the safe saved fallback `已經幫妳記下來了 💡`.
- If monitor reports save failure, Worker sends only the truthful failure text `這次沒有成功保存，我先不假裝記好了，請稍後再試一次 🙏`.
- Duplicate/repeated finalizer callbacks remain exactly-once and do not produce another final.
- The codex_task path was not expanded; it keeps its existing background processing and final push behavior.

## Worker Deployment

- Worker: `pline-v3-test-line-gateway`
- URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Deployed version: `dbda345b-a3b4-41ca-bc8b-a12c8547179c`
- KV bindings observed by Wrangler dry-run/deploy:
  - `RUNTIME_KV`: `10cdfe018b3942b483faeaca6e517ae5`
  - `IDEMPOTENCY_KV`: `1f857def085d466abed722e9222002e3`

## No-Secret Readiness

- `/health`: reachable
- `/health` required env flags:
  - `LINE_CHANNEL_SECRET=true`
  - `LINE_CHANNEL_ACCESS_TOKEN=true`
  - `LINE_TEST_ADMIN_USER_IDS=true`
  - `N8N_WEBHOOK_URL=true`
  - `N8N_SHARED_SECRET=true`
- `/health` `line_reply_mode`: `no_visible_ack_background_n8n`
- Direct invalid-signature `POST /line/webhook`: HTTP `401`
- Invalid empty `POST /test/idea-finalize`: HTTP `400`
- Configured secret names only:
  - `EVIDENCE_SELFTEST_SECRET`
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_CHANNEL_SECRET`
  - `LINE_TEST_ADMIN_USER_IDS`
  - `N8N_SHARED_SECRET`

## Local Verification

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- Fixed ACK source scan for `已收到 _03 TEST 訊息`, `FAST_ACK_REPLY_TEXT`, and `fast_ack_then_background_n8n`: no matches.
- `npx wrangler deploy --dry-run`: PASS
- `npx wrangler deploy`: PASS

## TEST Handoff

TEST should rerun `IDEA NATURAL FINAL REPLY WITHOUT ACK`:

- Send live idea_create LINE messages through `菲比智能客服 測試_03`.
- Expect LINE visible user message count per idea event: `1`.
- Expected evidence:
  - `line_visible_ack_skipped`
  - `webhook_http_200_returned`
  - no `line_fast_reply_completed` for idea_create
  - `idea_json_file_written`
  - `idea_json_final_push_completed`
- Expected final text: natural saved reply from n8n, or saved fallback only after Dropbox JSON success.
- Failure path must not send a saved-success final.
- Duplicate/repeated callback must not create another Dropbox JSON file or another LINE final.
