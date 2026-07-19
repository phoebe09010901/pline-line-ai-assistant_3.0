# N8N Evidence: Memo / Calendar Basic CRUD Contract

Date: 2026-07-18

Scope:

- Project: `菲比 LINE 智能助理_03`
- Workflow id: `kcMcBQos5cxsnWU1`
- Workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Local artifact: `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`
- Branch context from orchestrator: `gate/codex-default-delegation`

Clean-room boundaries:

- No old project, old workflow, old Dropbox, old secret store, old logs, raw LINE User ID, OAuth token, or full webhook payload was read or recorded.
- No Git command was run.
- No LINE live test was run in this N8N turn.
- If future LINE live validation is needed, the only valid target window is `菲比智能助理 測試_03`.

## Implemented Local Contract Draft

Updated local workflow artifact and published the memo/calendar contract to the existing n8n production workflow.

Nodes designed/updated in the local artifact:

- `Normalize Input`
  - Preserves canonical `request_id` / `worker_request_id`.
  - Accepts deterministic `domain=memo|calendar`.
  - Extracts `body_text` after fixed entry prefix.
  - Removes raw user id/reply token from AI-facing normalized output.
  - Adds `timezone=Asia/Taipei`.
  - Adds `calendar_boundary=TEST Calendar only` for calendar domain.

- `AI Agent`
  - Defines memo operations: `memo_create`, `memo_update`, `memo_delete`, `memo_search`.
  - Defines calendar operations: `calendar_create`, `calendar_update`, `calendar_delete`, `calendar_search`.
  - Defines confirmation object contract.
  - Requires safe Traditional Chinese replies without internal terms.
  - Uses `妳`, not `您`, in user-visible memo/calendar replies.
  - Keeps legacy `idea_create` and `codex_delegate` behavior.

- `Structured Output`
  - Preserves canonical request id.
  - Uses a shortened UI-stable Code node contract for safer manual/browser paste if a signed-in n8n session is available.
  - Emits no-secret fields: `domain`, `operation`, `tool_called`, `status`, `reply_text`, `reply_source`, `needs_confirmation`, `needs_clarification`, `candidate_count`, `executor`.
  - Emits confirmation fields when needed: `confirmation_required`, `confirmation_type`, `confirmation_id`, `expires_at`, `actor_fingerprint_required`, `candidate_summary`, `proposed_action`.
  - Emits calendar fields without event ids: `title`, `start`, `end`, `all_day`, `location`, `description`, `reminders`, `recurrence`, `search_query`, `target_hint`, `changes`.
  - Emits memo fields without paths/filenames: `content`, `search_query`, `target_hint`, `new_content`, `date_hint`, `status_hint`.

## Google Calendar Boundary

Calendar contract is limited to:

- TEST Calendar only.
- Asia/Taipei timezone.
- No Google Tasks.
- No private/formal calendar operation.
- No Google Calendar event id in LINE-visible reply or evidence.

Status:

- Google Calendar credential was not inspected.
- OAuth token was not read.
- TEST Calendar id/event ids were not read or recorded.
- No Google Calendar node was added/published in n8n during this turn.

## Local Synthetic Contract Validation

Validation was local-only against `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`.

| Case | Domain | Operation | Status | Executor | Confirmation | Result |
| --- | --- | --- | --- | --- | --- | --- |
| memo create | memo | memo_create | ready | memo | no | PASS |
| memo search | memo | memo_search | ready | memo | no | PASS |
| memo update ambiguous | memo | memo_update | needs_clarification | none | no | PASS |
| memo delete | memo | memo_delete | needs_confirmation | memo | yes | PASS |
| calendar create | calendar | calendar_create | ready | calendar | no | PASS |
| calendar search | calendar | calendar_search | ready | calendar | no | PASS |
| calendar update ambiguous | calendar | calendar_update | needs_clarification | none | no | PASS |
| calendar delete | calendar | calendar_delete | needs_confirmation | calendar | yes | PASS |
| unsupported domain | none | none | queued | none | no | PASS |

Contract checks:

- JSON parse: PASS.
- Request id preserved: PASS.
- Confirmation object present when required: PASS.
- User-visible reply text avoids internal forbidden words: PASS.
- No raw UID/secret/OAuth token/full payload in evidence: PASS.
- Shortened `Structured Output` code parsed and executed in the local harness: PASS.

## Production Publish Status

Published after user restored n8n login.

Publish/update method:

- Confirmed browser URL: `https://n8nphy.app.n8n.cloud/workflow/kcMcBQos5cxsnWU1`.
- Confirmed workflow title: `PLine｜菲比智能客服｜V3 最小 AI Agent`.
- Tried `Actions > Import from file...`; n8n appended duplicate `...1` nodes instead of replacing the workflow, so that import was immediately undone and not published.
- Updated the existing `Structured Output`, `Normalize Input`, and `AI Agent` nodes directly in the same workflow.
- Published version names used:
  - `N8N memo calendar basic CRUD contract`
  - `N8N memo calendar CRUD pronoun guard`
- UI status after final publish: `Published`.
- Workflow active evidence: node controls show `Deactivate`, indicating the workflow is active.

API/REST attempts before UI update:

- Official API read/update path was attempted against workflow `kcMcBQos5cxsnWU1`; response was HTTP `401` with API-key authorization required.
- REST workflow path was attempted against workflow `kcMcBQos5cxsnWU1`; response was HTTP `401 Unauthorized`.
- Local `_03` files were checked for an authorized n8n API key source; none was available without reading any prohibited old project or secret store.
- After user login, browser UI update succeeded.

## Production Self-Check

Production webhook path: `/webhook/pline-v3-test-ai-agent`.

No-secret probes:

- No-header direct probe returned HTTP `200` with no parseable normal contract. It did not return normal `domain/operation/tool_called` output.
- Dummy no-secret header probe was used for synthetic contract proof; no real secret value was used or recorded.

Production contract probes:

| Case | Request id preserved | Domain | Operation | Tool called | Status | Reply source | Confirmation | Safe reply | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| memo create | yes | memo | memo_create | memo_create | ready | ai_generated | no | yes | PASS |
| calendar delete confirm | yes | calendar | calendar_delete | calendar_delete | needs_confirmation | ai_generated | yes | yes | PASS |

Observed no-secret user-visible replies:

- memo create: `已幫妳記下備忘錄：買測試用牛奶。`
- calendar delete confirm: `妳確定要刪除明天下午的測試會議嗎？請確認後我會幫妳處理。`

## Required Next Step

Hand off to Worker/FIX for deterministic prefix router and backend execution/storage:

- Worker prefix router for first word `備忘錄` / `行事曆`.
- Memo storage/search/update/delete executor.
- Confirmation storage, TTL, actor fingerprint, and exactly-once execution.
- Calendar TEST Calendar credential/node execution.
- TEST validation after FIX wiring; no LINE live test was run in this N8N turn.
