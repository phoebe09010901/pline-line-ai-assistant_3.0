# FIX Evidence: LINE Mark As Read

Date: 2026-07-18

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Old project, `_02`, old Dropbox, old secret store, old logs, old User ID, raw User ID, secrets, and full webhook payload were not used or recorded.

## Official Behavior Confirmed

LINE Messaging API supports marking user messages as read with:

```text
POST https://api.line.me/v2/bot/chat/markAsRead
```

The read token comes from `message.markAsReadToken` in the webhook message event. It is used transiently only.

## Implementation

- Added `markLineMessageAsRead(markAsReadToken, env)`.
- Added `markLineMessageAsReadForEvent(event, normalized, env)`.
- Worker calls mark-as-read only after:
  - signature PASS
  - admin PASS
  - idempotency PASS
- Worker calls mark-as-read before n8n background work is scheduled.
- No visible ACK was reintroduced.
- The webhook still returns HTTP 200 independently of mark-as-read success/failure.
- The token is not added to normalized n8n payload, KV task records, durable evidence, docs, or logs.

## No-secret Evidence Stages

- `line_mark_as_read_completed`
- `line_mark_as_read_skipped_no_token`
- `line_mark_as_read_failed`

Failure evidence records only sanitized categories such as HTTP status category or timeout/exception category.

## Deployment

Worker deployed:

```text
09d51a3b-6301-4c0b-b0f2-bd3db8229638
```

Worker URL:

```text
https://pline-v3-test-line-gateway.phy4175.workers.dev
```

Worker `/health` now exposes no-secret `line_mark_as_read` support metadata.

## Verification

- `node --check worker/src/index.js`: PASS
- `node --test worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node --test monitor/test/monitor.test.mjs`: PASS
- Worker `/health`: reachable; required env true; mark-as-read metadata present
- invalid signature `/line/webhook`: `401`
- launchd monitor runner heartbeat: `ready`

Unit coverage:

- message event with read token calls `/v2/bot/chat/markAsRead` once with Bearer auth and correct body shape.
- no read token writes `line_mark_as_read_skipped_no_token` and continues.
- LINE mark-as-read API failure writes `line_mark_as_read_failed` but still allows webhook HTTP 200 and background n8n processing.
- admin failure does not call mark-as-read.
- idea_create still skips visible ACK and proceeds through background queue.
- codex_task capability guard remains unchanged.

## Handoff

Hand off to TEST for live LINE validation:

- send one unique idea_create marker
- confirm LINE UI shows read state if exposed by the client
- confirm durable evidence has `line_mark_as_read_completed`
- confirm no fixed ACK
- confirm one natural final reply and Dropbox JSON PASS

## Follow-up: Chat Off Primary Mode

Date: 2026-07-18

Live T3001 confirmed:

- `_03` OA Chat is turned off in LINE OA Manager.
- LINE desktop visual read state: PASS.
- idea_create / Dropbox / final reply: PASS.
- Worker API mark-as-read stage was `line_mark_as_read_failed`.

Decision:

- Current `_03` primary read receipt solution is OA Chat off auto-read.
- Worker mark-as-read API remains available only as a future Chat-on optional capability.
- Default Worker behavior no longer calls the API.

Implementation:

- Added feature flag:

```text
LINE_MARK_AS_READ_ENABLED === "true"
```

- Default: disabled.
- Default evidence stage: `line_mark_as_read_skipped_disabled`.
- Enabled mode still supports:
  - `line_mark_as_read_completed`
  - `line_mark_as_read_skipped_no_token`
  - `line_mark_as_read_failed`

Deployment:

```text
b39f1e21-f5e3-41e8-a673-1f77e45c98cb
```

Verification:

- Worker `/health`: `line_mark_as_read.enabled=false`, `mode=disabled_chat_off_auto_read`.
- `node --test worker/test/worker.test.mjs`: PASS
- `node --test monitor/test/monitor.test.mjs`: PASS
- invalid signature `/line/webhook`: `401`
- monitor runner heartbeat: `ready`
