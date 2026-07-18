# FIX Evidence: Dropbox idea JSON final LINE reply

Date: 2026-07-18

## Clean Room

- PROJECT_SCOPE_CONFIRMED: `菲比 LINE 智能助理_03`
- PROJECT_PATH_CONFIRMED: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- OLD_PROJECT_ACCESS: prohibited
- CWD_CONFIRMED: yes
- Cwd proof: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Allowed Dropbox directory only: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- No `_02`, old project, old Dropbox data, old logs, old User ID, or old secret store was read or used.
- No Git command was executed.

## TEST Failure Summary

TEST proved Dropbox JSON write, schema, fingerprint, and duplicate behavior. The remaining failure was that live runs reached monitor evidence stage `idea_json_file_written`, but Worker did not reliably emit `idea_json_final_push_completed`, so the formal LINE success final reply was not proven.

## Root Cause

Worker decided whether to send the formal idea success final only by polling the monitor task record until it became `completed` or `duplicate`.

The monitor writes durable evidence stages such as `idea_json_file_written` before the final task record update. In live timing, Worker could observe neither a completed task record nor a failure inside its wait window even though the monitor had already written the JSON and durable file-written evidence.

## Repair

Worker now treats monitor completion as proven by either:

- task record status `completed` / `duplicate`, or
- no-secret durable stage `evidence:v1:request:<request_id>:stage:idea_json_file_written` with `action=save_idea_json` and `file_written=true`.

After proven saved:

- non-duplicate events send LINE Push API final text `已幫妳記下這個想法 💡`
- Worker writes `idea_json_final_push_completed` evidence on push success
- timeout/failure sends only the safe failure text and does not claim success
- duplicate tasks write `idea_json_final_push_suppressed` and do not send another formal final reply

No raw LINE User ID, secret, token, signature, or full webhook payload is stored in evidence.

## Validation

Local checks:

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS

New unit coverage:

- monitor `idea_json_file_written` evidence fallback triggers final success push
- final success text is exactly `已幫妳記下這個想法 💡`
- timeout/failure does not send success text
- duplicate task suppresses formal final push
- raw User ID marker does not appear in evidence

Cloudflare checks:

- `npx wrangler deploy --dry-run`: PASS
- Deployed Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Worker version: `3ba57849-b02c-4b6e-a066-8da95575563c`
- `/health`: required env flags true, `runtime_kv_bound=true`, `idempotency_kv_bound=true`, monitor actions include `save_idea_json`
- Direct invalid-signature `/line/webhook` check: HTTP `401`
- Monitor health: `ready`, supported actions include `save_idea_json`

## TEST Handoff

Restart monitor polling before the next Dropbox Gate:

```text
MONITOR_POLL_ITERATIONS=45 MONITOR_POLL_INTERVAL_MS=1000 node monitor/src/monitor.js poll
```

Then rerun Dropbox Gate three-run and duplicate verification. Expected evidence per successful idea run:

- `idea_json_save_enqueued`
- `monitor_claimed`
- `idea_json_saved`
- `idea_json_file_written`
- Worker `idea_json_saved`
- Worker `idea_json_final_push_completed`
- LINE final text: `已幫妳記下這個想法 💡`

Expected duplicate evidence:

- no new Dropbox JSON
- no repeated formal final reply
- Worker `idea_json_final_push_suppressed` when duplicate processing reaches the Worker idea branch
