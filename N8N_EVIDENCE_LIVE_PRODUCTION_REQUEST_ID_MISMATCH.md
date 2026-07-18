# N8N Evidence: Live Production request_id_mismatch Follow-Up

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Target n8n workflow only: `kcMcBQos5cxsnWU1`
- Workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- No old project, old workflow, raw User ID, secret value, or full webhook payload was read or recorded.

## Live Regression Input

- LINE text marker: `T2601-20260718131959`
- Worker request id: `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86`
- Reported failure: `n8n_background_contract_failed`
- Reported reason: `request_id_mismatch`
- No `idea_create` enqueue, monitor claim, Dropbox JSON, or final push evidence was reported for this live run.

## n8n UI Findings

- Opened workflow URL: `https://n8nphy.app.n8n.cloud/workflow/kcMcBQos5cxsnWU1`
- UI shows the workflow is active/published:
  - Top button: `Published`
  - Node buttons include `Deactivate`
- Node topology is still the allowed minimal workflow:
  - `Webhook`
  - `Normalize Input`
  - `AI Agent`
  - `OpenAI Chat Model`
  - `idea_create`
  - `codex_task`
  - `Structured Output`
  - `Respond to Webhook`
- Webhook node production URL is the production path:
  - Host redacted here for handoff safety.
  - Path: `/webhook/pline-v3-test-ai-agent`
  - Test path is distinct: `/webhook-test/pline-v3-test-ai-agent`
- `Structured Output` node UI contains `canonicalRequestId` and `worker_request_id`.
- `Structured Output` node UI does not contain `parsed.request_id`.
- `Normalize Input` node UI contains Worker request-id preservation signals.
- `Respond to Webhook` is configured as JSON with response body expression `{{ $json }}`.

## Execution Attribution Finding

The workflow Executions tab for `kcMcBQos5cxsnWU1` showed:

```text
No executions found
```

The T2601 request id was not visible in this workflow execution list. Because no saved execution for the live request was visible under the target workflow, this N8N turn could not inspect per-node live outputs for:

- `Normalize Input` request id
- `AI Agent` output request id
- `Structured Output` response request id
- Final `Respond to Webhook` body request id

This is evidence that the live failure is not yet attributable to the currently visible saved execution data for workflow `kcMcBQos5cxsnWU1`.

## Local No-Secret Contract Verification

Verified local draft:

- File: `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`
- `python3 -m json.tool`: PASS
- Synthetic request id: `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86`
- Synthetic AI output intentionally supplied wrong request id: `ai-generated-wrong-id`
- Final structured output preserved:
  - `request_id=pline-v3-01KXSTP8HJ3AF374NNY5W6KV86`
  - `worker_request_id=pline-v3-01KXSTP8HJ3AF374NNY5W6KV86`
  - `intent=idea_create`
  - `tool_called=idea_create`
  - `saved_record=1`

## Handoff Conclusion

Current n8n workflow UI and local draft preserve the Worker original request id. The live T2601 failure still needs follow-up because the target workflow execution list did not expose the live run.

Next FIX/TEST checks should confirm:

- Live Worker `N8N_WEBHOOK_URL` value exactly equals the production path `/webhook/pline-v3-test-ai-agent`.
- Live request `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86` is attributable to workflow `kcMcBQos5cxsnWU1`.
- n8n execution saving/log visibility is sufficient to inspect per-node outputs for future regressions.
- A new T260x idea_create live run no longer fails with `request_id_mismatch`, then creates `save_idea_json`, monitor claim, Dropbox JSON, and natural final evidence.

Computer Use minimal Gate remains paused.
