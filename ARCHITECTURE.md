# ARCHITECTURE

## Goal

Create the smallest TEST-only bridge from LINE to n8n and Codex.

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

## Explicit Non-Goals

No Google Calendar, accounting, email, attachments, multiple agents, FORMAL mode, real-time wake, WebSocket, complex queue, complex state machine, compatibility layer, or broad regex/if/else intent routing.
