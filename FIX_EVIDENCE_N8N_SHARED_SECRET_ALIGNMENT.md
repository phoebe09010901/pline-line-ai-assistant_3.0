# FIX Evidence: N8N Shared Secret Alignment

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Project root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Cloudflare Worker target: `pline-v3-test-line-gateway`
- n8n workflow target: `kcMcBQos5cxsnWU1`
- Production webhook path: `/webhook/pline-v3-test-ai-agent`
- Old project / `_02` access: prohibited and not used.

## Secret Handling

- Generated a new high-entropy `N8N_SHARED_SECRET` for this alignment.
- Set Cloudflare Worker secret name `N8N_SHARED_SECRET` using Wrangler.
- Created a new n8n Header Auth credential for header `x-pline-v3-shared-secret`.
- Published the `_03` n8n workflow with Webhook Header Auth as the primary production guard.
- Updated Normalize Input guard so `$vars.N8N_SHARED_SECRET` remains an optional compare when available, while the production path is guarded by the Webhook Header Auth credential because project variables are not available on the current n8n plan.
- Secret value was not written to repo, docs, evidence, or final output.

## No-Secret Verification

- n8n production no-header probe: HTTP `403`.
- n8n production dummy-header probe: HTTP `403`.
- n8n production real-secret probe: HTTP `200`, JSON contract returned, `request_id` preserved.
- Worker-origin protected selfcheck: HTTP `200`, Worker called n8n production with its configured env secret, `request_id_preserved=true`.
- Memo contract probe: `domain=memo`, `operation=memo_create`, `tool_called=memo_create`, `status=ready`.
- Calendar contract probe: `domain=calendar`, `operation=calendar_create`, `tool_called=calendar_create`, `status=ready`.
- Worker `/health`: required env flags true; n8n target host `n8nphy.app.n8n.cloud`, path `/webhook/pline-v3-test-ai-agent`, route type `production`.
- Invalid LINE signature route: HTTP `401`.

## Runtime Evidence

- Worker deployed version: `62655f93-ca5d-4ace-a67e-36ddf47709a0`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- n8n published version labels used this turn:
  - `PLine03 shared-secret header auth alignment`
  - `PLine03 header-auth primary guard`
- Protected Worker selfcheck endpoint added: `/test/n8n-contract/selfcheck`
- Selfcheck returns only no-secret contract fields and n8n host/path fingerprint; it does not return header values or raw payload.

## Local Validation

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json` parse: PASS
- effective secret/private scan: `effective_true_hit_count=0`

## Notes

- n8n project variables and external secrets pages were unavailable on the current plan, so the safe equivalent target is the new Header Auth credential attached to the `_03` Webhook node.
- A transient candidate secret was discarded before final alignment; the final configured value was regenerated and used only for the n8n credential and Cloudflare Worker secret.
