# FIX Evidence: FIX-11

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- n8n workflow: `kcMcBQos5cxsnWU1`
- n8n workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Repair target: TEST-07 live production response still causing `request_id_mismatch`
- Old project access: none
- Secrets, tokens, raw LINE User IDs, and raw LINE signatures: not recorded
- LINE Gate messages: not sent by this FIX thread

## Live Inspection

- Opened only workflow `kcMcBQos5cxsnWU1` in n8n.
- Inspected latest TEST-07 execution evidence in n8n UI.
- Execution `#551`:
  - Version: `FIX-10 request_id contract`
  - Status: Error
  - Error source: sub-node `OpenAI Chat Model`
  - Structured Output/Respond path did not complete reliably for the live production request.

## Root Cause

FIX-10 correctly changed `Structured Output` to preserve `Normalize Input` request id, but the live production path still depended on the AI Agent succeeding before `Structured Output`.

When the `OpenAI Chat Model` sub-node failed, the AI Agent node used `On Error: Stop Workflow`, so production execution stopped before the deterministic response contract could complete. Worker then received a live response shape that did not preserve the expected `request_id`, producing `request_id_mismatch`.

## Repair

- Updated AI Agent node settings in workflow `kcMcBQos5cxsnWU1`.
- Changed `On Error` from `Stop Workflow` to `Continue`.
- The AI Agent now passes an error item through regular output if the OpenAI sub-node fails.
- Existing `Structured Output` then deterministically uses:
  - `$('Normalize Input').first().json.request_id` as canonical `request_id`
  - normalized message text for fallback intent
  - Gate evidence fields for `idea_create` and `codex_task`
- Updated local no-secret workflow draft `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json` with `onError: continueRegularOutput`.

## n8n Publish / Live Verification

- Published n8n version: `FIX-11 continue on AI error`
- Workflow UI status after publish: `Published`
- Retried live execution `#551` with currently saved workflow.
- Retry execution `#552`:
  - Status: Succeeded
  - Version: `FIX-11 continue on AI error`
  - Structured Output: Success, `1 item`
  - Respond to Webhook: Success, `1 item`
  - Output evidence fields observed:
    - `request_id`: preserved as `pline-v3-...`
    - `intent`: `idea_create`
    - `reply_text`: present
    - `status`: `completed`
    - `tool_called`: `idea_create`
    - `saved`: `true`
    - `saved_record`: `1`
    - `record`: `1`
- Raw LINE User ID was not recorded.

## Production Webhook Readiness

- Production webhook path: `/webhook/pline-v3-test-ai-agent`
- `GET /webhook/pline-v3-test-ai-agent`: registered path, method-specific 404 asking for POST
- `OPTIONS /webhook/pline-v3-test-ai-agent`: 204

## Worker Status

- Worker code was not changed in FIX-11.
- Worker deploy was not required.
- Current Worker version remains: `02b1fa59-4d4c-4119-8dc8-5699183d5456`
- Worker local syntax/test still passed.

## Validation

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `python3 -m json.tool N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`: PASS
- Local workflow draft check:
  - AI Agent continue on error: PASS
  - request_id preserve: PASS
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS

## Remaining TEST Responsibility

TEST must rerun Gate 1 three consecutive `idea_create` messages and then Gate 2. Gate PASS is not marked by FIX-11.
