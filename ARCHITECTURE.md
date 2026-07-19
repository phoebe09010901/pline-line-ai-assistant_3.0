# ARCHITECTURE

## Goal

Create the smallest TEST-only bridge from LINE to n8n and Codex.

Current DOC Gate adds fixed Memo and Calendar CRUD entry prefixes while keeping routing small and deterministic.

## Component Map

```text
LINE
  |
  v
Cloudflare Worker: pline-v3-test-line-gateway
  |
  v
n8n workflow: PLine｜菲比智能客服｜V3 最小 AI Agent
  |
  +-- idea_create -> enqueue save_idea_json -> local monitor -> Dropbox idea JSON -> LINE final push
  |
  +-- codex_task -> task request -> local monitor
                                      |
                                      v
                         /Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt
```

## Path A: idea_create

1. LINE sends one text event.
2. Worker verifies the request and forwards a normalized payload to n8n.
3. n8n AI Agent classifies the payload as `idea_create`.
4. n8n returns a structured result with `tool_called=idea_create`.
5. Worker creates one fixed local-monitor task with action `save_idea_json`.
6. Local monitor validates the idea schema and writes one JSON file to the fixed Dropbox directory.
7. Local monitor calls Worker `/test/idea-finalize` with task id, request id, status, and task-scoped finalize token.
8. Worker verifies the task token, uses durable final state `idea_json:v1:final:<task_id>`, and sends the success LINE final text exactly once for saved non-duplicate ideas.

Dropbox idea JSON directory:

```text
/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03
```

## Path B: codex_task

1. LINE sends one text event.
2. Worker verifies the request and forwards a normalized payload to n8n.
3. n8n AI Agent classifies the payload as `codex_task`.
4. n8n emits a fixed task with action `create_smoke_file`.
5. Local monitor claims exactly one task.
6. Local monitor creates:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt
```

7. The file content is exactly:

```text
Codex 已打通
```

8. Worker sends one LINE final reply.

## n8n First Workflow Shape

```text
Webhook
↓
Normalize Input
↓
AI Agent
├─ OpenAI Chat Model
├─ idea_create
└─ codex_task
↓
Structured Output
↓
Respond to Webhook
```

## Data Contracts

### Worker to n8n

Minimum fields:

- `request_id`
- `line_event_id`
- `reply_token`
- `user_id`
- `message_text`
- `received_at`

### n8n to Worker

Minimum fields:

- `request_id`
- `intent`
- `reply_text`
- `task_id`
- `status`

### n8n to Local Monitor

Minimum fields:

- `task_id`
- `action`
- `target_path`
- `content`

For `create_smoke_file`, `action`, `target_path`, and `content` are fixed to the smoke-file contract.

For `save_idea_json`, Worker enqueues a schema-validated idea object and a fixed `target_dir`. The monitor accepts only the fixed Dropbox directory, generates the file name internally, writes a same-directory temp file, parses it back, and then renames it to the final `idea-YYYYMMDD-HHmmss-<short-id>.json` name.

The task also carries a task-scoped `finalize_token` and encrypted `line_user_ref`. The monitor uses the token only to notify Worker that the fixed action completed; it never receives the LINE access token and never stores raw LINE User ID.

TEST status: live `_03` evidence proves Dropbox JSON write/schema and duplicate protection. The path is not accepted yet because formal LINE final evidence after `save_idea_json` completion was missing in TEST.

Latest TEST status after Worker version `3ba57849-b02c-4b6e-a066-8da95575563c`: continuous live markers produced three valid Dropbox JSON files and duplicate reprocess produced no extra file, but durable evidence still did not include `idea_json_final_push_completed`. The architecture remains accepted for fixed-directory JSON persistence only; formal final reply completion still requires FIX. Current result: `DROPBOX IDEA JSON PATH PARTIAL`. Evidence: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

Latest accepted TEST status after Worker version `cbadc5a1-4e07-44b2-853d-335c5486b11b`: durable exactly-once finalizer decouples formal LINE final push from monitor timing. The monitor writes JSON and calls `/test/idea-finalize`; Worker validates task identity/token and records final state before emitting the success final exactly once. TEST proved three valid Dropbox JSON writes, three `idea_json_final_push_completed` stages, and repeated callback `already_completed` with no second push. Current result: `DROPBOX IDEA JSON PATH PASS`. Evidence: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

Latest FIX status after Worker version `dbda345b-a3b4-41ca-bc8b-a12c8547179c`: the normal `idea_create` path no longer emits a LINE-visible fixed processing ACK. The webhook still returns HTTP `200`, records `line_visible_ack_skipped` and `webhook_http_200_returned`, continues n8n/monitor background processing, and emits exactly one natural final after Dropbox JSON save via the existing durable finalizer. Worker uses n8n `reply_text` when safe, otherwise the saved-success fallback only after save success. TEST must rerun `IDEA NATURAL FINAL REPLY WITHOUT ACK`.

Latest FIX status after Worker version `3f0f167c-71b1-4e89-aa1c-6f559507ed46`: the `codex_task` path is a minimal closed loop. Worker creates a structured queued task and only sends a processing notice after enqueue. Monitor claims the task, writes the fixed smoke file under `runtime/codex-task-smoke`, records `codex_task:v1:result:<task_id>`, and calls Worker `/test/codex-finalize`. Worker verifies task id/request id/finalize token and sends the final LINE result exactly once. TEST must run the live Codex Task Minimal Closed Loop Gate.

Latest schema FIX status: monitor lifecycle now preserves codex_task `created_at` across queued, claimed, completed, and failed states. Codex result records also include `created_at`, so TEST can trace completed/failed results back to the original task creation time.

Latest AI reply trace status: codex_task classification currently passes through n8n AI Agent, but LINE-visible processing/completed/failed replies are Worker constants. To make codex_task replies genuinely AI-generated, n8n must expose a phase-aware reply contract for `processing`, `completed`, and `failed` with `reply_source=ai_generated|fallback`; then Worker/monitor can wire those replies without changing task execution semantics.

### idea_create JSON

Allowed fields only:

- `schema_version`
- `idea_id`
- `content`
- `created_at`
- `source`
- `actor_fingerprint`
- `line_event_key`
- `intent`
- `status`

Raw LINE User ID, secrets, signatures, and full webhook payloads are not stored.

## Memo / Calendar Basic CRUD Architecture

### Fixed Entry Router

Worker trims the LINE text and reads only the first word:

- `備忘錄` routes to memo.
- `行事曆` routes to calendar.

The first word is the only route selector. Worker must not infer the route with AI, broad regex, fixed sentence catalogs, or mixed memo/calendar heuristics.

After the prefix is removed, the remaining user text is passed to n8n AI Agent for natural-language understanding inside the selected domain.

### Memo Domain

Allowed actions:

- `memo_create`
- `memo_update`
- `memo_delete`
- `memo_search`

Storage boundary:

```text
/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03
```

Memo tools must use fixed JSON operations inside the `_03` Dropbox directory only. They must reject arbitrary shell commands, arbitrary paths, user-provided filenames, and scans outside the fixed directory.

Memo update rules:

- Exactly one match: may update.
- Zero matches: ask a natural follow-up.
- Multiple matches: show a safe candidate summary and ask for confirmation.

Memo delete always requires confirmation.

### Calendar Domain

Allowed actions:

- `calendar_create`
- `calendar_update`
- `calendar_delete`
- `calendar_search`

Calendar uses the current authorized Google Calendar TEST boundary. LINE-facing copy says only `行事曆`.

Supported first-version fields:

- title
- date/time
- all-day event
- location
- description
- reminder
- basic recurrence

Calendar update rules:

- Exactly one match: may update when the requested change is narrow.
- Zero matches: ask a natural follow-up.
- Multiple matches: show a safe candidate summary and ask for confirmation.
- Broad recurring-event changes require confirmation.

Calendar delete always requires confirmation. Google Calendar event IDs must never appear in LINE-visible replies.

### Confirmation State

Confirmation is required for:

- `memo_delete`
- `calendar_delete`
- multi-candidate updates
- broad recurring-event changes
- any target the AI cannot identify uniquely

Confirmation state must be:

- scoped to the same actor fingerprint
- short-lived
- exactly-once
- stored without raw LINE User ID
- invalidated after completion, expiry, or mismatch

### Natural Reply Contract

LINE replies must be:

- Traditional Chinese
- natural
- 1-3 sentences
- truthful about the completed or pending action
- free of implementation details

Replies must not mention n8n, Worker, JSON, Dropbox, tool names, intent names, event IDs, Google event IDs, local file paths, secrets, raw LINE User IDs, full payloads, or internal task identifiers.

Fast tasks should not send a fixed processing ACK. Webhook HTTP `200` remains the transport acknowledgement.

## Explicit Non-Goals

No accounting, email, attachments, multiple agents, FORMAL mode, real-time wake, WebSocket, complex queue, complex state machine, compatibility layer, Google Tasks, or broad regex/if/else intent routing. Calendar support in this Gate is limited to the fixed `行事曆` TEST CRUD boundary above.

## TEST Status: Natural Final Without Visible ACK

Live `_03` Gate proved no visible fixed ACK for normal `idea_create`, retained webhook HTTP `200`, saved Dropbox JSON, and emitted one natural final after save. Repeated finalizer callback remained exactly-once. LINE desktop read-receipt display is tracked separately as UI/OA setting observation. Current result: `IDEA NATURAL FINAL REPLY WITHOUT ACK PASS`. Evidence: `TEST_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.

## TEST Status: Codex Task Minimal Closed Loop

Live `_03` Codex Task Gate proved monitor claim, safe runtime smoke-file execution, result record creation, natural LINE final, and repeated callback exactly-once behavior. Gate result: FAILED because the completed task record did not retain required field `created_at`. Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

After Worker version `ca9001fa-cf03-43f7-9911-33f6301dd668`, TEST rerun proved completed task and result records retain `created_at` while preserving monitor claim, safe runtime smoke-file execution, natural LINE final, and repeated callback exactly-once behavior. Gate result: PASS. Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

## FIX Status: Live Pending Monitor / Capability Boundary

Worker version `493e4b8a-91da-479e-81e0-229fd1eb72c7` adds a Gate capability boundary before codex_task enqueue. The only enabled codex_task capability remains the fixed smoke task. Requests that require browser/Computer Use or another not-yet-enabled capability are marked `capability_not_yet_enabled`, receive a natural non-success final, and are not converted to `create_smoke_file`.

Monitor adds bounded `drain` and targeted `claim-task` / `mark-capability-not-enabled` operations for `_03` live recovery. These operations still use fixed task actions and task-scoped finalizer callbacks; they do not introduce arbitrary command, arbitrary path, or browser automation capability.

## Computer Use open_browser_page Gate Feasibility

The current monitor process cannot call Codex MCP tools, `node_repl`, or the Computer Use skill. Therefore `open_browser_page` cannot be truthfully implemented as a background LINE-triggered Computer Use action without an additional bridge.

The architecture must add an explicit, audited bridge before enabling this capability. Until then, supported monitor actions remain `create_smoke_file` and `save_idea_json`.
## Durable Monitor Queue

Worker now writes a small pending index whenever it creates a monitor task:

- `idea_json:v1:pending:<task_id>` for `save_idea_json`
- `codex_task:v1:pending:<task_id>` for fixed Codex smoke tasks

The local monitor runs as a project-local launchd agent and drains only these pending indexes. It removes the index after terminal completion/failure/duplicate. A manual legacy scan is retained only for old pre-index tasks.

This keeps LINE webhook handling fast while making Dropbox JSON finalization independent of TEST manually starting a monitor poll.
## Codex Default Delegation Gateway

The `_03` Codex path now separates routing from host execution:

- Worker router keeps the outer decision small: `idea_create`, `google_calendar_direct`, or `codex_delegate`.
- `google_calendar_direct` is reserved for the future direct Calendar path and returns a truthful not-enabled final in this Gate.
- Worker enqueues `codex_delegate`, preserves `original_user_text`, and does not send a processing LINE message at enqueue time.
- Monitor owns `CodexGateway` and host adapters.
- The first production adapter is `CodexExecHostAdapter`, backed by official `codex exec --json` JSONL events.
- Monitor sends the processing LINE callback only after the Gateway observes a Codex `turn.started` event; completed/failed final callbacks remain exactly-once.
- Gateway result metadata is written under ignored runtime state.
- Approval bridge state stays in task/KV records and uses a LINE confirmation code before requeueing high-risk tasks.

Legacy `create_smoke_file` remains only for local monitor regression compatibility and is no longer the Worker router's general-task replacement.
## Memo/Calendar CRUD Extension - 2026-07-18

- LINE -> Worker keeps HTTP 200 behavior and no fixed visible ACK.
- Worker applies deterministic prefix routing before n8n: `備忘錄` maps to memo domain, `行事曆` maps to calendar domain.
- n8n returns a constrained CRUD contract; Worker enqueues `crud_task:v1`.
- Monitor durable runner claims `crud_task:v1:pending:*`.
- Memo executor writes fixed `_03` Dropbox `memo-*.json` records.
- Calendar executor is a `_03` local TEST adapter until Google Calendar OAuth/TEST Calendar host credentials are explicitly wired.
- Monitor calls Worker `/test/crud-finalize`; Worker performs LINE final push exactly once.
- Confirmation is stored in KV by actor fingerprint and expires after a short TTL.
