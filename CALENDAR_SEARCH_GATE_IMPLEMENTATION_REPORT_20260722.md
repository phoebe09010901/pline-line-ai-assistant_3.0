# CALENDAR_SEARCH_GATE Implementation Report

DATE: 2026-07-22 (Asia/Taipei)
PROJECT: 菲比 LINE 智能助理_03
GATE: CALENDAR_SEARCH_GATE
TASK_TYPE: implementation_search_gate
THREAD_ID: 019f8709-1c44-7151-adf0-4cd2a6770efe
TURN_ID: 019f88c0-d0fa-7240-9582-3eb2eca4f7a4

## Result

- Implementation, local proof, n8n Publish, and required Worker Deploy completed.
- Formal LINE Search acceptance was not executed in this worker and remains assigned to the existing TEST thread.
- Calendar Search is read-only. This gate performed zero Calendar create/update/delete operations and touched no existing Calendar event.
- Calendar Create continuity and Memo Core remain unchanged by the Search implementation.
- `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed` remains in force.

## Root cause and affected layers

The published workflow and Worker had no Calendar Search parser, deterministic read-only route, numbered candidate formatter, or same-actor search snapshot. Search-like follow-ups therefore could not be resolved against a bounded current result set.

Affected layers repaired:

- Worker intent parsing and routing
- Worker same-actor snapshot state, TTL, ordinal continuation, and retry idempotency
- n8n Normalize Input compatibility branch
- n8n Google Calendar `getAll` read-only route and public-safe formatter

## Frozen OpenAI core preservation

- Source export: `/Users/phoebe/Downloads/PLine｜菲比智能客服｜V3 最小 AI Agent (29).json`
- Source SHA-256: `324988b79d82157d769fdc7923ed3b541a32f65dc83c8024f687ad2ed0bd2577`
- Import candidate: `N8N_WORKFLOW_PLINE_V3_CALENDAR_SEARCH_LUNA_IMPORT.json`
- Import SHA-256: `93d05c15782e727ae88ab888060310e4f4e1cd7d4e57fb7733ac640a827dbb1b`
- `OPENAI_CORE_MODEL_STATUS: preserved_gpt-5.6-luna`
- The complete OpenAI Chat Model node was byte-equivalent before and after the merge.
- Published UI readback confirmed model `gpt-5.6-luna`, sampling temperature `0.1`, and an existing credential binding.
- Existing credential bindings were byte-equivalent in the exported source and import candidate. No credential value was read or changed.

## Workflow evidence

- Workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Workflow ID: `kcMcBQos5cxsnWU1`
- Published version: `c12e141f-fac1-481b-8f98-7b385fd9aebe`
- Published version name: `Calendar Search Read Only Snapshot Gate`
- Published canvas: 147 nodes; exactly one Search Route, Search Events, and Search Formatter.
- Required topology verified:
  - Normalize Input -> Calendar Search Route
  - Calendar Search Route true -> Calendar Search Events
  - Calendar Search Route false -> Calendar Create Route
  - Calendar Search Events -> Calendar Format Search
  - Calendar Format Search -> Respond to Webhook
- Sanitized frozen-Luna baseline: `backups/calendar-search-gate-20260722-144649/BASELINE_USER_FROZEN_LUNA_SANITIZED.json`
- Sanitized baseline SHA-256: `b996cff8dea20912537d58ac2528027656a77d920e90cfea2a387415b6507062`

## Worker evidence

- Worker changed: yes
- Deployment status: deployed
- Deployment ID: `09b42c7b-12e9-4f86-9d83-97595a9128f2`
- Search snapshots are bound to the hashed actor identity, expire after 600 seconds, and are replaced by a newer search.
- First/second continuation resolves only against the valid current same-actor snapshot.
- Public LINE formatting excludes Calendar event references and internal request/credential fields.

## Local proof

- Worker selected regression: 105/105 PASS.
- Calendar Search n8n offline contract: 38/38 PASS.
- Calendar Create regression: 18/18 PASS.
- Memo CRUD regression: 39/39 PASS.
- Memo natural reply regression: 9/9 PASS.
- Memo selection/batch archive regression: 19/19 PASS.
- Memo delete archive regression: 18/18 PASS.
- Search parser overlap with Memo `查看下一頁` was found locally, narrowed from an overbroad `查` prefix to explicit `搜尋`/`查詢`, and re-tested.
- The legacy aggregate file `worker/test/worker.test.mjs` still imports the intentionally removed `enqueueCrudTask` export and is not part of the frozen Memo checkpoint regression set; it was not repaired or restored in this Gate.

## External effects and handoff

- Calendar write effect: 0
- Calendar update effect: 0
- Calendar delete effect: 0
- Existing Calendar effect: 0
- Formal LINE test: not run in this worker
- Commit: not created
- Push: not performed
- Next handoff: existing `PLine｜TEST` must execute formal read-only Search cases A-J, including current-result ordinal selection and exactly-once evidence. It must preserve `formal_same_webhook_live_replay_not_executed` rather than claim a live identical-webhook replay PASS.
- Calendar Update/Delete and Calendar checkpoint remain unopened.
