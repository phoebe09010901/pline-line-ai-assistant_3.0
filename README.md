# PLine03 Minimal LINE AI Assistant

This is a clean-room project for `菲比 LINE 智能助理_03`.

Project root:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03
```

## Scope

The first milestone is a minimal dual-path proof, limited to one-line messages.

Path A:

```text
LINE -> Cloudflare Worker -> n8n AI Agent -> idea_create -> save one sentence -> LINE reply
```

Path B:

```text
LINE -> Cloudflare Worker -> n8n AI Agent -> codex_task -> local minimal monitor -> create codex-smoke.txt -> LINE final reply
```

Path B must create exactly:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt
```

with exactly:

```text
Codex 已打通
```

## First Version Limits

This baseline does not include Google Calendar, accounting, email, attachments, multiple agents, FORMAL flows, real-time wake, WebSocket, complex queueing, complex state machines, compatibility layers, or broad regex/branch logic.

## Planned Components

- Cloudflare Worker: `pline-v3-test-line-gateway`
- Cloudflare KV: `pline-v3-test-runtime`
- Cloudflare KV: `pline-v3-test-idempotency`
- Optional Cloudflare D1: `pline-v3-test-db`
- n8n workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Local monitor: `pline-v3-test-codex-monitor`

All components are `_03` TEST resources only.

## Current Status

This repository currently contains the document and architecture baseline only. Worker, n8n workflow, local monitor, Git initialization, deployment, and live LINE testing are separate next-stage tasks.
