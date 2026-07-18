# N8N Evidence: Respond-to-Webhook Nonempty Production Response

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Target n8n workflow only: `kcMcBQos5cxsnWU1`
- Workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Production webhook path: `/webhook/pline-v3-test-ai-agent`
- No old project, old workflow, old logs, raw User ID, secret value, or full LINE payload was read or recorded.

## Live Failure Being Repaired

FIX reported live production probes reached the correct Worker/n8n path, but n8n returned an empty JSON object:

```text
{}
```

That response had no `request_id`, `worker_request_id`, `canonicalRequestId`, `intent`, or tool evidence, so Worker correctly failed the contract with `request_id_mismatch`.

## n8n UI Root Cause Evidence

The target workflow execution list exposed recent production errors. The visible selected execution showed:

```text
Problem in node 'Normalize Input'
Cannot assign to read only property 'name' of object 'Error: access to env vars denied'
```

This means production execution could fail before `Structured Output` and `Respond to Webhook` returned the normalized object.

The Respond node also previously used:

```text
Respond With: JSON
Response Body: {{ $json }}
```

Because live production returned `{}`, this expression path was treated as unsafe for the Worker response contract.

## Repairs Applied

### Normalize Input

- Removed direct `$env.N8N_SHARED_SECRET` access from the Code node.
- Added a safe `$vars.N8N_SHARED_SECRET` lookup guard.
- If a n8n variable is configured, the header check still compares against it.
- If the variable is unavailable, Normalize no longer crashes before the response contract.

### Respond to Webhook

- Changed `Respond With` from `JSON` custom body to `First Incoming Item`.
- Removed the `Response Body: {{ $json }}` expression.
- This makes Respond-to-Webhook return the actual incoming `Structured Output` item instead of an empty custom JSON object.

## Published Workflow Evidence

- n8n UI returned to `Published` after version:

```text
N8N normalize env and respond nonempty repair
```

- Published readback for `Respond to Webhook`:

```text
Respond With: First Incoming Item
Response Body: absent
{{ $json }} expression: absent
Input preview: Structured Output with request_id / tool_called fields
```

## Local Draft Verification

Verified local draft:

```text
N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json
```

No-secret harness result:

```text
respondWith: firstIncomingItem
has_responseBody: false
nonempty_first_item_harness: PASS
response_keys: request_id,worker_request_id,intent,reply_text,reply_source,status,tool_called,saved,saved_record,record
request_id: pline-v3-01KXSTP8HJ3AF374NNY5W6KV86
worker_request_id: pline-v3-01KXSTP8HJ3AF374NNY5W6KV86
intent: idea_create
tool_called: idea_create
saved_record: 1
```

## Production No-Secret Probe

Controlled probe:

- Host: `n8nphy.app.n8n.cloud`
- Path: `/webhook/pline-v3-test-ai-agent`
- No shared secret header.
- No LINE User ID.
- No reply token.
- Synthetic request id only.

Result:

```text
probe_http_status: 200
probe_nonempty: PASS
response_keys: request_id,worker_request_id,intent,reply_text,reply_source,status,tool_called,saved,saved_record,record
request_id_match: PASS
request_id: pline-v3-n8nprobe-20260718141000
worker_request_id: pline-v3-n8nprobe-20260718141000
intent: idea_create
tool_called: idea_create
status: completed
saved_record: 1
```

## Execution Saving Observation

After the successful production response probe, the workflow `Executions` tab still showed:

```text
No executions found
```

So production response is now nonempty and contract-shaped, but execution saving/UI visibility remains unavailable or filtered.

## Risk / Handoff

- n8n-side shared-secret enforcement now depends on a configured n8n variable `N8N_SHARED_SECRET`.
- The no-secret probe succeeded, which proves the response contract but also means direct n8n endpoint protection should be rechecked if n8n-side validation is required.
- Worker still has its own LINE/admin/signature/idempotency gates and sends the n8n secret header, but n8n direct-call hardening is a separate follow-up.

## Next Verification

Hand off to TEST/FIX to rerun a fresh live T260x idea_create through LINE/Worker and verify:

- `n8n_background_completed`
- no `request_id_mismatch`
- `intent=idea_create`
- `tool_called=idea_create`
- `saved_record=1`
- `save_idea_json` enqueue
- monitor claim
- Dropbox JSON creation
- natural final reply

Computer Use minimal Gate remains paused.
