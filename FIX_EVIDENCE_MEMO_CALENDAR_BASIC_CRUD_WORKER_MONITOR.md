# FIX Evidence: Memo/Calendar Basic CRUD Worker + Monitor

Date: 2026-07-18
Scope: `_03` TEST only

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- CWD: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project / `_02` access: prohibited and not used
- Secrets, OAuth tokens, raw LINE User ID, and full webhook payload: not recorded

## Implemented

- Worker deterministic prefix router:
  - `備忘錄 ...` -> `domain=memo`, `body_text=...`
  - `行事曆 ...` -> `domain=calendar`, `body_text=...`
- Worker accepts n8n CRUD contract for:
  - memo: `memo_create`, `memo_update`, `memo_delete`, `memo_search`
  - calendar: `calendar_create`, `calendar_update`, `calendar_delete`, `calendar_search`
- Worker enqueues `crud_task:v1` records and exposes `/test/crud-finalize`.
- CRUD finalizer is task-token guarded and exactly-once.
- Confirmation reply path accepts only same actor fingerprint `確認` for latest pending confirmation.
- Monitor durable runner now claims `crud_task:v1:pending:*`.
- Memo backend writes only fixed `_03` Dropbox directory:
  - `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
  - memo files use `memo-*.json`
  - atomic temp write -> parse/validate -> rename
- Calendar TEST executor uses only local `_03` TEST store:
  - `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/google-calendar-test/events.json`
  - no Google OAuth token or private calendar access is stored

## Shared Secret Hardening

- Local n8n workflow artifact updated so the Normalize Input code rejects:
  - missing expected `N8N_SHARED_SECRET`
  - missing request header
  - mismatched request header
- Live production probe result:
  - no-header probe returned HTTP 200 with empty body
  - dummy-header probe returned HTTP 200 with normal contract shape
- Conclusion: live n8n production hardening is not yet proven and still appears loose. This is a live n8n publication/variable-state blocker, not a Worker/monitor code blocker.

## Deployment / Runtime

- Worker deployed: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Worker version: `e688338d-ae5d-4c25-b1d9-9ed387de522a`
- Live `/health`: runtime KV bound, CRUD finalizer enabled, `crud_task:v1` in monitor task prefixes
- Monitor launchd runner: reloaded, heartbeat `ready`

## Verification

- `node --check worker/src/index.js`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `worker npm test -- --runInBand`: PASS
- `monitor npm test -- --runInBand`: PASS
- `python3 -m json.tool N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`: PASS
- Live Worker `/health`: PASS
- Live invalid signature `/line/webhook`: HTTP 401 PASS

## Remaining Blocker

Live n8n production webhook still accepts a dummy shared-secret header and returns a normal contract. TEST should not run this Gate as PASS until workflow `kcMcBQos5cxsnWU1` production has the hardened secret guard published and verified.
