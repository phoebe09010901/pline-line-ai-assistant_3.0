# PROJECT_STATE

## Project

- Name: `菲比 LINE 智能助理_03`
- Root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Mode: clean-room TEST baseline
- Current stage: N8N phase-aware codex reply contract

## Scope Confirmation

- PROJECT_SCOPE_CONFIRMED: `菲比 LINE 智能助理_03`
- PROJECT_PATH_CONFIRMED: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- OLD_PROJECT_ACCESS: prohibited
- CWD_CONFIRMED: yes

## Objective

Build the smallest dual-path LINE loop:

- Path A: receive one LINE message, classify it as `idea_create`, save one sentence, and reply to LINE.
- Path B: receive one LINE message, classify it as `codex_task`, let the local monitor create `codex-smoke.txt`, and send a final LINE reply.

## Completion Markers

- `N8N MINIMAL PATH PASS`: Path A succeeds three consecutive times.
- `CODEX MINIMAL PATH PASS`: Path B succeeds once.
- `_03 MINIMAL DUAL-PATH PASS`: both markers are complete.

## RELEASE-01 Closeout

- Date: 2026-07-18
- Result: `PLine03 _03 TEST PROJECT COMPLETE`
- Gate result: `_03 MINIMAL DUAL-PATH PASS`
- Gate 1 marker set: `T1301-20260718054524`, `T1302-20260718054632`, `T1303-20260718054707`
- Gate 2 marker: `T1401-20260718060326`
- Worker deployed version: `8fedf73f-c983-43af-832b-96e9f0e957c9`
- Worker `/health`: reachable; required env flags true; `runtime_kv_bound=true`; `idempotency_kv_bound=true`
- n8n workflow id: `kcMcBQos5cxsnWU1`; local no-secret draft records `published=true`; production webhook route returned HTTP `200` to a no-secret RELEASE probe
- LINE TEST channel: `菲比智能客服 測試_03` / `2010748091` / `@967fvhek`; webhook target remains the `_03` Worker `/line/webhook`
- Monitor: `pline-v3-test-codex-monitor` health `ready`; Gate 2 remote task record completed with `codex_execution=true` and `file_written=true`
- Smoke file: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt`; mtime `2026-07-18 06:03:46 CST`; content `Codex 已打通`
- Repository: not a Git repository; no commit or push performed
- Evidence: `RELEASE_EVIDENCE_RELEASE_01.md`
- Secrets/raw User IDs/FORMAL/old project: not exposed, not touched

## Dropbox idea_create JSON Extension

- Date: 2026-07-18
- Scope: `_03` TEST-only; no `_02`, old project, old secret store, old logs, or old User ID used.
- Worker deployed version: `d5cda8d2-65bc-4cc2-b953-f67d761fde39`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Dropbox fixed directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Path A extension: `idea_create` now enqueues fixed monitor action `save_idea_json`.
- Monitor: `pline-v3-test-codex-monitor` supports fixed actions `create_smoke_file` and `save_idea_json`.
- JSON schema: only `schema_version`, `idea_id`, `content`, `created_at`, `source`, `actor_fingerprint`, `line_event_key`, `intent`, `status`.
- Duplicate strategy: deterministic LINE event fingerprint creates one task/file identity; duplicate task/file returns existing result without overwrite.
- Live no-secret selftest: remote `_03` KV task was claimed by monitor, Dropbox JSON was written, evidence marker `TIDEA-20260718075500` resolved to request id `pline-v3-idea-fix-dropbox-20260718075500`.
- Validation passed: Worker syntax, monitor syntax, Worker unit tests, monitor unit tests, Wrangler dry-run, deploy, `/health`, invalid-signature route `401`, remote KV marker readback.
- Evidence: `FIX_EVIDENCE_DROPBOX_IDEA_JSON.md`

## Dropbox idea_create Final Reply Repair

- Date: 2026-07-18
- Scope: `_03` TEST-only; no `_02`, old project, old Dropbox data, old logs, old User ID, or old secret store used.
- Root cause: Worker waited only for monitor task record completion; live monitor wrote `idea_json_file_written` evidence before the final task record update, so Worker could miss the save completion inside its wait window.
- Repair: Worker now accepts `idea_json_file_written` durable evidence as monitor completion proof, then sends formal LINE final success for non-duplicate saved events.
- Duplicate behavior: duplicate task processing writes `idea_json_final_push_suppressed` and does not repeat formal final LINE push.
- Worker deployed version: `3ba57849-b02c-4b6e-a066-8da95575563c`
- Validation passed: Worker syntax, Worker unit tests, monitor syntax, monitor unit tests, Wrangler dry-run, deploy, `/health`, invalid-signature route `401`, monitor health.
- Evidence: `FIX_EVIDENCE_DROPBOX_IDEA_FINAL_REPLY.md`

## Dropbox idea_create Final Exactly-Once Repair

- Date: 2026-07-18
- Scope: `_03` TEST-only; no `_02`, old project, old Dropbox data, old logs, old User ID, or old secret store used.
- Root cause: idea final reply still depended on Worker/monitor timing-window visibility.
- Repair: monitor now calls Worker `/test/idea-finalize` after `save_idea_json`; Worker verifies a task-scoped `finalize_token`, decrypts encrypted `line_user_ref`, and writes durable final state `idea_json:v1:final:<task_id>` before LINE push.
- Exactly-once behavior: repeated callback does not send a second push; duplicate status suppresses formal final; failed status sends no success final.
- Worker deployed version: `cbadc5a1-4e07-44b2-853d-335c5486b11b`
- Validation passed: Worker syntax, monitor syntax, Worker unit tests, monitor unit tests, Wrangler dry-run, deploy, `/health`, invalid-signature route `401`, invalid finalize route `400`, monitor health.
- Evidence: `FIX_EVIDENCE_DROPBOX_IDEA_FINAL_EXACTLY_ONCE.md`

## N8N Phase-Aware Codex Reply Contract

- Date: 2026-07-18
- Scope: `_03` workflow `kcMcBQos5cxsnWU1` only; no old project/workflow/log/secret source was used.
- n8n workflow version published: `N8N phase-aware codex reply contract`.
- `Normalize Input` now accepts sanitized `codex_task` phase fields: `intent`, `phase`, `original_user_text`, `task_summary`, `project_name`, `actual_result`, and `actual_status`.
- `AI Agent` now has a phase-aware reply contract for `processing`, `completed`, and `failed`.
- `Structured Output` now returns `reply_text` plus `reply_source`; invalid or missing AI text is marked `fallback_required` for Worker fallback.
- `idea_create` behavior and Dropbox JSON schema were not changed.
- No LINE live test, Git commit, Git push, secret output, raw User ID output, or full webhook payload output was performed.
- Evidence: `N8N_PHASE_AWARE_REPLY_EVIDENCE.md`.

## Live Regression Intake After N8N Phase-Aware Contract

- Date: 2026-07-18
- Source: 菲比 LINE desktop screenshot / live field report.
- Current status: `TEST diagnosed`; do not mark a live Gate PASS from the N8N synthetic validation.
- Reported `idea_create` risk: input `記一下：[REDACTED_IDEA_CONTENT]` showed no LINE reply.
- Reported `codex_task` risk: input `請 Codex 幫我用computer use開啟一個新的網頁` received only the processing reply, with no computer action and no completed/failed final.
- Capability note: arbitrary Computer Use / opening a webpage is not enabled in the current fixed minimal smoke-task Gate; it should be marked `capability_not_yet_enabled` and receive a truthful non-success final, not remain processing.
- LINE read-state observation: no visible `已讀`; track separately from webhook HTTP `200`, LINE event receipt, and final push evidence.
- TEST diagnosis:
  - `1153` request id `pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R` reached Worker, passed signature/admin/idempotency, returned webhook HTTP `200`, skipped visible ACK as designed, completed n8n with `intent=idea_create` and `tool_called=idea_create`, and enqueued `save_idea_json`; it stopped at pending monitor/finalizer state with no Dropbox JSON attribution and no final push evidence.
  - Computer-use/open-page request id `pline-v3-01KXSP35BTPS6GH5VM25JF9BJV` reached Worker, passed signature/admin/idempotency, completed n8n as `codex_task`, enqueued task `pline-v3-codex-1784347208503`, and delivered the processing notice; remote task stayed `queued` with no monitor claim/result/finalizer.
  - Additional capability gap: the not-yet-enabled Codex request was accepted into fixed action `create_smoke_file` instead of returning a natural capability-boundary final.
- Required next step: FIX must provide a durable live `_03` monitor runner or Worker timeout/failure final for unclaimed monitor work, and must mark not-yet-enabled `codex_task` capabilities as `capability_not_yet_enabled`. LINE desktop `已讀` should be investigated separately in `_03` LINE Developers / LINE OA Manager settings.
- Evidence: `TEST_EVIDENCE_LIVE_REGRESSION_1153_CODEX_PENDING_READ.md`.

## Current Evidence

- DOC baseline files created in `_03`.
- Worker skeleton created for `pline-v3-test-line-gateway`.
- Worker skeleton declares TEST-only KV resources: `pline-v3-test-runtime` and `pline-v3-test-idempotency`.
- Worker skeleton includes LINE signature, TEST admin, idempotency, n8n webhook, Path A `idea_create`, and Path B `codex_task` contract checks.
- Local monitor skeleton created for `pline-v3-test-codex-monitor`.
- Local monitor supports only fixed action `create_smoke_file`.
- Local monitor target path is fixed to `/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt`.
- Local monitor content is fixed to `Codex 已打通`.
- CODEX_BIN startup/health resolution skeleton is present.
- n8n workflow `PLine｜菲比智能客服｜V3 最小 AI Agent` was created as a new `_03` TEST-only workflow.
- n8n workflow id: `kcMcBQos5cxsnWU1`.
- n8n webhook path: `pline-v3-test-ai-agent`.
- n8n test webhook URL for Worker handoff: `https://n8nphy.app.n8n.cloud/webhook-test/pline-v3-test-ai-agent`.
- n8n OpenAI Chat Model uses the existing credential label `OpenAI account`; no secret was read or exported.
- n8n workflow remains not activated and not published by this stage.
- Saved no-secret local draft: `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`.
- Worker `N8N_WEBHOOK_URL` is aligned to `https://n8nphy.app.n8n.cloud/webhook-test/pline-v3-test-ai-agent`.
- Worker shared secret env/header contract is aligned to `N8N_SHARED_SECRET` / `x-pline-v3-shared-secret`.
- Worker accepts the first-version n8n intent set: `idea_create`, `codex_task`, `clarify`, `unsupported`.
- Gate 1/Gate 2 TEST scope remains limited to `idea_create` and `codex_task`.
- `clarify` and `unsupported` use safe default reply text if n8n omits `reply_text`.
- No LINE connection, Gate 1/Gate 2 live test, Cloudflare deployment, or production activation was completed in this FIX-02 stage.
- TEST-01 local readiness reran the minimal Worker and monitor tests: `worker skeleton tests PASS`; `monitor skeleton tests PASS`.
- TEST-01 local monitor health returned `ready` with Codex executable resolved from the current environment.
- TEST-01 Cloudflare dry-run passed for Worker `pline-v3-test-line-gateway` using `npx wrangler deploy --dry-run`; no external deploy was performed.
- TEST-01 verified the local Worker config still declares only `_03` TEST names for Worker/KV/D1 and the n8n TEST webhook.
- TEST-01 did not create Cloudflare KV/D1 resources, set Worker secrets, set n8n environment secrets, connect LINE Developers, or execute a LINE live Gate 1/Gate 2 message.
- Gate 1 live status: blocked before execution because TEST secrets, Cloudflare deployed bindings, n8n secret confirmation, LINE Developers TEST webhook setup, and a真人 LINE send are not yet confirmed through authorized channels.
- Gate 2 live status: blocked before execution for the same external TEST setup requirements; the local `codex-smoke.txt` created by monitor testing is readiness evidence only and is not a live Gate 2 pass.
- TEST-02 received authorization text: `TEST live gate 已完成授權設定`.
- TEST-02 Cloudflare live readiness failed before Gate execution: `npx wrangler deployments list --name pline-v3-test-line-gateway`, `npx wrangler versions list --name pline-v3-test-line-gateway`, and `npx wrangler secret list --name pline-v3-test-line-gateway` all reported that Worker `pline-v3-test-line-gateway` does not exist in the currently logged-in Cloudflare account.
- TEST-02 confirmed `worker/wrangler.toml` still contains only placeholder KV binding IDs and no live `[[kv_namespaces]]` bindings.
- TEST-02 local monitor health remains `ready`.
- TEST-02 did not execute Gate 1 or Gate 2 LINE messages because no live `_03` TEST Worker exists to receive the LINE webhook.
- Gate 1 live status: failed before execution due to missing Cloudflare TEST Worker.
- Gate 2 live status: failed before execution due to missing Cloudflare TEST Worker.
- FIX-03 Wrangler context confirmed logged-in Cloudflare account `689b11645545394cce76cf14fdbadb4c`.
- FIX-03 created new `_03` TEST KV namespace `pline-v3-test-runtime` with id `10cdfe018b3942b483faeaca6e517ae5`.
- FIX-03 created new `_03` TEST KV namespace `pline-v3-test-idempotency` with id `1f857def085d466abed722e9222002e3`.
- FIX-03 updated `worker/wrangler.toml` with live `RUNTIME_KV` and `IDEMPOTENCY_KV` bindings.
- FIX-03 did not create D1 because first-stage TEST readiness does not require it.
- FIX-03 found no authorized local values for required Worker secrets: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `N8N_SHARED_SECRET`, and `LINE_TEST_ADMIN_USER_IDS`.
- FIX-03 did not deploy Worker because required TEST secrets are missing from authorized local sources.
- FIX-03 Wrangler dry-run passed with live `RUNTIME_KV` and `IDEMPOTENCY_KV` bindings.
- FIX-03 local validation passed: Worker syntax, monitor syntax, Worker unit test, monitor unit test, n8n JSON parse, and monitor health.
- FIX-03 evidence file: `CLOUDFLARE_TEST_EVIDENCE_FIX_03.md`.
- FIX-04 SCOPE GUARD correction: `_02` named LINE channel secrets/tokens are prohibited for `_03`.
- FIX-04 confirms `_02` LINE channel secret/token values were visible before the correction, but no `_02` LINE secret/token was set in Cloudflare or n8n and no value was written to repo files.
- FIX-04 cleared temporary in-memory `_02` LINE secret state.
- FIX-04 found no existing visible `_03` LINE Official Account/channel in LINE Official Account Manager.
- FIX-04 reached new LINE Official Account creation, but stopped before submission because the form requires agreement to service terms/privacy policy by 菲比.
- FIX-04 evidence file: `LINE_SCOPE_GUARD_FIX_04.md`.
- FIX-05 confirmed `_03` LINE channel `菲比智能客服 測試_03`, with no `_02` in the name.
- FIX-05 configured Cloudflare Worker secret names: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, and `N8N_SHARED_SECRET`.
- FIX-05 deployed Worker `pline-v3-test-line-gateway` at `https://pline-v3-test-line-gateway.phy4175.workers.dev`.
- FIX-05 configured LINE webhook URL to `/line/webhook` and LINE Developers Verify returned Success.
- FIX-05 updated n8n workflow `kcMcBQos5cxsnWU1` shared-secret verification location without writing the secret value to repo.
- FIX-06 parsed the current `_03` bootstrap event and configured `LINE_TEST_ADMIN_USER_IDS` as a Cloudflare Worker secret.
- FIX-06 replaced the bootstrap sentinel and deleted only the bootstrap KV key `admin:line_test_admin_user_id`.
- FIX-06 redeployed Worker successfully; latest version id `a49c1d70-4d68-46ff-b5fe-d537b0d0869f`.
- FIX-06 `/health` confirmed all required env fields are true.
- FIX-06 confirmed Wrangler tail/logs readability.
- FIX-06 evidence file: `CLOUDFLARE_TEST_EVIDENCE_FIX_06.md`.
- TEST-03 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-03 Gate 1 run 1 sent `記一下：[REDACTED_IDEA_CONTENT]`.
- TEST-03 Cloudflare tail observed one live `POST /line/webhook` request to Worker `pline-v3-test-line-gateway` on version `a49c1d70-4d68-46ff-b5fe-d537b0d0869f`.
- TEST-03 Gate 1 run 1 failed: Worker response status was `502` and no LINE reply appeared in the target chat during the observation window.
- TEST-03 stopped after Gate 1 run 1 failure; Gate 1 three consecutive success condition was not met and Gate 2 was not executed.
- TEST-03 no-secret evidence file: `TEST_EVIDENCE_TEST_03.md`.
- FIX-07 root cause: Worker was still configured to call n8n `webhook-test` URL for live LINE Gate traffic.
- FIX-07 updated Worker `N8N_WEBHOOK_URL` to production webhook `https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent`.
- FIX-07 published n8n workflow `kcMcBQos5cxsnWU1` with version name `FIX-07 production webhook`.
- FIX-07 added no-secret Worker stage logs for n8n failure, contract failure, LINE reply failure, and successful completion.
- FIX-07 hardened n8n response parsing for direct JSON, `{ json: ... }`, and single-item array shapes.
- FIX-07 deployed Worker version `19c6ece9-5d6f-4b62-a4fd-060c22c26f12`.
- FIX-07 `/health` confirms production n8n webhook URL and required env flags true.
- FIX-07 Wrangler tail/logs readability confirmed.
- FIX-07 no-secret evidence file: `FIX_EVIDENCE_FIX_07.md`.
- TEST-04 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-04 Gate 1 run 1 sent `記一下：[REDACTED_IDEA_CONTENT]`.
- TEST-04 Cloudflare tail observed one live `POST /line/webhook` request to Worker `pline-v3-test-line-gateway` on version `19c6ece9-5d6f-4b62-a4fd-060c22c26f12`.
- TEST-04 Gate 1 run 1 failed: Worker invocation outcome was `canceled`, no response status was available, and no LINE reply appeared in the target chat during the observation window.
- TEST-04 stopped after Gate 1 run 1 failure; Gate 1 three consecutive success condition was not met and Gate 2 was not executed.
- TEST-04 no-secret evidence file: `TEST_EVIDENCE_TEST_04.md`.
- FIX-08 root cause: live LINE webhook was synchronously waiting for the full n8n/AI contract path before sending a LINE reply, exposing the invocation to cancellation.
- FIX-08 changed the Worker reply mode to `fast_ack_then_background_n8n`.
- FIX-08 now sends a fast LINE ACK after signature/admin/idempotency pass, then runs n8n production webhook processing in `ctx.waitUntil(...)`.
- FIX-08 sends a background LINE Push API final message for `codex_task` after n8n contract validation.
- FIX-08 added no-secret stage logs for signature/admin/idempotency, fast LINE reply, and background n8n completion/failure.
- FIX-08 deployed Worker version `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`.
- FIX-08 `/health` confirms required env fields true, `line_reply_mode` is `fast_ack_then_background_n8n`, and `codex_task_final_mode` is `background_push_final`.
- FIX-08 confirmed secret names, KV bindings, deployments list, Wrangler tail readability, and n8n production webhook path availability without exposing secret values.
- FIX-08 no-secret evidence file: `FIX_EVIDENCE_FIX_08.md`.
- TEST-05 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-05 Gate 1 run 1 sent `記一下：[REDACTED_IDEA_CONTENT]`.
- TEST-05 Cloudflare tail observed one live `POST /line/webhook` request to Worker `pline-v3-test-line-gateway` on version `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`.
- TEST-05 Gate 1 run 1 passed Worker stages `line_event_received`, `signature_pass`, `admin_pass`, and `idempotency_pass`, then failed at `line_fast_reply_failed` with reason `line_reply_http_401`.
- TEST-05 no LINE reply appeared in the target chat, no `n8n_background_started` was observed, and Gate 1 three consecutive success condition was not met.
- TEST-05 Gate 2 was not executed.
- TEST-05 no-secret evidence file: `TEST_EVIDENCE_TEST_05.md`.
- FIX-09 root cause: Worker Reply API code path used the correct endpoint/header/body, so the 401 was consistent with an invalid, stale, or non-current `_03` `LINE_CHANNEL_ACCESS_TOKEN` Cloudflare secret.
- FIX-09 confirmed LINE Developers channel `菲比智能客服 測試_03`, channel id `2010748091`, and did not use the visible `_02` channel.
- FIX-09 validated the current `_03` Messaging API token with LINE API `/v2/bot/info` returning HTTP `200`, then updated Cloudflare Worker secret `LINE_CHANNEL_ACCESS_TOKEN` without recording the token value.
- FIX-09 added Worker token normalization for accidental whitespace or accidental `Bearer ` prefix in the secret value.
- FIX-09 deployed Worker version `97f20405-6ed9-4cfb-801d-218ae1f21c61`.
- FIX-09 `/health` confirms required env fields true, `line_reply_mode` is `fast_ack_then_background_n8n`, and `codex_task_final_mode` is `background_push_final`.
- FIX-09 no-secret evidence file: `FIX_EVIDENCE_FIX_09.md`.
- TEST-06 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-06 Gate 1 run 1 sent `記一下：[REDACTED_IDEA_CONTENT]`.
- TEST-06 Cloudflare tail observed one live `POST /line/webhook` request to Worker `pline-v3-test-line-gateway` on version `97f20405-6ed9-4cfb-801d-218ae1f21c61`.
- TEST-06 Gate 1 run 1 passed Worker stages `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, and `n8n_background_started`.
- TEST-06 LINE app displayed the fast ACK reply.
- TEST-06 background n8n contract failed at `n8n_background_contract_failed` with reason `request_id_mismatch`; Gate 1 three consecutive success condition was not met.
- TEST-06 Gate 2 was not executed.
- TEST-06 no-secret evidence file: `TEST_EVIDENCE_TEST_06.md`.
- FIX-10 root cause: n8n `Structured Output` trusted AI Agent `parsed.request_id` before falling back to `Normalize Input`, allowing an AI-generated or mismatched request id to override the Worker request id.
- FIX-10 updated n8n workflow `kcMcBQos5cxsnWU1` so production response always preserves `$('Normalize Input').first().json.request_id`.
- FIX-10 added deterministic Gate evidence fields for `idea_create` and `codex_task`.
- FIX-10 published n8n workflow version `FIX-10 request_id contract`; UI status returned to `Published`.
- FIX-10 updated Worker contract validation and no-secret `n8n_background_completed` logs for `tool_called`, record/action, and task id presence evidence.
- FIX-10 deployed Worker version `02b1fa59-4d4c-4119-8dc8-5699183d5456`.
- FIX-10 `/health` confirms required env fields true, production n8n URL, `line_reply_mode`, and `codex_task_final_mode`.
- FIX-10 no-secret evidence file: `FIX_EVIDENCE_FIX_10.md`.
- TEST-07 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-07 sent Gate 1 attempt `記一下：[REDACTED_IDEA_CONTENT]`; LINE app showed fast ACK, but the initial tail session did not emit the matching event during the observation window, so it cannot count as a fully evidenced pass.
- TEST-07 restarted tail and sent Gate 1 candidate `記一下：[REDACTED_IDEA_CONTENT]`.
- TEST-07 evidenced candidate passed Worker stages `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, and `n8n_background_started`.
- TEST-07 evidenced candidate failed background n8n contract at `n8n_background_contract_failed` with reason `request_id_mismatch`; Gate 1 three consecutive success condition was not met.
- TEST-07 Gate 2 was not executed.
- TEST-07 no-secret evidence file: `TEST_EVIDENCE_TEST_07.md`.
- FIX-11 inspected live n8n production execution `#551` for workflow `kcMcBQos5cxsnWU1`.
- FIX-11 found execution `#551` used version `FIX-10 request_id contract` and failed in sub-node `OpenAI Chat Model` before the deterministic `Structured Output` / `Respond to Webhook` contract could complete.
- FIX-11 root cause: AI Agent node `On Error` was still `Stop Workflow`, so an OpenAI sub-node failure could stop the production response path before the Worker request id was preserved.
- FIX-11 changed AI Agent `On Error` to `Continue` in workflow `kcMcBQos5cxsnWU1`.
- FIX-11 published n8n workflow version `FIX-11 continue on AI error`; UI status returned to `Published`.
- FIX-11 retried live execution `#551` with the currently saved workflow; retry execution `#552` succeeded.
- FIX-11 live retry evidence: `Structured Output` succeeded with 1 item, `Respond to Webhook` succeeded with 1 item, `request_id` was preserved as `pline-v3-...`, `intent=idea_create`, `status=completed`, `tool_called=idea_create`, `saved_record=1`, and `record=1`.
- FIX-11 did not change Worker code and did not deploy Worker; current Worker version remains `02b1fa59-4d4c-4119-8dc8-5699183d5456`.
- FIX-11 local validation passed: n8n JSON parse, workflow draft contract check, Worker syntax check, and Worker unit test.
- FIX-11 no-secret evidence file: `FIX_EVIDENCE_FIX_11.md`.
- TEST-08 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-08 Gate 1 run 1 sent `記一下：[REDACTED_IDEA_CONTENT]`.
- TEST-08 Gate 1 run 1 was fully evidenced in Cloudflare tail: Worker version `02b1fa59-4d4c-4119-8dc8-5699183d5456`, `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, `n8n_background_started`, and `n8n_background_completed`.
- TEST-08 Gate 1 run 1 background evidence: `intent=idea_create`, `status=completed`, `tool_called=idea_create`, `saved_record=1`.
- TEST-08 sent additional Gate 1 attempts `T0802-20260717203253`, `T0802B-20260717203418`, and `T0802C-20260717203602`; LINE app displayed fast ACK replies, but Cloudflare tail did not emit matching LINE/background events for these attempts and n8n had no saved executions available for per-run correlation.
- TEST-08 did not mark `N8N MINIMAL PATH PASS` because only one fully evidenced Gate 1 success was obtained, not three consecutive fully evidenced successes.
- TEST-08 Gate 2 was not executed.
- TEST-08 no-secret evidence file: `TEST_EVIDENCE_TEST_08.md`.
- FIX-12 root cause: TEST-08 proved functionality for one run, but tail/n8n execution correlation was not reliable enough to prove every Gate message.
- FIX-12 added no-secret Worker evidence persistence to existing `_03` `RUNTIME_KV` using prefix `evidence:v1`.
- FIX-12 persists per-request stage keys for received, signature/admin/idempotency pass/fail, fast ACK, background n8n started/completed/failed, contract evidence, and codex final push result.
- FIX-12 stores safe Gate marker T-codes and request ids, but does not store raw LINE User ID, token, channel secret, signature, shared secret, or full message text.
- FIX-12 added protected read endpoint `GET /test/evidence?marker=<T-code>` or `GET /test/evidence?request_id=<request_id>`, guarded by `x-pline-v3-shared-secret`.
- FIX-12 TEST fallback readback can use Wrangler KV: marker key `evidence:v1:marker:<T-code>` then stage prefix `evidence:v1:request:<request_id>:stage:`.
- FIX-12 deployed Worker version `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`.
- FIX-12 `/health` confirms the evidence block is present and required env fields are true.
- FIX-12 `/test/evidence` without shared-secret header returns HTTP `401`.
- FIX-12 local validation passed: Worker syntax, Worker unit test, n8n JSON parse, and Wrangler dry-run.
- FIX-12 no-secret evidence file: `FIX_EVIDENCE_FIX_12.md`.

## TEST-09 Live Gate Attempt

- TEST-09 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-09 confirmed Worker `/health` required env flags are true and the FIX-12 evidence block is present.
- TEST-09 confirmed the durable evidence readback fallback namespace `pline-v3-test-runtime` id `10cdfe018b3942b483faeaca6e517ae5`.
- TEST-09 sent one malformed pre-Gate probe marker `T0901-2026071801438302`; it did not match the Worker marker pattern and was not counted as Gate evidence.
- TEST-09 sent valid Gate 1 candidates `T0901-20260718045141` and `T0901A-20260718045215`.
- TEST-09 observed no visible LINE ACK for the valid candidates during the test window.
- TEST-09 live Wrangler tail emitted no Worker log for `T0901A-20260718045215` during the observation window.
- TEST-09 KV marker readback returned `Value not found` for `evidence:v1:marker:T0901-20260718045141` and `evidence:v1:marker:T0901A-20260718045215`.
- TEST-09 did not mark `N8N MINIMAL PATH PASS` because no durable KV evidence or tail evidence proved LINE event=1 / Worker invocation=1 for the valid candidates.
- TEST-09 Gate 2 was not executed because Gate 1 did not reach three consecutive evidenced successes.
- TEST-09 no-secret evidence file: `TEST_EVIDENCE_TEST_09.md`.
- FIX-13 inspected only LINE channel `菲比智能客服 測試_03`, channel id `2010748091`, bot basic id `@967fvhek`; no `_02` channel/resource was used.
- FIX-13 confirmed LINE Developers webhook URL was already `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`.
- FIX-13 confirmed `Use webhook` was enabled and LINE official webhook endpoint API returned active=true for the expected URL.
- FIX-13 confirmed Worker route `/line/webhook` is reachable: synthetic invalid-signature POST returned HTTP `401`.
- FIX-13 LINE Developers Verify returned `Success`; Cloudflare tail observed a LINE official POST to `/line/webhook` with Worker response HTTP `200` on version `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`.
- FIX-13 found `Webhook redelivery` and `Error statistics aggregation` were disabled before repair.
- FIX-13 enabled `Webhook redelivery` and `Error statistics aggregation` for the `_03` LINE Developers channel.
- FIX-13 did not change Worker code, did not deploy Worker, and did not change any secret/token value.
- FIX-13 validation passed: Worker syntax, Worker unit test, `/health`, and invalid-signature route check.
- FIX-13 no-secret evidence file: `FIX_EVIDENCE_FIX_13.md`.

## TEST-10 Live Gate Attempt

- TEST-10 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-10 confirmed Worker `/health` required env flags are true and the FIX-12 evidence block is present.
- TEST-10 confirmed FIX-13 LINE delivery readiness evidence: `Use webhook` enabled, redelivery enabled, error statistics aggregation enabled, endpoint active=true, and LINE Developers Verify Success.
- TEST-10 sent Gate 1 run 1 candidate `T1001-20260718050632`.
- TEST-10 observed no visible LINE ACK for `T1001-20260718050632` during the test window.
- TEST-10 KV marker readback returned `Value not found` immediately after send, after an additional wait, and after a final redelivery/background wait.
- TEST-10 did not mark `N8N MINIMAL PATH PASS` because Gate 1 run 1 did not produce durable `evidence:v1` marker evidence, so the required three consecutive evidenced successes cannot be met.
- TEST-10 Gate 2 was not executed because Gate 1 run 1 failed.
- TEST-10 no-secret evidence file: `TEST_EVIDENCE_TEST_10.md`.
- FIX-14 inspected `_03` LINE Developers Webhook errors and found `request_timeout` at `2026/07/18 06:06:36` for `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`.
- FIX-14 root cause: FIX-12 durable evidence persistence awaited multiple `RUNTIME_KV` writes in the LINE webhook foreground path before the fast ACK / webhook response completed, allowing LINE delivery to time out if KV writes were slow.
- FIX-14 changed foreground LINE webhook evidence writes to `queueEvidenceStage(...)`, using `ctx.waitUntil(...)` so evidence writes no longer block the LINE webhook response.
- FIX-14 kept background n8n evidence durable inside the background task.
- FIX-14 added unit coverage proving webhook response HTTP `200` still returns even when `RUNTIME_KV.put(...)` never resolves.
- FIX-14 deployed Worker version `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`.
- FIX-14 LINE Developers Verify after deploy returned `Success`; Cloudflare tail observed LINE official POST to `/line/webhook` on version `8f460265-2d79-4ee4-bd3b-2a69cfb17d09` with response HTTP `200`.
- FIX-14 did not change LINE secrets, raw User IDs, n8n workflow, or `_03` LINE channel identity.
- FIX-14 no-secret evidence file: `FIX_EVIDENCE_FIX_14.md`.

## TEST-11 Live Gate Attempt

- TEST-11 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-11 confirmed Worker `/health` required env flags are true and the FIX-12 evidence block is present.
- TEST-11 confirmed FIX-14 Worker version `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`.
- TEST-11 sent Gate 1 run 1 candidate `T1101-20260718051847`.
- TEST-11 Cloudflare tail observed official LINE webhook delivery to Worker version `8f460265-2d79-4ee4-bd3b-2a69cfb17d09` with HTTP `200`.
- TEST-11 sanitized tail stages for run 1: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, `n8n_background_started`, and `n8n_background_completed`.
- TEST-11 sanitized n8n evidence for run 1: `intent=idea_create`, `status=completed`, `tool_called=idea_create`, and `saved_record=1`.
- TEST-11 durable KV marker readback for `evidence:v1:marker:T1101-20260718051847` returned `Value not found`.
- TEST-11 durable KV request stage prefix for the tail-observed request id returned no stage keys.
- TEST-11 did not mark `N8N MINIMAL PATH PASS` because the required durable `evidence:v1` marker/request_id evidence was missing, so Gate 1 three-consecutive PASS cannot be proven under TEST-11 evidence rules.
- TEST-11 Gate 2 was not executed because Gate 1 run 1 could not be marked PASS.
- TEST-11 no-secret evidence file: `TEST_EVIDENCE_TEST_11.md`.
- FIX-15 root cause: evidence persistence wrote stage/summary before the marker index, so a slow or failed KV write before the marker could leave TEST without the primary `evidence:v1:marker:<T-code>` lookup even when the runtime path completed.
- FIX-15 changed `persistEvidenceStage(...)` to write the safe Gate marker index first, then summary, then deterministic stage key.
- FIX-15 changed request stage keys to deterministic form `evidence:v1:request:<request_id>:stage:<stage>` for stable readback.
- FIX-15 kept foreground evidence persistence in `ctx.waitUntil(...)`, so slow KV writes do not block the LINE webhook fast ACK/HTTP response.
- FIX-15 fixed no-secret failure logging so `evidence_persist_failed` is visible and the original failed stage is recorded as `failed_stage`.
- FIX-15 added unit coverage for marker/stage readback after a full webhook path and for failed/slow KV persistence behavior.
- FIX-15 deployed Worker version `5a41bd15-789f-43ce-9bd0-2365d9dcef21`.
- FIX-15 validation passed: Worker syntax, Worker unit test, n8n JSON parse, Wrangler dry-run, deploy, `/health`, and invalid-signature route check.
- FIX-15 no-secret evidence file: `FIX_EVIDENCE_FIX_15.md`.

## TEST-12 Live Gate Attempt

- TEST-12 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-12 confirmed Worker `/health` required env flags are true and the FIX-12/FIX-15 evidence read path is present.
- TEST-12 confirmed FIX-15 Worker version `5a41bd15-789f-43ce-9bd0-2365d9dcef21` and marker-first/deterministic stage-key source/config evidence in `_03`.
- TEST-12 sent Gate 1 run 1 candidate `T1201-20260718053133`.
- TEST-12 observed a visible LINE fast ACK for `T1201-20260718053133` in the target chat.
- TEST-12 KV marker readback for `evidence:v1:marker:T1201-20260718053133` returned `Value not found` across repeated readbacks.
- TEST-12 KV marker prefix `evidence:v1:marker:T1201` returned empty.
- TEST-12 KV request stage prefix `evidence:v1:request:` returned no matching stage records.
- TEST-12 did not mark `N8N MINIMAL PATH PASS` because the required durable `evidence:v1` marker/stage evidence was missing, so Gate 1 three-consecutive PASS cannot be proven under TEST-12 evidence rules.
- TEST-12 Gate 2 was not executed because Gate 1 run 1 could not be marked PASS.
- TEST-12 no-secret evidence file: `TEST_EVIDENCE_TEST_12.md`.
- FIX-16 found the deployed Worker binding is correct: `RUNTIME_KV` points to `_03` namespace id `10cdfe018b3942b483faeaca6e517ae5`.
- FIX-16 found TEST-12 `Value not found` evidence matched Wrangler local KV behavior when `--remote` is omitted.
- FIX-16 remote KV readback proved TEST-12 marker `T1201-20260718053133` exists and maps to its request id.
- FIX-16 protected HTTP readback for `T1201-20260718053133` returned full durable evidence: line event, signature/admin/idempotency, fast ACK, n8n started/completed, `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, and `codex_task=0`.
- FIX-16 added protected TEST selfcheck endpoint `/test/evidence/selfcheck` and optional secret name `EVIDENCE_SELFTEST_SECRET`.
- FIX-16 added health evidence flags for runtime/idempotency binding presence and selfcheck secret presence.
- FIX-16 added a bounded fast ACK evidence checkpoint so marker and foreground stages are attempted durably after fast ACK without reintroducing indefinite webhook blocking.
- FIX-16 deployed Worker version `8a23d5c0-e014-4cbd-b594-9f7814eeb6c1`.
- FIX-16 validation passed: Worker syntax, Worker unit test, n8n JSON parse, Wrangler dry-run, deploy, `/health`, invalid-signature route, live selfcheck, remote KV marker/stage readback, and protected HTTP evidence readback.
- FIX-16 no-secret evidence file: `FIX_EVIDENCE_FIX_16.md`.

## TEST-13 Live Gate Attempt

- TEST-13 used Computer Use to control the logged-in LINE app and confirmed the target chat window was `菲比智能客服 測試_03`.
- TEST-13 confirmed Worker `/health` required env flags are true and runtime/idempotency KV bindings are reported as bound.
- TEST-13 confirmed FIX-16 Worker version `8a23d5c0-e014-4cbd-b594-9f7814eeb6c1`.
- TEST-13 confirmed Wrangler remote KV readback with `--remote` can read prior TEST-12 marker `T1201-20260718053133`.
- TEST-13 Gate 1 run 1 `T1301-20260718054524` passed with remote marker/stage evidence and `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, `codex_task=0`.
- TEST-13 Gate 1 run 2 `T1302-20260718054632` passed with remote marker/stage evidence and `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, `codex_task=0`.
- TEST-13 Gate 1 run 3 `T1303-20260718054707` passed with remote marker/stage evidence and `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, `codex_task=0`.
- TEST-13 marked `N8N MINIMAL PATH PASS`.
- TEST-13 Gate 2 message `T1304-20260718054759` produced remote Worker/n8n/LINE final evidence: `intent=codex_task`, `tool_called=codex_task`, `codex_task=1`, `action=create_smoke_file`, `task_id_present=true`, and `line_push_final_completed`.
- TEST-13 did not mark `CODEX MINIMAL PATH PASS` because `monitor claim=1`, `Codex execution=1`, and live smoke-file creation were not proven.
- TEST-13 found `codex-smoke.txt` already existed before Gate 2 with content `Codex 已打通` and unchanged mtime `2026-07-18 03:39:02`, so it was not counted as live Gate 2 creation evidence.
- TEST-13 no-secret evidence file: `TEST_EVIDENCE_TEST_13.md`.
- FIX-17 root cause: Worker/n8n produced `task_id` and final LINE push, but no `_03` pending task record existed for the local monitor to claim and execute.
- FIX-17 added Worker pending task enqueue under remote KV prefix `codex_task:v1:task:<task_id>` for valid `codex_task`.
- FIX-17 added `codex_task_enqueued` evidence.
- FIX-17 updated monitor to support `claim-once`, `poll`, and `selftest` against `_03` remote KV with `--remote`.
- FIX-17 monitor claim writes evidence stages `monitor_claimed`, `codex_execution_completed`, and `smoke_file_written`.
- FIX-17 live monitor selftest completed: smoke file was overwritten, mtime updated, content remained exactly `Codex 已打通`, and remote evidence stages were written.
- FIX-17 deployed Worker version `8fedf73f-c983-43af-832b-96e9f0e957c9`.
- FIX-17 validation passed: Worker syntax/test, monitor syntax/test, Wrangler dry-run/deploy, monitor health, Worker health, invalid-signature route, remote task record readback, and remote monitor evidence readback.
- FIX-17 no-secret evidence file: `FIX_EVIDENCE_FIX_17.md`.

## TEST-14 Live Gate Attempt

- TEST-14 retried Gate 2 only because TEST-13 already marked `N8N MINIMAL PATH PASS`.
- TEST-14 confirmed cwd `/Users/phoebe/Documents/菲比 LINE 智能助理_03`.
- TEST-14 confirmed monitor health `ready`.
- TEST-14 recorded Gate 2 precheck smoke file mtime `2026-07-18 05:58:36`, epoch `1784325516`, content `Codex 已打通`.
- TEST-14 started `_03` monitor poll before sending Gate 2: `MONITOR_POLL_ITERATIONS=45 MONITOR_POLL_INTERVAL_MS=1000 node monitor/src/monitor.js poll`.
- TEST-14 sent Gate 2 message `請 Codex 在 _03 專案建立測試檔案 T1401-20260718060326` to LINE app chat `菲比智能客服 測試_03`.
- TEST-14 remote marker readback returned request id `pline-v3-01KXS1P8AC33W8BRSHDKA5WG7C`.
- TEST-14 remote evidence stages included `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_fast_reply_completed`, `n8n_background_started`, `n8n_background_completed`, `codex_task_enqueued`, `monitor_claimed`, `codex_execution_completed`, `smoke_file_written`, and `line_push_final_completed`.
- TEST-14 n8n evidence showed `intent=codex_task`, `tool_called=codex_task`, `codex_task=1`, `action=create_smoke_file`, and `task_id_present=true`.
- TEST-14 monitor poll claimed task `pline-v3-codex-1784325815041`, executed Codex, and wrote the smoke file.
- TEST-14 remote task record status is `completed` with `codex_execution=true` and `file_written=true`.
- TEST-14 smoke file postcheck mtime updated to `2026-07-18 06:03:46`, epoch `1784325826`, content `Codex 已打通`.
- TEST-14 marked `CODEX MINIMAL PATH PASS`.
- TEST-14 marked `_03 MINIMAL DUAL-PATH PASS`.
- TEST-14 no-secret evidence file: `TEST_EVIDENCE_TEST_14.md`.

## Next Stage

Hand off to `PLine03｜RELEASE｜部署與收尾` because TEST Gate 1 and Gate 2 both passed in `_03` TEST.

## Dropbox Idea JSON Gate Attempt

- TEST ran the Dropbox idea JSON Gate inside `_03` clean-room scope plus fixed Dropbox directory `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`.
- Worker/monitor readiness confirmed `save_idea_json`, fixed Dropbox directory, remote `_03` KV, and monitor health `ready`.
- A pre-Gate marker-like message `TIDEA1-20260718080351` did not match the Worker T-code marker pattern and was not counted.
- Formal Gate attempts used `T1801-20260718080448`, `T1802-20260718080635`, and `T1803-20260718080827`.
- Each formal attempt wrote one Dropbox JSON file and produced remote evidence through `idea_json_file_written`.
- JSON files parsed successfully, used only the 9 allowed schema fields, and stored irreversible fingerprints rather than raw LINE User ID or raw event id.
- Duplicate reprocess for existing idea JSON returned `status=duplicate`; Dropbox JSON count stayed `8 -> 8`.
- Formal success LINE final evidence `idea_json_final_push_completed` was missing for the live attempts.
- `DROPBOX IDEA JSON PATH PASS` is not marked.
- No-secret evidence file: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## Next Stage

Hand off to `PLine03｜FIX｜Worker 與程式` to ensure Worker sends and persists the formal LINE success reply exactly once after `save_idea_json` returns `completed` or `duplicate`.

## Dropbox Idea JSON Gate Rerun After Final Reply Fix

- TEST reran the live Dropbox idea JSON Gate after Worker version `3ba57849-b02c-4b6e-a066-8da95575563c`.
- Scope stayed inside `/Users/phoebe/Documents/菲比 LINE 智能助理_03` plus fixed Dropbox directory `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`.
- LINE app target was `菲比智能客服 測試_03`.
- Continuous markers: `T1901-20260718082215`, `T1902-20260718082305`, `T1903-20260718082309`.
- Dropbox JSON files written:
  - `idea-20260718-082302-d255b4b825ef.json`
  - `idea-20260718-082310-f4ec851098fd.json`
  - `idea-20260718-082314-c72fb7e8e6e2.json`
- JSON parse/schema/content/fingerprint checks passed for the three Gate files.
- Duplicate deterministic reprocess marker `T2099-20260718082930` returned `duplicate`; Dropbox JSON count stayed `13 -> 13`.
- Serial control marker `T2001-20260718082810` also wrote JSON successfully but did not produce formal final evidence.
- Missing evidence remains `idea_json_final_push_completed`; `DROPBOX IDEA JSON PATH PASS` is not marked.
- Current result: `DROPBOX IDEA JSON PATH PARTIAL`.
- No-secret evidence file: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## Next Stage

Hand off to `PLine03｜FIX｜Worker 與程式` to repair formal LINE success final emission/evidence after `save_idea_json` completion evidence.

## Dropbox Idea JSON Gate Rerun After Durable Exactly-Once Finalizer

- TEST reran the live Dropbox idea JSON Gate after Worker version `cbadc5a1-4e07-44b2-853d-335c5486b11b`.
- Scope stayed inside `/Users/phoebe/Documents/菲比 LINE 智能助理_03` plus fixed Dropbox directory `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`.
- LINE app target was `菲比智能客服 測試_03`.
- Continuous markers: `T2201-20260718084633`, `T2202-20260718084802`, `T2203-20260718084935`.
- Dropbox JSON files written:
  - `idea-20260718-084641-1847198916c4.json`
  - `idea-20260718-084810-24eb8fc7c5c5.json`
  - `idea-20260718-084944-8a308a7a67f5.json`
- Each marker had durable evidence for LINE event, Worker invocation, `signature_pass`, `admin_pass`, `idempotency_pass`, n8n background completed, `idea_create`, `save_idea_json`, monitor claim, Dropbox JSON write, and `idea_json_final_push_completed`.
- JSON parse/schema/content/fingerprint checks passed for all three Gate files.
- Repeated finalizer callback for marker `T2203-20260718084935` returned `already_completed`, `pushed=false`; Dropbox JSON count stayed `20 -> 20`, and the final push completed stage remained single-key exactly-once evidence.
- `DROPBOX IDEA JSON PATH PASS` is marked.
- No-secret evidence file: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## Next Stage

Hand off to `PLine03｜RELEASE｜部署與收尾` for git status, secret scan, commit, and push to `v1/minimal-dual-path`.

## idea_create Natural Final Without Visible ACK

- FIX removed the LINE-visible fixed processing ACK from the normal `idea_create` path.
- Worker still returns HTTP `200` to the LINE webhook and records no-secret evidence `line_visible_ack_skipped` plus `webhook_http_200_returned`.
- idea final remains durable exactly-once through monitor callback `/test/idea-finalize`.
- After Dropbox JSON save succeeds, Worker uses n8n natural `reply_text`; if missing/invalid/internal, Worker uses fallback `已經幫妳記下來了 💡`.
- If save fails, Worker sends only the truthful failure message and does not send success text.
- Duplicate/repeated finalizer callback remains suppressed and does not create a new JSON or second LINE final.
- Worker deployed version: `dbda345b-a3b4-41ca-bc8b-a12c8547179c`.
- No-secret evidence file: `FIX_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.

## Next Stage

Hand off to `PLine03｜TEST｜測試與驗收` to rerun `IDEA NATURAL FINAL REPLY WITHOUT ACK` Gate: idea_create should show no first ACK and exactly one natural final after Dropbox JSON save.

## Codex Task Minimal Closed Loop FIX

- FIX implemented the minimal codex_task closed loop without changing the accepted idea_create / Dropbox path.
- Worker now creates a structured `codex_task` record with `status=queued`, project metadata, fixed safe runtime path, task-scoped finalize token, and encrypted LINE user reference.
- Worker sends only a natural processing notice after enqueue succeeds; completion final is deferred until monitor execution completes.
- Monitor now claims queued codex tasks, writes `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt`, verifies exact content `Codex 任務測試成功`, writes a completed result record, and calls Worker `/test/codex-finalize`.
- Worker codex finalizer validates task id/request id/finalize token and sends completed or failed LINE final exactly once.
- Worker deployed version: `3f0f167c-71b1-4e89-aa1c-6f559507ed46`.
- No-secret selftest marker `T2300-20260718093000` completed with remote result `status=completed`, `tests=PASS`, `commit=null`, `error=null`.
- No-secret evidence file: `FIX_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

## Next Stage

Hand off to `PLine03｜TEST｜測試與驗收` to run the live `Codex Task 最小工作閉環 Gate`, including final LINE push evidence and duplicate/replay checks.

## Codex Task created_at Schema FIX

- TEST proved the Codex task closed-loop function worked, but failed the Gate because completed task record did not retain hard schema field `created_at`.
- Root cause: monitor `normalizeTask()` dropped `created_at` before rewriting claimed/completed/failed task records.
- FIX preserves `created_at` through queued, claimed, completed, and failed task lifecycle.
- Codex result records now include `created_at` for completed and failed results.
- Smoke file behavior, LINE visible messages, finalizer exactly-once, idea_create, and Dropbox paths were not changed.
- Worker was redeployed after the monitor fix; current version `ca9001fa-cf03-43f7-9911-33f6301dd668`.
- No-secret selftest `T2400-20260718113900` confirmed remote completed task record and result record both include `created_at`.
- No-secret evidence file: `FIX_EVIDENCE_CODEX_TASK_CREATED_AT_SCHEMA.md`.

## Next Stage

Hand off to `PLine03｜TEST｜測試與驗收` to rerun the live Codex Task Gate and confirm `created_at` is present in completed task/result records.

## IDEA NATURAL FINAL REPLY WITHOUT ACK Gate

- TEST reran the Gate after Worker version `dbda345b-a3b4-41ca-bc8b-a12c8547179c`.
- Scope stayed inside `/Users/phoebe/Documents/菲比 LINE 智能助理_03` plus fixed Dropbox directory `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`.
- LINE app target was `菲比智能客服 測試_03`.
- Live idea markers: `T2301-20260718092056`, `T2302-20260718092156`, `T2303-20260718092325`.
- Dropbox JSON files written:
  - `idea-20260718-092105-016e468ba6d0.json`
  - `idea-20260718-092204-b7107d1c1dc3.json`
  - `idea-20260718-092333-3cd6f7b5427f.json`
- Each run had durable `line_visible_ack_skipped`, `webhook_http_200_returned`, n8n background completed, Dropbox JSON write, and final push completion evidence.
- Third run had a transient `line_push_http_525`; task-scoped finalizer retry completed successfully without duplicate JSON or duplicate final.
- Repeated finalizer callback returned `already_completed`, `pushed=false`; Dropbox JSON count stayed `29 -> 29`; n8n completion stage count stayed `1`.
- Failure and AI fallback paths were covered by safe local Worker mocks.
- Codex regression marker `T2390-20260718092857` routed to `codex_task`, wrote smoke file, and did not create Dropbox idea JSON.
- LINE desktop read-receipt display was not stable and is recorded only as UI/OA setting observation, not Gate evidence.
- Two-stage secret scan effective hit_count: `0`.
- `IDEA NATURAL FINAL REPLY WITHOUT ACK PASS` is marked.
- Evidence: `TEST_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.

## Next Stage

Hand off to `PLine03｜RELEASE｜部署與收尾` for git status, secret scan, commit, and push to `v1/minimal-dual-path`. Optional separate follow-up can inspect `_03` LINE Developers / LINE OA Manager read-receipt settings with Computer Use.

## Codex Task Minimal Closed Loop Gate

- TEST ran live Codex Task Gate after Worker version `3f0f167c-71b1-4e89-aa1c-6f559507ed46`.
- LINE marker: `T2401-20260718113100`.
- Task ID: `pline-v3-codex-1784345467797`.
- Monitor created runtime smoke file at `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt`.
- Smoke file content verified: `Codex 任務測試成功`.
- Result record had `status=completed`, `tests=PASS`, `commit=null`, `error=null`.
- LINE natural processing and final messages were observed without forbidden internal terms.
- Repeated finalizer callback returned `already_completed`, `pushed=false`, and did not rerun execution or push a duplicate final.
- Worker/monitor tests passed; idea_create and Dropbox regressions passed; effective secret scan hit_count was `0`.
- Gate failed because the completed task record did not retain required field `created_at`.
- Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

## Next Stage

Hand off to `PLine03｜FIX｜Worker 與程式` to preserve `created_at` in completed Codex task records, then rerun TEST.

## Codex Task Minimal Closed Loop Gate Rerun After created_at Fix

- TEST reran live Codex Task Gate after Worker version `ca9001fa-cf03-43f7-9911-33f6301dd668`.
- LINE marker: `T2501-20260718114510`.
- Task ID: `pline-v3-codex-1784346318391`.
- Monitor created runtime smoke file at `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt`.
- Smoke file content verified: `Codex 任務測試成功`.
- Completed task record includes `task_id`, `task_type`, `project`, `project_path`, `instruction`, `status`, and `created_at`.
- Result record used the same task ID and includes `created_at`, `status=completed`, `tests=PASS`, `commit=null`, and `error=null`.
- LINE natural processing and final messages were observed without forbidden internal terms.
- Repeated finalizer callback returned `already_completed`, `pushed=false`, and did not rerun execution or push a duplicate final.
- Worker/monitor tests passed; idea_create and Dropbox regressions passed; effective secret scan hit_count was `0`.
- Gate result: `PASS`.
- Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

## Next Stage

Hand off to `PLine03｜RELEASE｜部署與收尾` for git status, secret scan, commit, and push to `v1/minimal-dual-path`.

## Codex Task created_at Schema FIX Completed

- FIX completed the only TEST blocker from `T2401-20260718113100`.
- Monitor now preserves `created_at` across queued, claimed, completed, and failed codex_task records.
- Completed and failed result records also include `created_at`.
- Remote no-secret selftest `T2400-20260718113900` confirmed completed task and result records include `created_at`.
- Worker redeployed for handoff; current version `ca9001fa-cf03-43f7-9911-33f6301dd668`; dry-run and readiness rechecked.
- Evidence: `FIX_EVIDENCE_CODEX_TASK_CREATED_AT_SCHEMA.md`.

## Next Stage

Hand off to `PLine03｜TEST｜測試與驗收` to rerun Codex Task Gate and confirm `created_at` present.

## Codex Task AI Replies Phase-1 Trace

- FIX traced codex_task reply generation without changing runtime behavior.
- Processing LINE reply source is Worker constant `CODEX_PROCESSING_REPLY_TEXT`.
- Completed LINE reply source is Worker constant `CODEX_COMPLETED_REPLY_TEXT`.
- Failed LINE reply source is Worker constant `CODEX_FAILED_REPLY_TEXT`.
- n8n AI Agent receives codex_task for classification/tool selection and can output `reply_text`, but Worker currently ignores that `reply_text` for processing.
- Monitor completion/failure callback has actual result state. Follow-up N8N work now added the phase-aware n8n AI reply contract in workflow `kcMcBQos5cxsnWU1`.
- Current durable evidence/task record has no `reply_source=ai_generated|fallback`, so AI-vs-fallback cannot be audited live.
- Worker/monitor-only local template changes would not satisfy the "truly AI-generated" Gate.
- Verification of existing code: Worker tests PASS, monitor tests PASS, Wrangler dry-run PASS, `/health` reachable, invalid-signature `/line/webhook` HTTP `401`.
- Evidence: `FIX_EVIDENCE_CODEX_TASK_AI_REPLIES.md`.

## Next Stage

Hand off to `PLine03｜FIX｜Worker 與程式` to wire phase-mode calls to the new n8n AI reply contract and record `reply_source` / `ai_reply_source` evidence.

## Live Pending Monitor / Capability Boundary FIX

- FIX repaired the live regression where monitor work could stay pending and a capability not enabled in this Gate could stay processing.
- Worker now checks codex_task requests before enqueue. Only the current fixed smoke capability proceeds to `create_smoke_file`.
- Requests that need a not-yet-enabled capability, such as browser/Computer Use operations, are closed with reason `capability_not_yet_enabled`; this is a current Gate boundary, not a permanent feature rejection.
- Monitor now has bounded `drain`, targeted `claim-task`, and targeted `mark-capability-not-enabled` recovery commands.
- Live idea request `pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R` now has monitor claim, Dropbox write, finalizer callback, and `idea_json_final_push_completed` evidence.
- Live codex request `pline-v3-01KXSP35BTPS6GH5VM25JF9BJV` is now `failed` with result `error=capability_not_yet_enabled`, `changed_files=[]`, and no arbitrary Computer Use/browser execution.
- Worker version: `493e4b8a-91da-479e-81e0-229fd1eb72c7`.
- Evidence: `FIX_EVIDENCE_LIVE_REGRESSION_PENDING_CAPABILITY.md`.

## Next Stage

Hand off to `PLine03｜TEST｜測試與驗收` to recheck the recovered live items and run regressions.

## Worker N8N URL Attribution FIX

- FIX confirmed live Worker `N8N_WEBHOOK_URL` points to production n8n path `/webhook/pline-v3-test-ai-agent`.
- `/health` now exposes no-secret n8n target attribution: host, path, route type, workflow hint, and path fingerprint.
- Durable n8n started/contract-failed evidence now records no-secret target attribution and response-shape flags.
- Worker accepts `worker_request_id` and `canonicalRequestId` as canonical request id fields and unwraps common n8n response wrappers.
- Live marker `T2606-20260718134903` still failed with `request_id_mismatch`; contract-failed evidence shows n8n production returned an empty object with no request id fields.
- Current Worker version: `d50b4501-2244-4a31-9951-f7289ca06f09`.
- Evidence: `FIX_EVIDENCE_WORKER_N8N_URL_ATTRIBUTION.md`.

## Next Stage

Hand off to `PLine03｜N8N｜n8n workflow` to repair production Respond-to-Webhook output and execution attribution.

## Computer Use open_browser_page Gate Feasibility

- FIX checked whether `_03` monitor can directly execute Codex Computer Use for capability `open_browser_page`.
- Result: blocked. The monitor is a normal Node.js process and cannot directly call Codex MCP tools, `node_repl`, or Computer Use skill.
- No fake implementation was added. Shell `open`, arbitrary command, and AppleScript browser automation were not used as a substitute.
- Current Worker/monitor actions remain `create_smoke_file` and `save_idea_json`.
- Blocked reason: `monitor_unable_to_call_codex_computer_use_tools`.
- Evidence: `FIX_EVIDENCE_COMPUTER_USE_OPEN_BROWSER_PAGE.md`.

## Next Stage

Decide a bridge before rerunning this Gate: trusted local Codex Computer Use executor, controller-thread claim/finalize protocol, or a purpose-built fixed `open_browser_page` tool exposed to the monitor.

## Live Regression Recovery TEST

- TEST rechecked Worker version `493e4b8a-91da-479e-81e0-229fd1eb72c7`.
- Scope stayed in `_03` TEST resources and the fixed `_03` Dropbox directory; no Git action was performed.
- `1153` request `pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R` is recovered:
  - `monitor_claimed`, `idea_json_file_written`, `idea_json_final_push_completed`, and `idea_json_final_callback_completed` are present.
  - Task `idea-8748409c3efdcc4f5363d2eb` is `completed`.
  - Dropbox JSON `idea-20260718-115346-8748409c3efd.json` exists, parses, has exactly the 9 allowed schema fields, redacted idea content, and contains no raw LINE User ID pattern.
- Open-webpage request `pline-v3-01KXSP35BTPS6GH5VM25JF9BJV` is recovered:
  - Task `pline-v3-codex-1784347208503` is `failed` with `capability_not_yet_enabled`.
  - Result changed files count is `0`.
  - Final state is `failure_notice_completed`.
  - No `codex_execution_completed`, no `smoke_file_written`, and no arbitrary Computer Use/browser action evidence exists for this request.
- Minimal regression passed: `node worker/test/worker.test.mjs` and `node monitor/test/monitor.test.mjs`.
- LINE desktop `已讀` remains an independent UI/OA setting observation, not a backend blocker.
- Supplemental 12:53 idea case `pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF` reached Worker and passed signature/admin/idempotency/webhook HTTP `200`, but failed at `n8n_background_contract_failed` with reason `request_id_mismatch`.
- The 12:53 case did not create `save_idea_json`, did not create a monitor-claimable idea task, did not write Dropbox JSON for the reported water reminder, and did not send final push evidence.
- This is not the same root cause as the original `1153` monitor-pending case; bounded drain/targeted monitor recovery cannot recover a request that fails before enqueue.
- Result: `LIVE REGRESSION RECOVERY PARTIAL`.
- Evidence: `TEST_EVIDENCE_LIVE_REGRESSION_RECOVERY.md`.
- Next step: hand off to N8N/FIX to repair the live `request_id_mismatch` recurrence for idea_create, then proceed to the next Gate, `Computer Use 最小開通：只允許 open_browser_page`.

## N8N request_id Recurrence Repair Live Verification

- Date: 2026-07-18
- TEST sent live marker `T2601-20260718131959` to LINE target `菲比智能客服 測試_03`.
- Request id: `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86`.
- Worker received the event and recorded `signature_pass`, `admin_pass`, `idempotency_pass`, `line_visible_ack_skipped`, `webhook_http_200_returned`, and `n8n_background_started`.
- Live verification failed at `n8n_background_contract_failed` with reason `request_id_mismatch`.
- No `n8n_background_completed`, no `idea_json_save_enqueued`, no monitor claim, no Dropbox JSON, and no final push evidence were created for T2601.
- LINE desktop did not show a new final reply after the live message.
- This matches the 12:53 request shape and is not a monitor/poller availability failure; it occurs before a monitor-claimable task exists.
- Minimal local regression still passed: `node worker/test/worker.test.mjs` and `node monitor/test/monitor.test.mjs`.
- Result: `N8N REQUEST_ID RECURRENCE REPAIR LIVE VERIFY FAILED`.
- Evidence: `TEST_EVIDENCE_N8N_REQUEST_ID_RECURRENCE_REPAIR.md`.
- Next step: hand off to N8N/FIX to inspect the live production workflow execution for `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86` and repair the live response contract.

## N8N Respond Nonempty Live idea_create Verification

- Date: 2026-07-18
- N8N published version under TEST: `N8N normalize env and respond nonempty repair`.
- TEST sent live marker `T2701-20260718140429` to LINE target `菲比智能客服 測試_03`.
- Request id: `pline-v3-01KXSX7E4SRVM7CVZ3ST40GA6X`.
- Worker recorded `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_visible_ack_skipped`, `webhook_http_200_returned`, and `n8n_background_started`.
- n8n completed without `request_id_mismatch`; durable evidence has `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`.
- `save_idea_json` was enqueued and monitor claimed the task.
- Dropbox JSON `idea-20260718-140449-c49d33a39125.json` exists, parses, has exactly the 9 allowed schema fields, matches the water-reminder idea, and contains no raw LINE User ID pattern.
- Final evidence has `idea_json_final_push_completed` and `idea_json_final_callback_completed`.
- LINE desktop accessibility changed after the message but did not expose readable bot final text; durable final push evidence is primary.
- Minimal regression passed: `node worker/test/worker.test.mjs` and `node monitor/test/monitor.test.mjs`.
- Result: `N8N RESPOND NONEMPTY LIVE IDEA_CREATE PASS`.
- Evidence: `TEST_EVIDENCE_N8N_RESPOND_NONEMPTY_LIVE_IDEA.md`.
- Next step: hand off to FIX/N8N for n8n-side shared-secret hardening before the Computer Use minimal Gate proceeds.

## n8n Shared-Secret Hardening TEST

- Date: 2026-07-18
- n8n published version under TEST: `N8N shared-secret header hardening`.
- Direct no-header probe to the production n8n webhook returned HTTP `200` with an empty/non-JSON body and no normal `intent=idea_create` / `tool_called=idea_create` / `saved_record` contract.
- Direct no-header barrier result: PASS.
- TEST sent live marker `T2801-20260718141551` to LINE target `菲比智能客服 測試_03`.
- Request id: `pline-v3-01KXSXWXAE94G82MCZEYQABCJ7`.
- Worker/header path recorded `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `line_visible_ack_skipped`, `webhook_http_200_returned`, and `n8n_background_completed`.
- n8n completed without `request_id_mismatch`; durable evidence has `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`.
- `save_idea_json` was enqueued and monitor claimed/completed the task.
- Dropbox JSON `idea-20260718-141633-a223c8a90177.json` exists, parses, has exactly the 9 allowed schema fields, matches the hardening verification idea, and contains no raw LINE User ID pattern.
- Final evidence has `idea_json_final_push_completed` and `idea_json_final_callback_completed`.
- Minimal regression passed: `node worker/test/worker.test.mjs` and `node monitor/test/monitor.test.mjs`.
- Residual risk: n8n variable creation remains disabled, so full n8n-side shared-secret value comparison is still a future hardening step; no-header barrier is passing now.
- Result: `N8N SHARED-SECRET HARDENING TEST PASS`.
- Evidence: `TEST_EVIDENCE_N8N_SHARED_SECRET_HARDENING.md`.
- Next step: hand off to FIX for the next Gate, `Computer Use 最小開通：只允許 open_browser_page`.

## Live Regression 1503cc No Reply

- Date: 2026-07-18
- Field report: around 15:03 CST, 菲比 sent `記一下：[REDACTED_IDEA_CONTENT]` and saw no LINE reply.
- TEST did not resend LINE and used approximate time, remote `_03` durable evidence, and fixed Dropbox directory readback.
- Identified request id: `pline-v3-01KXT0JM1YHRN0W22P7C147AJW`.
- Worker received the event and recorded `signature_pass`, `admin_pass`, `idempotency_pass`, `line_visible_ack_skipped`, and `webhook_http_200_returned`.
- n8n completed successfully with `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`; `request_id_mismatch` was absent.
- `save_idea_json` was enqueued, but task `idea-82487259686e7b01ced7621a` remained `pending`.
- Missing: `monitor_claimed`, `idea_json_file_written`, `idea_json_final_push_completed`, and final callback evidence.
- Dropbox readback found no new idea JSON after 14:50 CST and no JSON matching the `1503` water reminder.
- Root cause shape: same as the original `1153` pending-monitor case; not the T2601/T2606 request-id mismatch class; T2701/T2801 passed because TEST had monitor poll running before the live message.
- LINE read observation: appshot showed some earlier messages with gray `已讀`, but latest 15:03 message did not stably show it. This remains a LINE desktop/OA setting observation only, not backend proof.
- Result: `LIVE REGRESSION 1503CC NO REPLY FAILED`.
- Evidence: `TEST_EVIDENCE_LIVE_REGRESSION_1503CC_NO_REPLY.md`.
- Next step: hand off to FIX for durable always-on monitor/queue runner or Worker-side timeout/failure final for pending `save_idea_json` tasks.

## Durable Monitor Runner Live TEST

- Date: 2026-07-18
- FIX under TEST: Worker version `187a2454-4b4a-464d-9175-88d43017a833` and launchd runner `com.pline.v3.test.codex-monitor`.
- TEST did not run manual `monitor poll`, `claim-task`, or `drain`.
- launchd runner precheck: state `running`; heartbeat initially `ready`.
- Baseline pending queue already contained one stale completed pending key: `idea_json:v1:pending:idea-0dde004dabcab361ed557fff`.
- TEST sent live T-code `T2901-20260718152036`.
- Request id: `pline-v3-01KXT1KRBW5MSP8WDT9QR2A3Y4`.
- Worker/n8n path passed: signature/admin/idempotency, webhook HTTP `200`, `line_visible_ack_skipped`, `n8n_background_completed`, `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`.
- T2901 pending index was created for task `idea-4a47aede9a419394a2967bd0`.
- T2901 task remained `pending`; `monitor_claimed`, Dropbox JSON, and final push evidence were absent.
- Runner heartbeat changed to `error`; safe reason summary indicates pending index cleanup failed while trying to delete the stale completed pending key.
- Remaining pending idea queue count after wait: `2` (`idea-0dde...` stale key plus T2901 key).
- 1503 recovery file `idea-20260718-150321-82487259686e.json` still exists exactly once, parses, has valid 9-field schema, and has no raw LINE User ID pattern.
- Minimal regression passed: `node worker/test/worker.test.mjs` and `node monitor/test/monitor.test.mjs`.
- Result: `DURABLE MONITOR RUNNER LIVE IDEA_CREATE FAILED`.
- Evidence: `TEST_EVIDENCE_DURABLE_MONITOR_RUNNER_LIVE.md`.
- Next step: hand off to FIX to repair pending-index cleanup and runner error handling, then rerun TEST without manual monitor commands.

## Durable Monitor Runner Second Live TEST

- Date: 2026-07-18
- TEST did not run manual `monitor poll`, `claim-task`, or `drain`.
- launchd runner `com.pline.v3.test.codex-monitor` was `running`; heartbeat was `ready`.
- Pending queue baseline before T2902: idea `0`, codex `0`.
- TEST sent live T-code `T2902-20260718153255` to LINE target `菲比智能客服 測試_03`.
- Request id: `pline-v3-01KXT29N4CBP3J3AVDVKSDKZ91`.
- Worker/n8n path passed: signature/admin/idempotency, webhook HTTP `200`, `line_visible_ack_skipped`, `n8n_background_completed`, `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`.
- T2902 task `idea-ef60f64a6f511ce02c065eaa` was claimed and completed by launchd runner evidence `pline-v3-test-codex-monitor`.
- T2902 pending index was created and removed; final pending queue count remained idea `0`, codex `0`.
- Dropbox JSON `idea-20260718-153325-ef60f64a6f51.json` exists, parses, has exactly the 9 allowed schema fields, matches the runner cleanup verification idea, and contains no raw LINE User ID pattern.
- Final durable evidence includes `idea_json_final_push_completed` and `idea_json_final_callback_completed`.
- 1503 recovery file and T2901 recovery file each remain single, with no duplicates.
- Minimal regression passed: `node worker/test/worker.test.mjs` and `node monitor/test/monitor.test.mjs`.
- Result: `DURABLE MONITOR RUNNER SECOND LIVE IDEA_CREATE PASS`.
- Evidence: `TEST_EVIDENCE_DURABLE_MONITOR_RUNNER_SECOND_LIVE.md`.
- Next step: hand off to RELEASE for git status, secret scan, commit, and push if controller is ready to close this TEST scope.

## N8N Request ID Contract Recurrence Repair

- Date: 2026-07-18
- Target workflow: `kcMcBQos5cxsnWU1`
- n8n published version: `N8N request_id recurrence repair`
- Local draft updated: `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`
- Repair: `Normalize Input` now duplicates the Worker original request id into `worker_request_id`.
- Repair: `Structured Output` now uses only `worker_request_id || request_id` from `Normalize Input` as the canonical response id.
- Guard: AI Agent output `request_id` is ignored.
- Guard: sanitizer code no longer uses slash regex or raw newline/tab escape sequences.
- No-secret synthetic verification proved an intentionally wrong AI `request_id` is ignored and the output preserves `pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF` with `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`.
- Evidence: `N8N_EVIDENCE_REQUEST_ID_CONTRACT_RECURRENCE.md`.

## Next Stage

Hand off to `PLine03｜TEST｜測試與驗收` to rerun a new safe idea_create marker and confirm no `request_id_mismatch`, `save_idea_json` enqueue, monitor claim, Dropbox JSON creation, and natural final before opening the Computer Use minimal-open-page Gate.

## N8N Live Production request_id_mismatch Follow-Up

- Date: 2026-07-18
- Target workflow: `kcMcBQos5cxsnWU1`
- Live failed request rechecked: `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86`
- n8n UI shows workflow is active/published and production webhook path is `/webhook/pline-v3-test-ai-agent`.
- n8n UI confirms current `Structured Output` contains `canonicalRequestId` and `worker_request_id`, and does not contain `parsed.request_id`.
- `Respond to Webhook` returns JSON body expression `{{ $json }}`.
- The target workflow `Executions` tab showed `No executions found`; T2601 was not visible under this workflow, so per-node live outputs could not be inspected in this N8N turn.
- Local no-secret harness for the T2601 request id still PASSed and ignored an intentionally wrong AI-generated request id.
- `.env.example` now shows production `/webhook/pline-v3-test-ai-agent` to avoid future test/prod handoff confusion.
- Evidence: `N8N_EVIDENCE_LIVE_PRODUCTION_REQUEST_ID_MISMATCH.md`.

## Next Stage

Hand off to `PLine03｜FIX｜Worker 與程式` / `PLine03｜TEST｜測試與驗收` to confirm the live Worker `N8N_WEBHOOK_URL` exactly targets `/webhook/pline-v3-test-ai-agent`, restore execution attribution if needed, then rerun a fresh T260x idea_create live verification before opening the Computer Use minimal-open-page Gate.

## N8N Respond-to-Webhook Nonempty Production Repair

- Date: 2026-07-18
- Target workflow: `kcMcBQos5cxsnWU1`
- Published n8n version: `N8N normalize env and respond nonempty repair`
- Root cause evidence observed in production executions: `Normalize Input` failed with env var access denied before the final response contract could complete.
- `Normalize Input` no longer directly reads `$env.N8N_SHARED_SECRET`; it uses guarded `$vars.N8N_SHARED_SECRET` lookup when available.
- `Respond to Webhook` changed from custom JSON body `{{ $json }}` to `First Incoming Item`.
- Published readback confirmed Respond node has `Respond With: First Incoming Item`, no `Response Body`, and no `{{ $json }}` expression.
- Production no-secret probe to `/webhook/pline-v3-test-ai-agent` returned HTTP `200`, nonempty JSON, preserved the synthetic request id in `request_id` and `worker_request_id`, and returned `intent=idea_create`, `tool_called=idea_create`, `status=completed`, `saved_record=1`.
- Workflow `Executions` tab still showed `No executions found` after the probe, so execution saving/UI visibility remains an observation.
- Risk: direct n8n endpoint accepted the no-secret probe; n8n-side shared-secret enforcement depends on configuring n8n variable `N8N_SHARED_SECRET`.
- Evidence: `N8N_EVIDENCE_RESPOND_WEBHOOK_NONEMPTY.md`.

## Next Stage

Hand off to `PLine03｜TEST｜測試與驗收` / `PLine03｜FIX｜Worker 與程式` to rerun fresh T260x live idea_create through LINE/Worker and confirm no `request_id_mismatch`, Dropbox JSON creation, and natural final reply before opening the Computer Use minimal-open-page Gate.

## N8N Shared-Secret Header Hardening

- Date: 2026-07-18
- Target workflow: `kcMcBQos5cxsnWU1`
- Published n8n version: `N8N shared-secret header hardening`
- n8n Variables UI did not contain `N8N_SHARED_SECRET`; `Create variable` was disabled in the current plan/UI.
- `Normalize Input` now rejects requests missing `x-pline-v3-shared-secret` before AI/tool execution.
- `Normalize Input` still avoids direct `$env.N8N_SHARED_SECRET` access.
- If `$vars.N8N_SHARED_SECRET` becomes available later, the same guard performs value equality and rejects mismatches.
- `Respond to Webhook` remains `First Incoming Item`.
- Local guard verification passed for no-header rejection, header-present compatibility, wrong-header-with-variable rejection, and good-header-with-variable acceptance.
- Production no-header probe no longer returned a normal `idea_create` contract.
- Production header-present synthetic probe returned nonempty response, preserved request id, and returned `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`.
- Residual risk: full value equality is not active until n8n variable `N8N_SHARED_SECRET` can be created or supplied safely.
- Evidence: `N8N_EVIDENCE_SHARED_SECRET_HARDENING.md`.

## Next Stage

Hand off to `PLine03｜TEST｜測試與驗收` / `PLine03｜FIX｜Worker 與程式` to confirm direct no-secret n8n probe remains rejected and live Worker LINE idea_create still passes. Computer Use minimal-open-page Gate remains paused until hardening verification passes.
## Durable Monitor Queue Runner - 2026-07-18

Status: FIX completed; TEST handoff required.

- Root cause: live idea_create could enqueue `save_idea_json` successfully but remain pending when TEST had not manually started monitor polling.
- Repair: Worker now writes pending queue indexes under `codex_task:v1:pending:` and `idea_json:v1:pending:`; monitor runner drains those indexes continuously.
- Runner: launchd label `com.pline.v3.test.codex-monitor`, state verified `running`, heartbeat path `runtime/monitor-runner/heartbeat.json`.
- Recovery: task `idea-82487259686e7b01ced7621a` completed; Dropbox JSON `idea-20260718-150321-82487259686e.json`; `idea_json_final_push_completed` present.
- Deployed Worker version: `187a2454-4b4a-464d-9175-88d43017a833`.

Next: TEST sends a fresh idea_create live message without manually starting monitor poll and verifies monitor claim, Dropbox JSON, callback, and natural final.

### Follow-up: Pending Index Cleanup Error Handling

- TEST T2901 found runner heartbeat `error` because stale completed pending cleanup failed before the active pending task.
- Repair: pending-key get/parse/delete is now isolated; terminal cleanup is best-effort warning only; later active tasks continue.
- Recovered T2901 task `idea-4a47aede9a419394a2967bd0`; Dropbox JSON `idea-20260718-152127-4a47aede9a41.json`; final status completed.
- Runner heartbeat returned to `ready`; both `idea_json:v1:pending:` and `codex_task:v1:pending:` are empty.
- No Worker deploy was needed for this follow-up.
## LINE Mark As Read - 2026-07-18

Status: FIX completed; TEST live validation required.

- Worker now calls LINE `POST /v2/bot/chat/markAsRead` after signature/admin/idempotency PASS.
- Token source: `message.markAsReadToken`; transient use only.
- Durable no-secret stages: `line_mark_as_read_completed`, `line_mark_as_read_skipped_no_token`, `line_mark_as_read_failed`.
- Mark-as-read failure does not block webhook HTTP 200, n8n, Dropbox JSON, monitor runner, or final reply.
- No visible ACK was reintroduced.
- Deployed Worker version: `09d51a3b-6301-4c0b-b0f2-bd3db8229638`.

Next: TEST sends a fresh idea_create marker and checks LINE read-state if visible, plus durable `line_mark_as_read_completed` evidence.

### Follow-up: Chat Off Primary Mode

- User turned `_03` OA Chat off; controller verified `_03` OA `菲比智能客服 測試_03 / @967fvhek` has Chat off and webhook still enabled.
- TEST T3001 showed LINE desktop read state PASS and idea_create/Dropbox/final PASS.
- Worker API mark-as-read stage was `line_mark_as_read_failed`, so API mark-as-read is no longer the primary criterion in Chat-off mode.
- Worker now calls mark-as-read API only when `LINE_MARK_AS_READ_ENABLED === "true"`.
- Default `_03` TEST behavior records `line_mark_as_read_skipped_disabled` and relies on OA Chat off auto-read.
- Deployed Worker version: `b39f1e21-f5e3-41e8-a673-1f77e45c98cb`.

### TEST Result: LINE Mark As Read Live Validation

Status: PARTIAL; FIX handoff required.

- TEST sent live T-code `T3001-20260718155646` to LINE target `菲比智能客服 測試_03`.
- Request id: `pline-v3-01KXT3NXEQXYVE5Y52R97GQNFV`.
- LINE desktop screenshot showed grey `已讀` near the latest T3001 sent message.
- Durable Worker evidence showed actual stage `line_mark_as_read_failed`, not `line_mark_as_read_completed`.
- Webhook delivery remained healthy: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `webhook_http_200_returned`.
- No visible fixed ACK was reintroduced: `line_visible_ack_skipped` present.
- idea_create/Dropbox/final path remained PASS: `n8n_background_completed`, `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, launchd monitor claim, Dropbox JSON parse/schema PASS, `idea_json_final_push_completed`.
- Pending queues after completion: `idea=0`, `codex=0`.
- Evidence: `TEST_EVIDENCE_LINE_MARK_AS_READ_LIVE.md`.

Next: hand off to FIX to diagnose the live Mark As Read API failure stage while preserving the successful Chat-off + webhook + idea_create/Dropbox/final path.

### TEST Result: T3002 Chat Off Auto-Read

Status: PASS.

- TEST sent live T-code `T3002-20260718160604` to LINE target `菲比智能客服 測試_03`.
- Request id: `pline-v3-01KXT46DF26Q4N9C4GS1B6PC58`.
- Worker health showed `line_mark_as_read.enabled=false` and mode `disabled_chat_off_auto_read`.
- LINE desktop follow-up screenshot showed grey `已讀` beside the latest T3002 sent message.
- Durable Worker evidence included `line_mark_as_read_skipped_disabled`.
- Durable Worker evidence did not include `line_mark_as_read_failed` for this request.
- Webhook delivery remained healthy: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `webhook_http_200_returned`.
- No visible fixed ACK was reintroduced: `line_visible_ack_skipped` present.
- idea_create/Dropbox/final path remained PASS: `n8n_background_completed`, `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, launchd monitor claim, Dropbox JSON parse/schema PASS, `idea_json_final_push_completed`.
- Pending queues after completion: `idea=0`, `codex=0`.
- Evidence: `TEST_EVIDENCE_LINE_READ_CHAT_OFF_T3002.md`.

Next: RELEASE can perform git status, secret scan, commit, and push if the controller is ready to close this TEST scope.

## N8N idea_create Natural Reply - 2026-07-18

Status: N8N production synthetic PASS; TEST live validation required.

- Fixed source of repeated `已記下這個想法。`: n8n `Structured Output` fallback was used because AI natural reply was absent.
- Found `OpenAI Chat Model` was failing with `Could not get parameter "model.value"`; fixed model locator setting in workflow `kcMcBQos5cxsnWU1`.
- Published n8n version `N8N idea_create saved natural reply guard`.
- `AI Agent` now receives `idea_content`, saved phase/status fields, and must return `reply_text` plus `reply_source=ai_generated`.
- Synthetic production probes for four public ideas returned distinct content-aware `ai_generated` replies with request id preserved and `saved_record=1`.
- Evidence: `N8N_EVIDENCE_IDEA_CREATE_NATURAL_REPLY.md`.

Next: TEST sends fresh live LINE idea_create markers such as T3101/T3102 and confirms final LINE text is natural/content-aware while Dropbox JSON and final delivery remain PASS.

### TEST Result: T3101/T3102 Live Natural Finals

Status: PASS.

- TEST sent two live idea_create messages to LINE target `菲比智能客服 測試_03`.
- T3101 request id: `pline-v3-01KXT5Z8WG55H64Q7XJX4WGEE4`.
- T3102 request id: `pline-v3-01KXT5ZB1057E1PK8A4M8YM36E`.
- LINE desktop screenshot showed grey `已讀` for both sent messages.
- Two user-visible final replies appeared, were not identical, and neither was fixed sentence `已記下這個想法。`.
- User-visible final replies were content-aware and contained no `_03`, `TEST`, `n8n`, `Worker`, `task`, `JSON`, `execution`, or `webhook`.
- Durable Worker evidence for both requests included `line_mark_as_read_skipped_disabled`; `line_mark_as_read_failed` was absent.
- Durable Worker/n8n evidence for both requests included `n8n_background_completed`, `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`.
- Monitor runner auto-claimed and wrote Dropbox JSON files `idea-20260718-163742-7034568e607d.json` and `idea-20260718-163743-0d611eb4be09.json`; both parse/schema/no raw UID checks PASS.
- Pending queues after completion: `idea=0`, `codex=0`.
- Evidence: `TEST_EVIDENCE_IDEA_CREATE_AI_NATURAL_FINAL_LIVE.md`.

Next: RELEASE can perform git status, secret scan, commit, and push if the controller is ready.

## Codex Default Delegation Investigation - 2026-07-18

Status: `BLOCKED_FOR_DEFAULT_DELEGATION`.

- FIX traced the current durable monitor executor before any implementation change.
- Current `codex_task` execution is local fixed smoke-file code in `monitor/src/monitor.js`; `CODEX_BIN` is only an executable health check.
- Worker still replaces codex_task work with fixed `create_smoke_file` project/path/content/instruction and guards other capabilities as `capability_not_yet_enabled`.
- No Codex thread, Codex turn, desktop tool surface, plugin/skill/MCP listing, streamed turn event, or approval bridge is available to the launchd monitor.
- Codex CLI `0.142.5` is installed and exposes non-interactive `exec` plus experimental app-server/remote-control commands, but `_03` has no selected Gateway protocol or client.
- Evidence: `FIX_EVIDENCE_CODEX_DEFAULT_DELEGATION_INVESTIGATION.md`.

Next: do not implement default delegation until a formal Codex host/API/permission contract is selected and authorized.

## Codex Default Delegation Implementation - 2026-07-18

Status: `PASS`.

- Selected interface: official `codex exec --json` non-interactive JSONL stream.
- Local Codex version: `codex-cli 0.142.5`.
- Implemented monitor-side `CodexGateway` with submit/status/events/approve/cancel/result/capability methods.
- Implemented `CodexExecHostAdapter`; fixed the launchd-safe invocation by using `spawn` and explicitly closing stdin.
- Worker now queues `codex_delegate` tasks and preserves `original_user_text`; legacy n8n `codex_task` is normalized only as an alias.
- Worker contract now keeps the top-level routes to `idea_create`, `google_calendar_direct`, and `codex_delegate`.
- Local n8n workflow artifact now uses the same three-route contract and its Codex tool returns `action=codex_delegate`.
- Codex processing LINE notice is no longer sent on enqueue; monitor sends it only after the Codex Gateway observes `turn.started`.
- Worker no longer blocks Browser/Computer Use style natural language before Codex; unavailable host surfaces are reported in capability manifest.
- Approval bridge implemented with `awaiting_approval`, LINE confirmation code, approval lookup key, and requeue of the same task.
- Direct CLI live evidence and Gateway live evidence both wrote ignored runtime files with readback `Codex Gateway live PASS`.
- Live n8n workflow `kcMcBQos5cxsnWU1` was published with visible tool node `codex_delegate`; visible legacy tool node `codex_task` is absent after publish.
- Gateway prompt now sends `<task_instruction>` separately from `<original_user_text>`, so structured delegated task instructions cannot be dropped when the user-facing text is shorter.
- Delegated Codex probes verified `thread.started`, `turn.started`, processing callback thread id propagation, runtime file creation, syntax check execution, and `git status --short`.
- Remaining gap: no fresh LINE-origin `codex_delegate` visible final was sent after this latest n8n publish window.
- Evidence: `TEST_EVIDENCE_CODEX_DEFAULT_DELEGATION_GATE.md`.

Unavailable host surfaces: Browser and Computer Use are not exposed through the launchd `codex_exec` adapter; this is recorded as capability manifest output, not a delegation Gateway blocker.

## n8n Contract Failure LINE Notice - 2026-07-18

Status: `DEPLOYED`.

- Investigated the latest LINE command at 20:31 local time.
- Request id: `pline-v3-01KXTKBMRG5QGQ3MW64GVNGZM2`.
- Worker received the event and passed `signature_pass`, `admin_pass`, `idempotency_pass`, `line_visible_ack_skipped`, `line_mark_as_read_skipped_disabled`, and `webhook_http_200_returned`.
- n8n background contract failed with `unsupported_intent`; no `codex_task` pending queue record was created.
- Root cause of no visible progress: Worker did not send a LINE final on n8n contract failure.
- Fix: Worker now pushes a natural failure final for `n8n_background_failed` and `n8n_background_contract_failed`, with evidence stages `n8n_background_failure_notice_completed` or `n8n_background_contract_failure_notice_completed`.
- Deployed Worker version `ae59f6ff-59a4-407e-8b0d-6b0b617ce991`.
- Follow-up hardening: `callN8nWebhook` now has a bounded timeout, and the fetch exception/timeout catch path also pushes the same natural failure final.
- Deployed Worker version `610d11c5-a64c-4d6a-a640-f3cb8a5e5836`.
