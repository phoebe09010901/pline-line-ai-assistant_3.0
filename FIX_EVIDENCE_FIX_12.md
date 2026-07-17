# FIX Evidence: FIX-12

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Repair target: reliable no-secret Gate evidence when Cloudflare tail or n8n execution correlation misses a live run
- Old project access: none
- Secrets, tokens, raw LINE User IDs, raw LINE signatures, and full LINE message text: not recorded
- LINE Gate messages: not sent by this FIX thread

## Root Cause

TEST-08 proved one complete Gate 1 run through Cloudflare tail, but later LINE messages had visible fast ACK replies while tail and n8n execution correlation missed the per-run background evidence. The runtime path could work, but TEST lacked a reliable persisted evidence source independent of tail streaming.

## Evidence Persistence Design

- Storage: existing `_03` TEST `RUNTIME_KV` binding.
- KV namespace: `pline-v3-test-runtime`.
- Namespace id already configured in `worker/wrangler.toml`: `10cdfe018b3942b483faeaca6e517ae5`.
- Prefix: `evidence:v1`.
- TTL: 172800 seconds.
- Request stage keys: `evidence:v1:request:<request_id>:stage:<timestamp>:<uuid>:<stage>`
- Marker index keys: `evidence:v1:marker:<T-code>` -> `<request_id>`
- Summary key: `evidence:v1:summary:<request_id>`

Persisted stage names include `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, `n8n_background_started`, `n8n_background_completed`, `n8n_background_failed`, `n8n_background_contract_failed`, `line_push_final_completed`, and their failure variants where relevant.

Persisted fields are no-secret and no-raw-user only: `request_id`, safe Gate marker, stage, timestamp, status/reason, intent, tool evidence, record/action evidence, and reply/final mode.

Not persisted: raw LINE User ID, LINE access token, LINE channel secret, LINE signature, full LINE message text, or n8n shared secret.

## TEST Readback Method

Preferred HTTP readback:

```text
GET https://pline-v3-test-line-gateway.phy4175.workers.dev/test/evidence?marker=<T-code>
GET https://pline-v3-test-line-gateway.phy4175.workers.dev/test/evidence?request_id=<request_id>
Header: x-pline-v3-shared-secret: <configured TEST shared secret>
```

Fallback Wrangler KV readback:

```text
npx wrangler kv key get --namespace-id 10cdfe018b3942b483faeaca6e517ae5 "evidence:v1:marker:<T-code>"
npx wrangler kv key list --namespace-id 10cdfe018b3942b483faeaca6e517ae5 --prefix "evidence:v1:request:<request_id>:stage:"
npx wrangler kv key get --namespace-id 10cdfe018b3942b483faeaca6e517ae5 "<stage-key>"
```

## Worker Change

- Added `/test/evidence` GET endpoint guarded by `x-pline-v3-shared-secret`.
- Added marker extraction for Gate T-codes.
- Added append-only KV stage persistence in the LINE webhook path and background n8n path.
- Added no-secret summary generation for TEST.
- Added tests for evidence persistence, marker lookup, protected readback, and no raw User ID / full message text storage.

## Deploy / Readiness

- `npx wrangler deploy --dry-run`: PASS
- Worker deployed URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Deployed Worker version: `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`
- Deployment created: `2026-07-17T20:44:18.357Z`
- `/health`: reachable, required env flags true, evidence block present with `RUNTIME_KV`, `evidence:v1`, `/test/evidence`, and guard header.
- `/test/evidence` without shared-secret header: HTTP `401`.
- Wrangler deployments and versions list show current version `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`.

## Validation

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `python3 -m json.tool N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`: PASS
- `npx wrangler deploy --dry-run`: PASS

## Remaining TEST Responsibility

TEST must rerun Gate 1 three consecutive `idea_create` messages and then Gate 2. Gate PASS is not marked by FIX-12.
