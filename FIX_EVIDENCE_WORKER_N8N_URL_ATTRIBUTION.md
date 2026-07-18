# FIX Evidence: Worker N8N URL Attribution

Date: 2026-07-18

Scope:

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- n8n workflow id: `kcMcBQos5cxsnWU1`
- No old project, `_02`, old secret store, old logs, old User ID, raw User ID, secrets, query strings, tokens, or full webhook payload were used or recorded.

Worker URL / Env Attribution

- Live `/health` confirms `N8N_WEBHOOK_URL` host/path:
  - host: `n8nphy.app.n8n.cloud`
  - path: `/webhook/pline-v3-test-ai-agent`
  - route type: `production`
  - workflow hint: `pline-v3-test-ai-agent`
  - no-secret path fingerprint: `377f812f`
- `wrangler.toml` also points to `https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent`.
- Current deployed Worker version after attribution repair: `d50b4501-2244-4a31-9951-f7289ca06f09`.
- Wrangler deployment list shows that version at 100%.

Worker Repair

- `/health` now exposes no-secret `n8n.webhook_target` with host, path, route type, workflow hint, and path fingerprint.
- `n8n_background_started` evidence now stores the same no-secret n8n target attribution.
- `n8n_background_contract_failed` evidence now stores no-secret response shape and request-id source flags.
- Worker n8n response normalization now accepts common wrappers:
  - `json`
  - `body`
  - `data`
  - `response`
  - `result`
  - `output` object or JSON string
- Worker request-id validation now accepts `worker_request_id` and `canonicalRequestId` as canonical request id fields before falling back to `request_id`.

Live Probe

- Pre-repair marker `T2601-20260718131959` reached Worker and failed with `request_id_mismatch`.
- Post-repair marker `T2605-20260718134400` reached Worker and proved:
  - host: `n8nphy.app.n8n.cloud`
  - path: `/webhook/pline-v3-test-ai-agent`
  - route type: `production`
  - result: `n8n_background_contract_failed`
- Post-wrapper-repair marker `T2606-20260718134903` reached Worker and proved:
  - host: `n8nphy.app.n8n.cloud`
  - path: `/webhook/pline-v3-test-ai-agent`
  - route type: `production`
  - response shape: `object`
  - `request_id` present: false
  - `worker_request_id` present: false
  - `canonicalRequestId` present: false
  - top/nested response keys: none recorded
  - result: `request_id_mismatch`

Conclusion

- Live Worker is using the correct production n8n webhook path.
- No evidence indicates Worker is calling the test webhook or another workflow path.
- The remaining blocker is n8n production response/execution attribution: the production webhook returns an empty object to Worker, so Worker has no request id or intent contract to validate.

Verification

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- `npx wrangler deploy --dry-run`: PASS
- Live `/health`: PASS
- Invalid-signature `/line/webhook`: HTTP `401`

Required Handoff

- Hand off to `PLine03｜N8N｜n8n workflow`.
- N8N must repair the live production workflow response so `/webhook/pline-v3-test-ai-agent` returns a non-empty JSON object with canonical request id and Gate fields.
- N8N should also verify whether production executions are intentionally unsaved/hidden or whether execution filters need adjustment.
