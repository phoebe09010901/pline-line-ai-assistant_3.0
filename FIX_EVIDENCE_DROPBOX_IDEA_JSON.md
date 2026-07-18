# FIX Evidence: Dropbox idea_create JSON Save Path

Date: 2026-07-18

## Clean Room

- PROJECT_SCOPE_CONFIRMED: `菲比 LINE 智能助理_03`
- PROJECT_PATH_CONFIRMED: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- OLD_PROJECT_ACCESS: prohibited
- CWD_CONFIRMED: yes
- Cwd proof: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- No `_02`, old project, old Dropbox data, old logs, old User ID, or old secret store was read or used.
- No Git command was executed.

## Fixed Dropbox Directory

```text
/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03
```

The directory exists and is the only allowed target for `save_idea_json`.

## Implemented Flow

```text
LINE idea message
  -> Worker signature/admin/idempotency checks
  -> n8n production workflow validates intent=idea_create and tool_called=idea_create
  -> Worker enqueues idea_json:v1 task action save_idea_json
  -> local monitor claims task from _03 RUNTIME_KV
  -> monitor writes one JSON file to fixed Dropbox directory
  -> Worker observes completed/duplicate and sends final success text
```

Success final text:

```text
已幫妳記下這個想法 💡
```

Failure final text is a safe failure message and does not claim the idea was saved.

## JSON Schema

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

Rules:

- UTF-8 JSON with pretty indentation.
- `source` is `line`.
- `intent` is `idea_create`.
- `status` is `saved`.
- `created_at` uses Asia/Taipei ISO 8601 form with `+08:00`.
- `actor_fingerprint` and `line_event_key` are irreversible SHA-256 fingerprints.
- File name is generated internally: `idea-YYYYMMDD-HHmmss-<short-id>.json`.

## Safety Boundaries

- n8n Cloud does not receive local file permissions.
- Worker/n8n enqueue only fixed action `save_idea_json`.
- Monitor accepts only the fixed Dropbox directory.
- No arbitrary shell, arbitrary command, arbitrary file path, arbitrary filename, delete, overwrite, or path traversal is supported.
- Raw LINE User ID, access token, channel secret, n8n shared secret, Cloudflare credential, signature, and full webhook payload are not stored in repo/evidence.
- Dropbox JSON and temp files are ignored by repo rules.

## Duplicate / Idempotency Strategy

- Worker derives `line_event_key` from the LINE event id with a one-way fingerprint.
- The idea task id and idea id are deterministic from that fingerprint.
- The monitor generated file name is deterministic from `created_at` and idea id.
- If the same task/file already exists, monitor returns `duplicate` and does not overwrite or create another JSON.
- Worker LINE event idempotency prevents duplicate formal processing for redelivered LINE events after the first event is recorded.

## Validation

Local checks:

- `node --check worker/src/index.js`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node monitor/test/monitor.test.mjs`: PASS

Live no-secret selftest:

- Command: `node monitor/src/monitor.js idea-selftest --task_id=idea-fix-dropbox-20260718075500 --request_id=pline-v3-idea-fix-dropbox-20260718075500 --marker=TIDEA-20260718075500`
- Result: `claimed=true`
- Action: `save_idea_json`
- Status: `completed`
- File written: yes
- Remote marker readback: `evidence:v1:marker:TIDEA-20260718075500` resolved to `pline-v3-idea-fix-dropbox-20260718075500`
- JSON readback: exact allowed keys, `source=line`, `intent=idea_create`, `status=saved`, no raw User ID marker found
- Temp file residue check in fixed directory: none

Cloudflare checks:

- `npx wrangler deploy --dry-run`: PASS
- Deployed Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Worker version: `d5cda8d2-65bc-4cc2-b953-f67d761fde39`
- `/health`: reachable; required env flags true; `runtime_kv_bound=true`; `idempotency_kv_bound=true`; monitor action list includes `save_idea_json`
- Direct invalid-signature `/line/webhook` check: HTTP `401`

## TEST Handoff

Before testing a LINE `idea_create` Dropbox save, start monitor polling:

```text
MONITOR_POLL_ITERATIONS=45 MONITOR_POLL_INTERVAL_MS=1000 node monitor/src/monitor.js poll
```

Then send a fresh `_03` LINE idea message and verify:

- durable Worker evidence by marker or request id
- monitor evidence stages `monitor_claimed`, `idea_json_saved`, `idea_json_file_written`
- fixed Dropbox directory contains exactly one new JSON for that LINE event
- final success LINE text appears only after save/duplicate completion
