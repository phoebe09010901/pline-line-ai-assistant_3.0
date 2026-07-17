# FIX-15 Evidence: Durable Evidence Persistence Repair

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- KV bindings: `_03` TEST `RUNTIME_KV` and `IDEMPOTENCY_KV`
- Clean-room boundary: no `_02`, old project, old logs, old User ID, old secret store, or old LINE resource was used.
- Secret safety: no token, channel secret, shared secret, LINE signature, raw User ID, or full LINE message text is recorded here.

## TEST-11 Failure Being Repaired

- TEST-11 runtime path succeeded in sanitized tail evidence:
  - LINE event received
  - Worker invocation returned HTTP `200`
  - signature/admin/idempotency passed
  - fast ACK completed
  - n8n background completed
  - `intent=idea_create`
  - `tool_called=idea_create`
  - `saved_record=1`
- Durable evidence failed:
  - `evidence:v1:marker:T1101-20260718051847` returned `Value not found`
  - request stage prefix returned no stage keys

## Root Cause

- Evidence persistence wrote the request stage and summary before the marker index.
- After FIX-14 moved foreground evidence into `ctx.waitUntil(...)`, a slow or failed KV write before the marker could leave TEST without the primary marker lookup even though the runtime path completed.
- Stage keys also used append-only random suffixes, which made exact request-stage readback less deterministic than needed for Gate evidence.
- The no-secret failure log used `stage` inside log details, which could overwrite the outer log stage and hide `evidence_persist_failed`.

## Repair

- `persistEvidenceStage(...)` now writes the marker index first when a safe Gate marker is present.
- Summary and stage records are still written after the marker.
- Stage keys are now deterministic by request/stage:

```text
evidence:v1:request:<request_id>:stage:<stage>
```

- Marker lookup remains:

```text
evidence:v1:marker:<T-code>
```

- `/test/evidence?marker=<T-code>` can resolve the marker to request id and return stage summary.
- `/test/evidence?request_id=<request_id>` can read the deterministic request stage keys.
- Evidence failure logs now emit outer stage `evidence_persist_failed` and details field `failed_stage`, without secrets or raw User ID.
- Foreground LINE webhook still uses `ctx.waitUntil(...)`, so slow evidence persistence does not block the fast ACK/webhook response.

## Test Coverage

- Added full webhook evidence readback coverage:
  - synthetic valid webhook with marker `T1501-20260718010105`
  - `handleLineWebhook(...)` returns HTTP `200`
  - queued evidence completes
  - `handleEvidenceRead(...?marker=T1501-20260718010105)` returns request id, marker, stages, and summary
  - summary proves `line_event`, `signature`, `admin`, `idempotency`, `fast_ack`, `n8n_started`, `n8n_completed`, `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`
- Added failed KV put coverage:
  - `persistEvidenceStage(...)` returns `reason=evidence_persist_failed`
  - no secret/raw User ID is exposed
- Existing slow KV coverage still proves webhook HTTP `200` returns when `RUNTIME_KV.put(...)` never resolves.

## Deployment

- Worker deployed version: `5a41bd15-789f-43ce-9bd0-2365d9dcef21`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Latest version timestamp from Wrangler: `2026-07-17T21:24:36.010Z`

## Validation

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `python3 -m json.tool N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`: PASS
- `npx wrangler deploy --dry-run`: PASS
- `npx wrangler deploy`: PASS
- `/health?fix15=deployed`: reachable; required env flags true; evidence block present
- Synthetic invalid-signature `POST /line/webhook`: HTTP `401`
- Wrangler latest version readback: `5a41bd15-789f-43ce-9bd0-2365d9dcef21`

## TEST Handoff

- Gate status is not marked PASS by FIX-15.
- TEST should rerun Gate 1 three consecutive idea_create runs and Gate 2.
- For each Gate marker, TEST can use the guarded endpoint:

```text
GET /test/evidence?marker=<T-code>
```

- If tail misses a run, durable readback should verify marker, request id, stages, and summary.
