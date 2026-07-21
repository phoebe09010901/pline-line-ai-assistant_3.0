# LINE Reply-First Delivery Gate Evidence — 2026-07-20

## Scope and boundaries

- Target workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent` (`kcMcBQos5cxsnWU1`).
- Target Worker: existing `pline-v3-test-line-gateway` only.
- Checkpoint actions remain `create_smoke_file` and `save_idea_json` only.
- No Monitor start/load, production KV query, LINE message, marker, Path A/Path B live execution, Memo/Calendar operation, `_02` access, commit, or push occurred.

## Before state and backup

- Active n8n workflow was downloaded before modification and stored at `backups/line-reply-first-delivery-gate-20260720-115348/active-n8n-workflow-before.json`.
- The active export is workflow ID `kcMcBQos5cxsnWU1`, `active=true`, Webhook `headerAuth`, and its `Normalize Input` already preserves `reply_token` and `received_at`.
- Worker source, Monitor source, related tests, full unstaged diff, and staged diff were backed up under `backups/line-reply-first-delivery-gate-20260720-115348/`.
- Existing unrelated working-tree changes were preserved.

## Implemented contract

- Webhook `replyToken` is normalized as `reply_token` with Webhook `received_at`.
- Checkpoint pending tasks temporarily retain `reply_token` and `reply_received_at`.
- Monitor normalization preserves both fields through claim and finalizer callback.
- Terminal task records remove `reply_token` after the callback, including failure paths.
- Final delivery attempts Reply API once only when age is within 45 seconds.
- Reply requests never include `X-Line-Retry-Key`.
- Reply success suppresses Push and any Push retry record.
- Missing/expired token or explicit non-success Reply response uses the existing Push fallback.
- Ambiguous Reply transport returns `delivery_ambiguous`, performs no second Reply, and performs no immediate Push.
- Push fallback retains one durable retry key and at most two same-key attempts.
- Push monthly usage state is outside Reply eligibility and cannot block an eligible Reply request.
- Raw `reply_token` is excluded from delivery records, evidence records, health, logs, errors, and Dropbox idea JSON.
- Webhook idempotency is persisted before background n8n processing; duplicate task keys remain exactly-once.

## n8n result

- No n8n node change was required: the active published workflow already had Header Auth and preserved both required fields.
- Workflow ID was not changed and no workflow was created.
- No no-op Publish was performed.

## Offline verification

- Worker and Monitor source syntax: PASS.
- Reply-first required cases: PASS 10/10.
- Monitor reply-token retention/redaction contract: PASS.
- Checkpoint-compatible suite: PASS 6/6.
- Monitor skeleton suite: PASS.
- Monitor polling-budget suite: PASS 4/4.
- `git diff --check`: PASS.
- Credential-shaped scan of directly changed source/tests: PASS, no match.
- The older broad `worker.test.mjs` cannot start because it still imports removed CRUD exports such as `enqueueCrudTask`; CRUD was intentionally not restored because it is forbidden in this Gate.

## Deployment and one health check

- Wrangler dry-run: PASS.
- Existing Worker deployed successfully.
- Deployed Version ID: `59798b98-f953-425c-a9fb-c3ca2086f205`.
- Read-only `wrangler deployments status`: the above version is active at 100%.
- Exactly one post-deploy `/health` GET was issued and returned HTTP 200.
- That single response still reported the old `line-final-delivery-429-retry-v1` Push-only health contract instead of `line-reply-first-push-fallback-v1`.
- No second `/health` request was sent.

## Final verdict

```text
GATE=BLOCKED_RUNTIME_HEALTH_CONTRACT_MISMATCH
LOCAL_IMPLEMENTATION=PASS
OFFLINE_REQUIRED_CASES=PASS_10_OF_10
N8N_WORKFLOW=UNCHANGED_EXISTING_COMPATIBLE
N8N_PUBLISHED=UNCHANGED_ALREADY_PUBLISHED
DRY_RUN=PASS
WORKER_DEPLOYMENT=DEPLOYED_ACTIVE_100_PERCENT
HEALTH_HTTP=200_ONE_REQUEST_ONLY
HEALTH_CONTRACT=FAIL_OLD_PUSH_ONLY_CONTRACT_RETURNED
MONITOR_FINAL_STATE=STOPPED_UNLOADED
LIVE_TEST=NOT_RUN
```
