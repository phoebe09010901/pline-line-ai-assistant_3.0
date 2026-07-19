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
LINE -> Cloudflare Worker -> n8n AI Agent -> idea_create -> local monitor save_idea_json -> Dropbox idea JSON -> LINE final reply
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

## Original First Version Limits

Before the Memo/Calendar Basic CRUD Gate, the original baseline did not include calendar operations. The current Gate opens only the fixed TEST `行事曆` CRUD boundary described below. Accounting, email, attachments, multiple agents, FORMAL flows, real-time wake, WebSocket, complex queueing, complex state machines, compatibility layers, Google Tasks, and broad regex/branch logic remain out of scope.

## Memo / Calendar Basic CRUD Gate

Current DOC design extends the LINE entry surface from one idea phrase into two fixed safe prefixes:

- `備忘錄`: route to memo CRUD.
- `行事曆`: route to calendar CRUD.

The Worker only trims the message and checks the first word. Natural-language interpretation after the prefix belongs to the n8n AI Agent. The router must not guess the entry by AI, must not use broad regex or large fixed phrase lists, must not save calendar requests as memo records, and must not create memo requests as calendar events.

Memo first version:

- Actions: `memo_create`, `memo_update`, `memo_delete`, `memo_search`
- Storage boundary: JSON files under `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Delete requires confirmation.
- Update may proceed only when there is exactly one match.
- Zero or multiple matches require a natural follow-up or candidate summary.

Calendar first version:

- Actions: `calendar_create`, `calendar_update`, `calendar_delete`, `calendar_search`
- Uses the currently authorized Google Calendar TEST boundary.
- Supports events/tasks as calendar events, all-day events, time, location, description, reminders, and basic recurrence.
- Does not connect Google Tasks.
- Delete requires confirmation; update requires exactly one match or a natural follow-up.
- LINE-visible text says only `行事曆` and must not expose Google Calendar event IDs.

## Planned Components

- Cloudflare Worker: `pline-v3-test-line-gateway`
- Cloudflare KV: `pline-v3-test-runtime`
- Cloudflare KV: `pline-v3-test-idempotency`
- Optional Cloudflare D1: `pline-v3-test-db`
- n8n workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Local monitor: `pline-v3-test-codex-monitor`

All components are `_03` TEST resources only.

## Current Status

The TEST-only minimal dual-path proof is complete. The current post-release TEST extension adds a fixed local Dropbox JSON save path for `idea_create`.

Dropbox idea JSON directory:

```text
/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03
```

The local monitor supports exactly two fixed actions:

- `create_smoke_file`
- `save_idea_json`

`save_idea_json` writes only schema-validated idea JSON files to the fixed Dropbox directory. File names are generated internally and do not use LINE message text, raw LINE User ID, or user-provided paths.

Current TEST status for this extension:

- Dropbox JSON write/schema/duplicate evidence: PASS
- Formal LINE success final after JSON save: PASS
- Exactly-once repeated callback behavior: PASS
- Gate marker: `DROPBOX IDEA JSON PATH PASS`
- Evidence: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`

Latest TEST rerun after Worker version `3ba57849-b02c-4b6e-a066-8da95575563c`:

- Continuous markers: `T1901-20260718082215`, `T1902-20260718082305`, `T1903-20260718082309`
- Dropbox JSON write/schema/fingerprint checks: PASS
- Duplicate deterministic reprocess: PASS
- Formal LINE success final evidence `idea_json_final_push_completed`: still missing
- Current marker: `DROPBOX IDEA JSON PATH PARTIAL`

Latest TEST rerun after Worker version `cbadc5a1-4e07-44b2-853d-335c5486b11b`:

- Continuous markers: `T2201-20260718084633`, `T2202-20260718084802`, `T2203-20260718084935`
- Dropbox JSON write/schema/fingerprint checks: PASS
- Formal LINE final success evidence `idea_json_final_push_completed`: PASS
- Repeated finalizer callback: PASS, `already_completed`, `pushed=false`
- Current marker: `DROPBOX IDEA JSON PATH PASS`

Latest TEST natural reply Gate after Worker version `dbda345b-a3b4-41ca-bc8b-a12c8547179c`:

- Fixed visible ACK removed for normal `idea_create`: PASS
- Webhook HTTP 200 retained with `webhook_http_200_returned`: PASS
- `line_visible_ack_skipped`: PASS
- Natural final after Dropbox JSON save: PASS
- Repeated finalizer callback exactly-once: PASS
- LINE desktop read-receipt display: UI/OA setting observation, not a hard Gate blocker
- Current marker: `IDEA NATURAL FINAL REPLY WITHOUT ACK PASS`
- Evidence: `TEST_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`
