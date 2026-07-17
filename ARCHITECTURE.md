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
  +-- idea_create -> save one sentence -> structured result
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
4. `idea_create` saves one sentence.
5. n8n returns a structured result.
6. Worker sends one LINE reply.

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

For the first monitor, `action`, `target_path`, and `content` are fixed to the smoke-file contract.

## Explicit Non-Goals

No Google Calendar, accounting, email, attachments, multiple agents, FORMAL mode, real-time wake, WebSocket, complex queue, complex state machine, compatibility layer, or broad regex/if/else intent routing.
