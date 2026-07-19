# FIX Evidence: Memo Search Mapping and Pending Cleanup

Date: 2026-07-19

Scope:

- Project: `菲比 LINE 智能助理_03`
- Root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Monitor: `pline-v3-test-codex-monitor`
- Dropbox boundary: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old projects, `_02`, old Dropbox data, secrets, raw LINE User ID, and full webhook payloads were not used.

## Live Failure Input

Memo A2 live search failed with:

- request id: `pline-v3-01KXV6AXBAWFZJW17C6SX339QB`
- task id: `memo-b3cf6016faa5e74ca42089a4`
- operation: `memo_search`
- observed state before repair: task stayed `claimed`, pending index remained, LINE final was missing
- bug clue: search query was empty and unrelated smoke content appeared in preview/fallback context

## Root Cause

- Worker CRUD body sanitization did not accept the n8n field `search_query`, so memo search tasks could be enqueued without the intended query.
- Monitor task normalization applied the legacy smoke-test default content and target path to non-smoke tasks, which could contaminate CRUD summaries or fallback previews.
- Monitor did not preserve `body_text` for CRUD tasks.
- If a monitor executor threw after claim, the task could remain in `claimed` instead of becoming terminal and cleaning the pending index.
- Existing live A2 query contained a leading search verb; memo search now normalizes leading verbs such as `搜尋` before matching.

## Repair

- Worker now maps `search_query` into CRUD task `body.query` for memo search and shared calendar search/update/delete query fields.
- Monitor CRUD normalization no longer inherits fixed smoke content/path.
- Monitor preserves sanitized `body_text` for CRUD tasks.
- Monitor `claimOnce()` catches executor exceptions and turns them into a terminal failed result with finalizer and best-effort pending cleanup.
- Memo search normalizes leading search verbs before searching `_03` memo JSON files.
- Missing/empty memo search query now returns a safe terminal clarification/failure instead of leaving the task claimed.

## Recovery / Remote State

Remote `_03` KV after repair:

- `crud_task:v1:pending:*` count: `0`
- A2 task status: `completed`
- A2 final state: `completed`
- A2 result state: `completed`
- A2 durable stages include `monitor_stale_claim_recovered`, `crud_task_executed`, `crud_task_result_recorded`, `crud_task_final_push_completed`, and `crud_task_final_callback_completed`.

The recovered A2 task used its already-enqueued old query shape and safely returned no result. TEST should rerun Memo A2 to verify the new `search_query` mapping and search-verb normalization against a fresh create/search pair.

## Validation

- Worker syntax and unit tests: PASS
- Monitor syntax and unit tests: PASS
- Worker `/health`: PASS; n8n target remains production `/webhook/pline-v3-test-ai-agent`
- Invalid signature `/line/webhook`: HTTP `401`
- Monitor launchd state: `running`
- Monitor heartbeat: `ready`
- Remote CRUD pending queue: empty
- Secret/private effective scan: `effective_true_hit_count=0`; synthetic test fixture reviewed separately

## Deploy / Reload

- Worker deployed version: `c9e33b29-f7c6-4dd6-930c-040c5b7dc6cf`
- Monitor launchd runner reloaded and running

## TEST Handoff

TEST can resume from Memo A2 search with a fresh live search after Memo A1 create. Expected result: memo search task becomes terminal, pending index is removed, and LINE receives one safe final reply.
