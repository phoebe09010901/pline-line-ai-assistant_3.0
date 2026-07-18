# FIX Evidence: Codex Delegate Final Sanitizer

Date: 2026-07-18
Scope: `_03` TEST only

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project access: prohibited
- No secret, raw LINE User ID, or full webhook payload recorded.

## Live Failure Trace

TEST evidence file: `TEST_EVIDENCE_CODEX_GATEWAY_LIVE.md`.

- Create-file task: `codex-delegate-01KXTN3G649JKB3FK03WWQHP8S`
  - Gateway execution completed and file content was byte-exact PASS.
  - Final LINE text came from the Codex result summary through Worker `naturalCodexFinalText`.
  - The prior sanitizer only checked empty and overly long text, so internal terms and paths from the raw summary could pass through.
- Read-file task: `codex-delegate-01KXTN9VJK40S6P4999FB3YK2Z`
  - Gateway execution completed and result record was completed.
  - Finalizer rejected with `codex_task_not_completed` because the Worker required the task record itself to already be `completed`.
  - The result record can now reconcile a stale/non-terminal task record when the result status is `completed`, `succeeded`, or `success`.

## Repair

- Worker codex finalizer now reads the result record before rejecting a completed callback.
- If the result is terminal-success but the task record is stale, Worker writes the same task id back as `completed` with `reconciled_from_result=true`.
- Codex completion LINE text now extracts safe user-facing content when available.
- If the Codex raw summary contains internal terms, local paths, evidence filenames, secrets vocabulary, or old-project markers, Worker sends a safe completion fallback instead of forwarding the raw summary.

## Deployment

- Worker: `pline-v3-test-line-gateway`
- URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Deployed version: `b9251772-c031-491d-a300-9d7268022386`
- Monitor code changed: no
- Monitor reload required: no
- Monitor launchd state checked: running in `_03` cwd

## Verification

- `npm --prefix worker test`: PASS
- `npm --prefix monitor test`: PASS
- `node --check worker/src/index.js`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node --check monitor/src/codex_gateway.js`: PASS
- Live `/health`: reachable; required env true; n8n production path confirmed.
- Live invalid-signature `/line/webhook`: `401`
- Secret/private scan:
  - High-risk credential patterns: no matches.
  - Internal-term/private-word scan: expected no-secret test strings, documentation evidence filenames, and sanitizer forbidden-word definitions only.

## TEST Handoff

TEST can rerun Codex Gateway live B/C:

- Create-file task should complete with a safe LINE final that contains no internal terms.
- Read-file task should now produce a completion final when the result record is completed.
- Computer Use approval is outside this fix.
