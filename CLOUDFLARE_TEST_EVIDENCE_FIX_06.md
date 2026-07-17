# Cloudflare TEST Evidence: FIX-06

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- LINE channel: `菲比智能客服 測試_03`
- LINE channel scope guard: channel name does not contain `_02`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- LINE webhook path: `/line/webhook`

## Admin Bootstrap

- Bootstrap event phrase: `PLine03 admin bootstrap`
- Admin user id source: current `_03` LINE bootstrap event
- Raw admin user id: not recorded
- `LINE_TEST_ADMIN_USER_IDS`: configured as Cloudflare Worker secret
- Bootstrap sentinel: replaced by formal Worker secret value
- Bootstrap KV key `admin:line_test_admin_user_id`: deleted after secret setup

## Cloudflare Secrets

Configured Worker secret names:

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `N8N_SHARED_SECRET`
- `LINE_TEST_ADMIN_USER_IDS`

No secret values, token values, channel secret values, or raw User IDs were written to this evidence file.

## Deployment

- Latest deploy status: success
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Latest version id: `a49c1d70-4d68-46ff-b5fe-d537b0d0869f`
- Deployment timestamp: `2026-07-17T19:07:43.445Z`

## Bindings

- `RUNTIME_KV`: `10cdfe018b3942b483faeaca6e517ae5`
- `IDEMPOTENCY_KV`: `1f857def085d466abed722e9222002e3`
- `N8N_WEBHOOK_URL`: configured

## Readiness Checks

- Worker `/health`: required env all true
- Worker syntax check: PASS
- Worker unit test: PASS
- Monitor syntax/test: PASS
- Monitor health: ready
- Bootstrap KV key deleted: confirmed
- Wrangler tail/logs connection: confirmed readable
- n8n workflow id: `kcMcBQos5cxsnWU1`
- n8n shared-secret check: configured in target workflow
- n8n local draft: left no-secret; live secret value not written to repo

## Gate Status

- Gate 1: not executed by FIX-06
- Gate 2: not executed by FIX-06
- Ready for `PLine03｜TEST｜測試與驗收`
