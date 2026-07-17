# FIX-16 Evidence: Deployed KV Binding and Evidence Readback Repair

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Runtime KV namespace: `pline-v3-test-runtime`
- Runtime KV namespace id: `10cdfe018b3942b483faeaca6e517ae5`
- Idempotency KV namespace: `pline-v3-test-idempotency`
- Idempotency KV namespace id: `1f857def085d466abed722e9222002e3`
- Clean-room boundary: no `_02`, old project, old logs, old User ID, old secret store, or old LINE resource was used.
- Secret safety: no token, channel secret, shared secret, LINE signature, raw User ID, or full LINE message text is recorded here.

## Finding

- The deployed Worker binding is correct:
  - `env.RUNTIME_KV` -> `10cdfe018b3942b483faeaca6e517ae5`
  - `env.IDEMPOTENCY_KV` -> `1f857def085d466abed722e9222002e3`
- The deployed Worker version before FIX-16 was `5a41bd15-789f-43ce-9bd0-2365d9dcef21`.
- TEST-12 readbacks that returned `Value not found` matched Wrangler local KV behavior when `--remote` is omitted.
- Remote KV readback proves TEST-12 marker exists:

```text
evidence:v1:marker:T1201-20260718053133 -> pline-v3-01KXRZVVGEYNA73MFH0678VVT2
```

- Remote KV request-stage readback for that request id includes:
  - `line_event_received`
  - `signature_pass`
  - `admin_pass`
  - `idempotency_pass`
  - `line_fast_reply_completed`
  - `n8n_background_started`
  - `n8n_background_completed`
- Protected HTTP readback for `T1201-20260718053133` returned summary:
  - `line_event=true`
  - `signature=true`
  - `admin=true`
  - `idempotency=true`
  - `fast_ack=true`
  - `n8n_started=true`
  - `n8n_completed=true`
  - `intent=idea_create`
  - `tool_called=idea_create`
  - `saved_record=1`
  - `codex_task=0`

## Repair

- Added TEST-only protected selfcheck endpoint:

```text
POST /test/evidence/selfcheck
```

- Selfcheck writes and reads a safe diagnostic marker/stage pair in deployed `RUNTIME_KV`.
- Added optional Worker secret name `EVIDENCE_SELFTEST_SECRET`; value was generated and configured without outputting or writing it to repo.
- `/health` now reports:
  - `runtime_kv_bound`
  - `idempotency_kv_bound`
  - `selfcheck_secret_configured`
  - `selfcheck_path`
- `/test/evidence` can now be guarded by either `x-pline-v3-shared-secret` or `x-pline-v3-selftest-secret`.
- Added fast ACK evidence checkpoint:
  - after LINE fast ACK succeeds, Worker performs a bounded durable checkpoint for marker and foreground stages
  - timeout is bounded at `1500ms`
  - slow KV still does not block the webhook indefinitely; the checkpoint task is also handed to `ctx.waitUntil(...)`

## Deployment

- Final deployed Worker version: `8a23d5c0-e014-4cbd-b594-9f7814eeb6c1`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Secret names present by name only:
  - `EVIDENCE_SELFTEST_SECRET`
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_CHANNEL_SECRET`
  - `LINE_TEST_ADMIN_USER_IDS`
  - `N8N_SHARED_SECRET`

## Validation

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `python3 -m json.tool N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`: PASS
- `npx wrangler deploy --dry-run`: PASS; bindings show `_03` remote namespace ids.
- `npx wrangler deploy`: PASS
- `/health?fix16=final-version`: reachable; required env true; `runtime_kv_bound=true`; `idempotency_kv_bound=true`; `selfcheck_secret_configured=true`
- Synthetic invalid-signature `POST /line/webhook`: HTTP `401`
- Live selfcheck marker `T1603-20260718054530`: PASS
- Remote KV marker readback with `--remote`: PASS
- Remote KV stage prefix readback with `--remote`: PASS
- Protected HTTP readback for TEST-12 marker `T1201-20260718053133`: PASS

## TEST Handoff

- Gate PASS is not marked by FIX-16.
- TEST should rerun Gate 1 three consecutive idea_create runs and Gate 2.
- If using Wrangler KV evidence fallback, TEST must use `--remote`:

```text
npx wrangler kv key get 'evidence:v1:marker:<T-code>' --namespace-id 10cdfe018b3942b483faeaca6e517ae5 --remote
npx wrangler kv key list --namespace-id 10cdfe018b3942b483faeaca6e517ae5 --prefix 'evidence:v1:request:<request_id>:stage:' --remote
```

- The protected endpoint `/test/evidence?marker=<T-code>` also supports durable readback when a configured evidence read secret is available.
