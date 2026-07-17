# FIX Evidence: FIX-10

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- n8n workflow: `kcMcBQos5cxsnWU1`
- n8n workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Repair target: TEST-06 background n8n contract `request_id_mismatch`
- Old project access: none
- Secrets, tokens, raw LINE User IDs, and raw LINE signatures: not recorded
- LINE Gate messages: not sent by this FIX thread

## TEST-06 Failure

- Worker version observed by TEST: `97f20405-6ed9-4cfb-801d-218ae1f21c61`
- Fast LINE ACK: completed and visible in LINE app
- Background n8n stage: started
- Contract failure: `n8n_background_contract_failed`
- Failure reason: `request_id_mismatch`

## Root Cause

The n8n `Structured Output` node trusted the AI Agent response `parsed.request_id` before falling back to `Normalize Input`.

That made the production webhook response vulnerable to any AI-generated, missing, or mismatched `request_id`, instead of preserving the Worker-generated `request_id` from the inbound request.

## Repair

- Updated n8n `Structured Output` node for workflow `kcMcBQos5cxsnWU1`.
- The response now always uses `$('Normalize Input').first().json.request_id` as the canonical `request_id`.
- The AI Agent output is used only for intent/reply/task fields.
- Added deterministic fallback intent classification from the normalized message text.
- Added Gate evidence fields:
  - `idea_create`: `tool_called=idea_create`, `saved=true`, `saved_record=1`, `record=1`
  - `codex_task`: `tool_called=codex_task`, `codex_task=1`, `action=create_smoke_file`, fixed target path, fixed content, and `task_id`
- Updated local no-secret workflow draft `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`.
- Published n8n workflow version: `FIX-10 request_id contract`.

## Worker Contract Update

- Worker now validates `idea_create` evidence:
  - `tool_called=idea_create`
  - `saved_record=1` or `record=1`
- Worker now validates `codex_task` evidence:
  - `tool_called=codex_task`
  - `action=create_smoke_file`
  - `task_id` present
- Worker `n8n_background_completed` no-secret logs now include:
  - `idea_create`: `tool_called`, `saved_record`
  - `codex_task`: `tool_called`, `codex_task`, `action`, `task_id_present`

## n8n Publish / Readiness

- Target workflow id: `kcMcBQos5cxsnWU1`
- Workflow UI status after publish: `Published`
- Production webhook path: `/webhook/pline-v3-test-ai-agent`
- Production webhook readiness:
  - `GET /webhook/pline-v3-test-ai-agent`: registered path, returns method-specific 404 asking for POST
  - `OPTIONS /webhook/pline-v3-test-ai-agent`: 204

## Validation

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `python3 -m json.tool N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`: PASS
- Local workflow draft check:
  - request_id preserve: PASS
  - idea evidence fields: PASS
  - codex action fields: PASS
- `npx wrangler deploy --dry-run`: PASS

## Cloudflare Deployment

- Deploy command: `npx wrangler deploy`
- Deploy status: success
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Current Version ID: `02b1fa59-4d4c-4119-8dc8-5699183d5456`
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
- Wrangler deployments list: latest 100% version `02b1fa59-4d4c-4119-8dc8-5699183d5456`
- Wrangler tail: command starts and is readable; no events occurred during the observation window

## Remaining TEST Responsibility

TEST must rerun Gate 1 three consecutive `idea_create` messages and then Gate 2. Gate PASS is not marked by FIX-10.
