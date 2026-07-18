# TEST Evidence: Dropbox Idea JSON Gate

Date: 2026-07-18
Thread: `PLine03｜TEST｜測試與驗收`
Scope: `_03` clean room only
Result: `DROPBOX IDEA JSON PATH PASS`

## Clean Room

- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Verified cwd: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- LINE app target window: `菲比智能客服 測試_03`
- Old project, `_02`, old Dropbox data, old logs, old User ID, and old secret store were not read or used.
- No secrets, raw LINE User ID, full webhook payload, or private Dropbox content were recorded.
- Git was not executed in this TEST run.

## Readiness

- Worker health: HTTP 200.
- Required Worker env flags: true.
- Durable evidence read path present: `/test/evidence`.
- Idea finalizer path present: `/test/idea-finalize`.
- Finalizer mode: task-token exactly-once.
- Remote `_03` RUNTIME_KV namespace was used for readback.
- Monitor health: `ready`.
- Monitor supported action: `save_idea_json`.
- `.gitignore` excludes local idea JSON/runtime artifacts: `idea-*.json`, `.idea-*.tmp`, `tmp/`, `runtime/`, `runtime-data/`, and `data/runtime/`.

## Live Gate Messages

The following messages were sent through the authorized LINE app with Computer Use:

```text
記一下：[redacted idea content] T2201-20260718084633
記一下：[redacted idea content] T2202-20260718084802
記一下：[redacted idea content] T2203-20260718084935
```

## Continuous Three-Run Evidence

### Run 1

- Marker: `T2201-20260718084633`
- LINE event / Worker invocation evidence: present.
- `signature_pass`: present.
- `admin_pass`: present.
- `idempotency_pass`: present.
- n8n background started/completed: present.
- Intent/action evidence: `idea_create` / `save_idea_json`.
- Monitor claim: present.
- Dropbox JSON: `idea-20260718-084641-1847198916c4.json`
- JSON parse: PASS.
- Schema: PASS, exactly 9 allowed fields.
- Content: normalized test idea text matched expected `[redacted idea content]`.
- Fingerprints: irreversible 64-hex values; no raw User ID or raw event id stored.
- Codex task: 0.
- Formal LINE final success evidence: `idea_json_final_push_completed` present.

### Run 2

- Marker: `T2202-20260718084802`
- LINE event / Worker invocation evidence: present.
- `signature_pass`: present.
- `admin_pass`: present.
- `idempotency_pass`: present.
- n8n background started/completed: present.
- Intent/action evidence: `idea_create` / `save_idea_json`.
- Monitor claim: present.
- Dropbox JSON: `idea-20260718-084810-24eb8fc7c5c5.json`
- JSON parse: PASS.
- Schema: PASS, exactly 9 allowed fields.
- Content: normalized test idea text matched expected `[redacted idea content]`.
- Fingerprints: irreversible 64-hex values; no raw User ID or raw event id stored.
- Codex task: 0.
- Formal LINE final success evidence: `idea_json_final_push_completed` present.

### Run 3

- Marker: `T2203-20260718084935`
- LINE event / Worker invocation evidence: present.
- `signature_pass`: present.
- `admin_pass`: present.
- `idempotency_pass`: present.
- n8n background started/completed: present.
- Intent/action evidence: `idea_create` / `save_idea_json`.
- Monitor claim: present.
- Dropbox JSON: `idea-20260718-084944-8a308a7a67f5.json`
- JSON parse: PASS.
- Schema: PASS, exactly 9 allowed fields.
- Content: normalized test idea text matched expected `[redacted idea content]`.
- Fingerprints: irreversible 64-hex values; no raw User ID or raw event id stored.
- Codex task: 0.
- Formal LINE final success evidence: `idea_json_final_push_completed` present.

## Schema

Allowed JSON fields only:

```text
schema_version
idea_id
content
created_at
source
actor_fingerprint
line_event_key
intent
status
```

All checked JSON files used exactly these 9 fields.

## Duplicate / Repeated Callback Test

- Method: repeated task-scoped finalizer callback for the third completed task.
- Marker: `T2203-20260718084935`
- Result: `already_completed`.
- Repeated callback push result: `pushed=false`.
- Dropbox JSON count: `20 -> 20`.
- New Dropbox JSON files: `0`.
- Repeated formal LINE reply count: `0`.
- `idea_json_final_push_completed` evidence remained a single deterministic stage key.
- Raw payload / raw User ID usage: `0`.

## Decision

Dropbox JSON writing, schema validation, irreversible fingerprints, formal LINE final success, and exactly-once repeated callback behavior all passed.

```text
DROPBOX IDEA JSON PATH PASS
```

## Release Handoff

Hand off to `PLine03｜RELEASE｜部署與收尾` for git status, secret scan, commit, and push to `v1/minimal-dual-path`.
