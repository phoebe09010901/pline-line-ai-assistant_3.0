# FIX Evidence: Codex Delegate Recent File Context

Date: 2026-07-18
Scope: `_03` TEST only

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project access: prohibited
- No secret, raw LINE User ID, or full webhook payload recorded.

## Live Failure Trace

- B create-file rerun task: `codex-delegate-01KXTP7BKF6QB5JSM15KHF3DDS`
  - Result content: current run marker `T3301-20260718211955`
  - LINE completion final safety: PASS
- C read-file rerun task: `codex-delegate-01KXTPCBW2CDTM46JF2S6RYQXB`
  - Codex execution completed and LINE completion final was sent.
  - Failure: the read result referenced older marker `T3201`, not the latest B marker `T3301`.

## Root Cause

- `codex_delegate` result records did not store durable "latest successful created file" metadata.
- When the user asked for `剛才建立的檔案`, the Codex prompt did not include a specific target file.
- Codex therefore inferred from existing runtime files and selected an older file.

## Repair

- Monitor now records a durable last-created-file context at `codex_task:v1:context:last_created_file`.
- Completed create-file results now preserve safe metadata:
  - task id
  - created time
  - `_03` runtime text-file path
  - relative path
  - SHA-256 content hash
- Read-file requests containing `剛才建立的檔案` / `剛才那個檔案` receive a prompt context block pointing to the latest successful created file.
- If no recent created-file context is available, the task fails truthfully and does not call Codex to guess an old file.
- Scope is limited to `_03` `runtime/codex-gateway/*.txt`; no Dropbox scan, old project scan, arbitrary directory scan, or user-visible path exposure.

## Verification

- `npm --prefix monitor test`: PASS
- `npm --prefix worker test`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node --check monitor/src/codex_gateway.js`: PASS
- `node --check worker/src/index.js`: PASS
- High-risk credential pattern scan: no matches.
- Broader private-word scan: expected documentation wording, fake test values, and sanitizer/prompt guard strings only.
- Existing live B runtime text file for task `codex-delegate-01KXTP7BKF6QB5JSM15KHF3DDS`: exists and is readable.

Focused coverage:

- With old `T3201` and new `T3301` completed create-file results, `讀取剛才建立的檔案` selects the new `T3301` file context.
- Missing recent-created-file context fails before Gateway submission.
- Gateway prompt contains `recent_successful_created_file` only for recent-file read tasks.

## Deployment / Reload

- Worker code changed: no
- Worker deploy required: no
- Monitor code changed: yes
- Monitor runner reload required: yes
- Monitor launchd reload: completed after ensuring `runtime/monitor-runner` exists.
- Monitor launchd state: running
- Monitor heartbeat after reload: `ready`
- Monitor launchd reload: completed
- Monitor heartbeat after reload: `ready`
- Worker `/health`: reachable
- Invalid-signature `/line/webhook`: `401`

## TEST Handoff

TEST can rerun C after a successful B create-file task. The read-file task should now read the latest successful created file from the same `_03` runtime scope, not an older runtime file.

## Follow-up: Remote KV Context Read Fix

TEST rerun:

- B task: `codex-delegate-01KXTQ5P7SZC10KMEP8JM1XZSZ`
- B content marker: `T3401-20260718213807`
- C task: `codex-delegate-01KXTQBDGNTBHSMCZ06N0HJPD6`
- C failure reason: `last_created_file_context_not_found`

Trace result:

- Remote KV key `codex_task:v1:context:last_created_file` exists.
- The key points to the B task and `_03` runtime text file.
- The local runtime file exists.
- The recorded SHA-256 matches the local file content hash.
- Root cause: `claimOnce()` created the remote KV adapter internally, but did not pass that adapter down into `runTask()`. `runTask()` therefore saw no KV adapter and returned `last_created_file_context_not_found` before Gateway prompt construction.

Follow-up repair:

- `claimOnce()` now passes the same `kv` adapter to `runTask()`.
- If `codex_task:v1:context:last_created_file` exists but fails validation, the reason is now `last_created_file_context_invalid` instead of `last_created_file_context_not_found`.

Follow-up verification:

- `npm --prefix monitor test`: PASS
- `npm --prefix worker test`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node --check monitor/src/codex_gateway.js`: PASS
- `node --check worker/src/index.js`: PASS

Follow-up deployment / reload:

- Worker code changed: no
- Worker deploy required: no
- Monitor code changed: yes
- Monitor runner reload required: yes
