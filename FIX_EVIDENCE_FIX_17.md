# FIX-17 Evidence: Codex Task Monitor Claim and Smoke File Execution

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Monitor: `pline-v3-test-codex-monitor`
- Runtime KV namespace: `pline-v3-test-runtime`
- Runtime KV namespace id: `10cdfe018b3942b483faeaca6e517ae5`
- Fixed action: `create_smoke_file`
- Fixed target file: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt`
- Fixed content: `Codex 已打通`
- Clean-room boundary: no `_02`, old project, old logs, old User ID, old secret store, or old LINE resource was used.
- Secret safety: no token, channel secret, shared secret, LINE signature, raw User ID, or full LINE message text is recorded here.

## Starting Point

- TEST-13 already marked `N8N MINIMAL PATH PASS`.
- Gate 2 marker `T1304-20260718054759` proved Worker/n8n/LINE final path.
- Missing evidence before FIX-17: `monitor claim=1`, `Codex execution=1`, and live smoke-file creation or overwrite.

## Repair

- Worker now writes a no-secret pending monitor task into `_03` remote `RUNTIME_KV` when n8n returns a valid `codex_task` contract.
- Pending task prefix:

```text
codex_task:v1:task:<task_id>
```

- Worker now writes `codex_task_enqueued` evidence.
- Monitor now supports `claim-once`, `poll`, and `selftest`.
- Monitor claim flow uses `_03` remote KV with `--remote`, claims one pending task, overwrites the fixed smoke file, and writes evidence stages:
  - `monitor_claimed`
  - `codex_execution_completed`
  - `smoke_file_written`

## Deployment

- Worker deployed version: `8fedf73f-c983-43af-832b-96e9f0e957c9`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Worker `/health` now includes monitor name, task prefix, fixed action, and fixed target path.

## Live Monitor Selftest

- Before selftest, `codex-smoke.txt` mtime was `2026-07-18 05:54:05` local time.
- Selftest task id: `pline-v3-fix17-selftest-task`
- Selftest request id: `pline-v3-fix17-selftest-request`
- Selftest marker: `T1701-20260718055230`
- Selftest result: `claimed=true`, `codex_execution=true`, `file_written=true`
- File mtime updated to `2026-07-18 05:54:49` local time.
- File content is exactly `Codex 已打通`.
- Remote task record status: `completed`
- Remote evidence stages: `monitor_claimed`, `codex_execution_completed`, `smoke_file_written`

## Validation

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- `npx wrangler deploy --dry-run`: PASS
- `npx wrangler deploy`: PASS
- `node monitor/src/monitor.js health`: `ready`
- `curl /health?fix17=post-deploy`: PASS
- Synthetic invalid-signature `POST /line/webhook`: HTTP `401`
- Remote KV task record readback with `--remote`: PASS
- Remote KV monitor evidence stage readback with `--remote`: PASS
- Monitor poll command was foreground-verified. This Codex shell did not retain a detached background poller after the tool call returned, so TEST should start `node monitor/src/monitor.js poll` in the TEST thread immediately before Gate 2.

## TEST Handoff

- Gate PASS is not marked by FIX-17.
- Gate 1 is already PASS from TEST-13.
- TEST should rerun Gate 2 only.
- Before Gate 2, ensure monitor poll is running:

```text
node monitor/src/monitor.js poll
```

- Expected Gate 2 evidence after monitor claim:
  - `codex_task_enqueued`
  - `line_push_final_completed`
  - `n8n_background_completed`
  - `monitor_claimed`
  - `codex_execution_completed`
  - `smoke_file_written`
  - `codex-smoke.txt` mtime newer than the Gate 2 precheck
  - `codex-smoke.txt` content exactly `Codex 已打通`
