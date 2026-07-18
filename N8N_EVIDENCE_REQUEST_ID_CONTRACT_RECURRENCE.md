# N8N Request ID Contract Recurrence Evidence

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- n8n workflow id: `kcMcBQos5cxsnWU1`
- n8n workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Version published in n8n: `N8N request_id recurrence repair`
- Git commit/push: not performed
- Secret values, raw User IDs, and full webhook payloads: not recorded

## Live Regression Input

Reported live case:

- Time label: `12:53`
- User idea text: `記一下：我今天要喝2000cc的水`
- Request id: `pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF`
- Worker received / signature / admin / idempotency / webhook HTTP `200`: present
- n8n started: present
- n8n completed: failed
- Failure stage: `n8n_background_contract_failed`
- Failure reason: `request_id_mismatch`
- `save_idea_json` enqueue: absent
- monitor claim: absent
- attributable Dropbox JSON: absent
- final push: absent

This fails before a monitor-claimable task exists, so bounded drain or monitor recovery cannot repair it.

## Root Cause

The phase-aware n8n repair made the request-id path brittle in two ways:

- The local draft showed escape-sensitive sanitizer code with malformed path/newline handling after JSON/string round-tripping.
- `Normalize Input` exposed only `request_id`, while `Structured Output` had no duplicated canonical field to protect against malformed input or AI output drift.

The recurrence is repaired by restoring the FIX-10 principle in a stronger form:

- `Normalize Input` copies the Worker original id into both `request_id` and `worker_request_id`.
- `Structured Output` uses only `$('Normalize Input').first().json.worker_request_id || request_id` as the canonical response id.
- `Structured Output` ignores any `request_id` produced by AI Agent output.
- The sanitizer no longer uses slash regex or raw newline/tab escape sequences, avoiding syntax drift through n8n/UI/JSON round-trips.

## Changed Nodes

- `Normalize Input`
- `Structured Output`

Unchanged:

- `Webhook`
- `AI Agent` intent/tool behavior
- `OpenAI Chat Model`
- `idea_create`
- `codex_task`
- `Respond to Webhook`
- Dropbox JSON schema

## No-Secret Synthetic Verification

Synthetic input:

```json
{
  "request_id": "pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF",
  "message_text": "記一下：我今天要喝2000cc的水"
}
```

Synthetic AI output deliberately used the wrong id:

```json
{
  "request_id": "ai-made-wrong-id",
  "intent": "idea_create",
  "reply_text": "已記下這個想法。",
  "status": "completed"
}
```

Observed normalized output:

```json
{
  "output_request_id": "pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF",
  "worker_request_id": "pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF",
  "intent": "idea_create",
  "tool_called": "idea_create",
  "saved_record": 1
}
```

Result: request id preservation verified for the no-secret synthetic contract.

## Handoff

Return to TEST/FIX:

- Recheck the 12:53-style `idea_create` path with a new safe T-code or marker.
- Confirm n8n no longer returns `request_id_mismatch`.
- Confirm `save_idea_json` is enqueued.
- Confirm monitor claim, Dropbox JSON creation, and natural final reply.
- Keep Computer Use minimal-open-page Gate paused until this idea_create regression is verified.
