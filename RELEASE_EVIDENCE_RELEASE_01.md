# RELEASE Evidence: RELEASE-01

Date: 2026-07-18
Closeout time: 2026-07-18 06:09:07 CST

## Scope

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Mode: `_03` TEST-only clean-room closeout
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- n8n workflow id: `kcMcBQos5cxsnWU1`
- LINE channel: `菲比智能客服 測試_03`
- LINE channel id: `2010748091`
- LINE OA id: `@967fvhek`
- Old project access: none
- FORMAL/production switch: not touched
- Secrets, raw User IDs, tokens, channel secrets, LINE signatures, shared secrets, and full LINE message text: not recorded

## Gate Result

```text
N8N MINIMAL PATH PASS
CODEX MINIMAL PATH PASS
_03 MINIMAL DUAL-PATH PASS
```

Gate evidence sources:

- Gate 1 TEST-13 T-codes:
  - `T1301-20260718054524`
  - `T1302-20260718054632`
  - `T1303-20260718054707`
- Gate 2 TEST-14 marker: `T1401-20260718060326`
- Gate 2 request id: `pline-v3-01KXS1P8AC33W8BRSHDKA5WG7C`
- Gate 2 task id: `pline-v3-codex-1784325815041`

## Worker Closeout

Readback commands were run from:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03
```

Worker `/health` readback:

- `worker=pline-v3-test-line-gateway`
- Required env flags all true:
  - `LINE_CHANNEL_SECRET`
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_TEST_ADMIN_USER_IDS`
  - `N8N_WEBHOOK_URL`
  - `N8N_SHARED_SECRET`
- `runtime_kv_bound=true`
- `idempotency_kv_bound=true`
- `selfcheck_secret_configured=true`
- `line_reply_mode=fast_ack_then_background_n8n`
- `codex_task_final_mode=background_push_final`
- n8n URL: `https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent`
- monitor target path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt`

Wrangler deployment readback:

- Latest 100% deployment version: `8fedf73f-c983-43af-832b-96e9f0e957c9`
- Version created: `2026-07-17T21:54:23.268Z`
- Worker secret names present:
  - `EVIDENCE_SELFTEST_SECRET`
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_CHANNEL_SECRET`
  - `LINE_TEST_ADMIN_USER_IDS`
  - `N8N_SHARED_SECRET`

Route readback:

- Direct invalid-signature POST to `/line/webhook`: HTTP `401`
- This confirms the deployed Worker route is reachable and still enforces LINE signature checks.

## n8n Closeout

Local no-secret workflow draft:

- Name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Workflow id: `kcMcBQos5cxsnWU1`
- Project id: `CpQJpNNFd9pH0LCm`
- Local draft `active=false`
- Local draft `published=true`
- Production webhook path: `/webhook/pline-v3-test-ai-agent`
- Worker webhook URL: `https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent`
- Required header name: `x-pline-v3-shared-secret`
- Local draft contains `_03` project root and no `_02` string.

Production webhook no-secret probe:

- `POST https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent`
- Payload marker: `PLine03_RELEASE_01_no_secret`
- Header did not include shared secret.
- Result: HTTP `200`, empty body.
- Purpose: route/status readback only; no Gate LINE message was sent and no monitor task was created.

## LINE Closeout

Expected TEST channel identity:

- LINE channel: `菲比智能客服 測試_03`
- Channel id: `2010748091`
- OA id: `@967fvhek`
- Expected webhook target: `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`

No-secret status evidence:

- FIX-13 previously confirmed only this `_03` channel was inspected.
- FIX-13 confirmed `Use webhook` enabled, endpoint `active=true`, and LINE Developers Verify `Success` for the expected Worker webhook URL.
- RELEASE-01 direct Worker route readback returned HTTP `401` for an invalid-signature POST, proving the target route remains reachable and guarded.
- No LINE Gate message was resent during RELEASE-01.

## Monitor Closeout

Monitor health:

- `status=ready`
- `monitor=pline-v3-test-codex-monitor`
- `project_root=/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `fixed_action=create_smoke_file`
- `task_prefix=codex_task:v1`
- `evidence_prefix=evidence:v1`
- `runtime_kv_namespace_id=10cdfe018b3942b483faeaca6e517ae5`
- Codex executable resolved from current environment.

Gate 2 remote evidence readback:

- Marker `T1401-20260718060326` maps to request id `pline-v3-01KXS1P8AC33W8BRSHDKA5WG7C`.
- Remote stage keys present:
  - `line_event_received`
  - `signature_pass`
  - `admin_pass`
  - `idempotency_pass`
  - `line_fast_reply_completed`
  - `n8n_background_started`
  - `n8n_background_completed`
  - `codex_task_enqueued`
  - `monitor_claimed`
  - `codex_execution_completed`
  - `smoke_file_written`
  - `line_push_final_completed`

Remote task record:

- `task_id=pline-v3-codex-1784325815041`
- `status=completed`
- `monitor=pline-v3-test-codex-monitor`
- `action=create_smoke_file`
- `codex_execution=true`
- `file_written=true`
- `completed_at=2026-07-17T22:03:46.635Z`

Smoke file readback:

- Path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt`
- mtime: `2026-07-18 06:03:46 CST`
- epoch: `1784325826`
- size: `15`
- content: `Codex 已打通`

## Repository State

- `git rev-parse --is-inside-work-tree`: failed
- Result: this folder is not a Git repository.
- No commit or push was performed.

## Closeout Result

```text
PLine03 _03 TEST PROJECT COMPLETE
```
