# FIX Evidence: FIX-07

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- n8n workflow: `kcMcBQos5cxsnWU1`
- LINE channel: `菲比智能客服 測試_03`
- `_02` resources: not used

## Failure Being Repaired

TEST-03 Gate 1 run 1 observed:

- LINE event: 1
- Worker invocation: 1
- Worker version: `a49c1d70-4d68-46ff-b5fe-d537b0d0869f`
- Worker response: `502`
- LINE reply: none

## Root Cause

The live Worker was still configured to call the n8n `webhook-test` URL:

```text
https://n8nphy.app.n8n.cloud/webhook-test/pline-v3-test-ai-agent
```

That endpoint is not suitable for unattended LINE live Gate traffic unless n8n is actively waiting in test execution mode. TEST-03 sent a real LINE webhook into a Worker that forwarded to this test URL, so the Worker-to-n8n response path could return a non-live/non-contract response and the Worker surfaced it as `502`.

## Repair

- Changed Worker config to the n8n production webhook URL:

```text
https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent
```

- Published n8n workflow `kcMcBQos5cxsnWU1` from the n8n UI with version name `FIX-07 production webhook`.
- Added no-secret Worker stage logs for:
  - `n8n_failed`
  - `n8n_contract_failed`
  - `line_reply_failed`
  - `line_webhook_completed`
- Hardened n8n response parsing to accept direct JSON, `{ json: ... }`, and single-item array response shapes.
- Improved n8n/LINE HTTP error reasons without logging secrets.

## Deployment

- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Latest Worker version id: `19c6ece9-5d6f-4b62-a4fd-060c22c26f12`
- Deployment result: success

## Readiness Checks

- Worker syntax check: PASS
- Worker unit test: PASS
- Monitor syntax/test: PASS
- n8n workflow JSON parse: PASS
- Wrangler dry-run: PASS
- Worker `/health`: reachable
- Worker `/health` n8n URL: production webhook
- Required Worker env flags: all true
- Required Worker secret names: present
- KV bindings: present
- Wrangler tail/logs: readable
- n8n workflow `kcMcBQos5cxsnWU1`: Published

## Gate Status

- Gate 1: not rerun by FIX-07
- Gate 2: not run by FIX-07
- Next handoff: `PLine03｜TEST｜測試與驗收`
