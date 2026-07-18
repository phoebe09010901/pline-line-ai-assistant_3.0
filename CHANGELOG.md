# CHANGELOG

## 2026-07-18

- Created clean-room document baseline for `菲比 LINE 智能助理_03`.
- Defined the minimal dual-path scope.
- Added initial architecture, test plan, security boundary, environment example, and ignore rules.
- Recorded that implementation, deployment, Git setup, n8n setup, and live tests are not part of this DOC baseline.
- Created new TEST-only n8n workflow `PLine｜菲比智能客服｜V3 最小 AI Agent` in the `_03` scope.
- Added no-secret n8n workflow draft `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`.
- Recorded Worker handoff values for `N8N_WEBHOOK_URL`, `N8N_SHARED_SECRET`, and `x-pline-v3-shared-secret`.
- Kept n8n workflow unpublished/inactive; no LINE live test or production activation was performed.
- Aligned Worker/env/docs with N8N-01 handoff for FIX-02.
- Filled TEST `N8N_WEBHOOK_URL` as `https://n8nphy.app.n8n.cloud/webhook-test/pline-v3-test-ai-agent`.
- Confirmed shared secret naming as `N8N_SHARED_SECRET` sent through `x-pline-v3-shared-secret`; no secret value was committed.
- Updated Worker n8n contract to accept `idea_create`, `codex_task`, `clarify`, and `unsupported`, while keeping Gate tests limited to `idea_create` and `codex_task`.
- Ran TEST-01 local readiness for Worker and monitor; both minimal tests passed.
- Ran Cloudflare Worker dry-run for `pline-v3-test-line-gateway`; no deploy, KV/D1 creation, secret write, publish, activation, or LINE live test was performed.
- Recorded Gate 1/Gate 2 as blocked before live execution pending authorized TEST secrets, Cloudflare bindings, n8n shared-secret setup, LINE Developers TEST webhook setup, and 菲比真人 LINE send.
- Received TEST-02 authorization text and attempted live Gate readiness checks.
- Confirmed Cloudflare Worker `pline-v3-test-line-gateway` does not exist in the currently logged-in Cloudflare account, so Gate 1/Gate 2 were not executed.
- Recorded TEST-02 handoff to FIX for `_03` TEST Worker deployment, KV bindings, and required secret setup without exposing secret values.
- Ran FIX-03 Cloudflare readiness under the current Wrangler login.
- Created `_03` TEST KV namespaces `pline-v3-test-runtime` and `pline-v3-test-idempotency`.
- Updated `worker/wrangler.toml` with live KV namespace bindings for `RUNTIME_KV` and `IDEMPOTENCY_KV`.
- Did not create D1 because the first-stage TEST flow does not require it.
- Added no-secret Cloudflare evidence file `CLOUDFLARE_TEST_EVIDENCE_FIX_03.md`.
- Confirmed `npx wrangler deploy --dry-run` passes with the new `_03` KV bindings.
- Re-ran local Worker/monitor syntax checks, unit tests, n8n JSON validation, and monitor health; all passed.
- Blocked Worker secret setup and deploy because required TEST secret values were not available from authorized local sources.
- Applied FIX-04 SCOPE GUARD: stopped using any `_02` named LINE channel or LINE secret/token source.
- Recorded that `_02` LINE secret/token values were visible before the correction but were not set in Cloudflare/n8n and were not written to repo files.
- Attempted to create a new `_03` LINE Official Account/channel, but stopped before submission because the form requires 菲比 agreement to service terms/privacy policy.
- Added no-secret evidence file `LINE_SCOPE_GUARD_FIX_04.md`.
- Continued after `_03` LINE channel became available as `菲比智能客服 測試_03`.
- Configured `_03` LINE channel secrets to Cloudflare Worker secret names without writing values to repo.
- Generated and configured a new `N8N_SHARED_SECRET` for Cloudflare Worker and target n8n workflow `kcMcBQos5cxsnWU1`.
- Deployed Worker `pline-v3-test-line-gateway` and set `_03` LINE webhook to `/line/webhook`.
- Parsed current `_03` bootstrap event, configured `LINE_TEST_ADMIN_USER_IDS`, replaced bootstrap sentinel, and deleted only the bootstrap KV key.
- Confirmed Worker health, secret names, deploy status, KV bindings, Wrangler tail readability, and monitor readiness.
- Added no-secret evidence file `CLOUDFLARE_TEST_EVIDENCE_FIX_06.md`.
- Recorded TEST-03 Gate 1 run 1 live failure: Worker returned `502` and no LINE reply was observed.
- Repaired FIX-07 root cause by switching Worker n8n URL from `webhook-test` to production `/webhook/pline-v3-test-ai-agent`.
- Published n8n workflow `kcMcBQos5cxsnWU1` for production webhook use.
- Added no-secret Worker stage logs and hardened n8n response shape parsing.
- Deployed Worker version `19c6ece9-5d6f-4b62-a4fd-060c22c26f12`.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_07.md`.
- Recorded TEST-04 Gate 1 run 1 live failure: Worker invocation was `canceled` and no LINE reply was observed.
- Repaired FIX-08 cancellation root cause by sending a fast LINE ACK before n8n/AI work.
- Moved n8n production webhook processing into `ctx.waitUntil(...)` background work with no-secret stage logs.
- Added background LINE Push API final reply for `codex_task` after n8n contract validation.
- Deployed Worker version `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`.
- Confirmed `/health`, secret names, KV bindings, deployments list, tail readability, and n8n production webhook path availability.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_08.md`.
- Recorded TEST-05 Gate 1 run 1 live failure: Worker fast LINE Reply API returned `line_reply_http_401`.
- Confirmed `_03` LINE Developers channel `菲比智能客服 測試_03` / `2010748091`; did not use `_02`.
- Validated the current `_03` Messaging API token with LINE API `/v2/bot/info` returning HTTP `200`, then updated Cloudflare secret `LINE_CHANNEL_ACCESS_TOKEN` without recording the token value.
- Added Worker token normalization for accidental whitespace or accidental `Bearer ` prefix in `LINE_CHANNEL_ACCESS_TOKEN`.
- Added unit coverage for LINE Reply API endpoint, authorization header, content type, and JSON body.
- Deployed Worker version `97f20405-6ed9-4cfb-801d-218ae1f21c61`.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_09.md`.
- Recorded TEST-06 Gate 1 run 1 live failure: fast ACK succeeded, but background n8n contract failed with `request_id_mismatch`.
- Repaired FIX-10 by changing n8n workflow `kcMcBQos5cxsnWU1` Structured Output to always preserve `Normalize Input` request id.
- Added deterministic response evidence fields for `idea_create` and `codex_task`.
- Published n8n workflow version `FIX-10 request_id contract`.
- Updated Worker contract validation and no-secret background completion logs for Gate evidence fields.
- Deployed Worker version `02b1fa59-4d4c-4119-8dc8-5699183d5456`.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_10.md`.
- Recorded TEST-07 live failure: fast ACK succeeded, but background n8n still failed with `request_id_mismatch`.
- Inspected live n8n execution `#551` for workflow `kcMcBQos5cxsnWU1`; version `FIX-10 request_id contract` failed in sub-node `OpenAI Chat Model`.
- Repaired FIX-11 by changing AI Agent `On Error` from `Stop Workflow` to `Continue`.
- Published n8n workflow version `FIX-11 continue on AI error`.
- Retried execution `#551` as `#552`; Structured Output and Respond to Webhook both succeeded with one item and preserved the Worker request id.
- Left Worker code unchanged; no Worker deploy was required, and Worker version remains `02b1fa59-4d4c-4119-8dc8-5699183d5456`.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_11.md`.
- Recorded TEST-08 evidence gap: one Gate 1 run had complete tail evidence, but later visible fast ACK replies lacked reliable per-run tail/n8n correlation.
- Added Worker no-secret evidence persistence to `_03` `RUNTIME_KV` with prefix `evidence:v1`.
- Added marker index keys for Gate T-codes and append-only per-request stage keys.
- Added guarded TEST read endpoint `/test/evidence` using `x-pline-v3-shared-secret`.
- Added unit coverage for evidence persistence/readback and no raw User ID or full message text storage.
- Deployed Worker version `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_12.md`.
- Recorded TEST-09 failure: valid LINE Gate messages produced no visible ACK, no Worker tail invocation, and no `evidence:v1` marker records.
- Confirmed `_03` LINE Developers channel `菲比智能客服 測試_03` / `2010748091`; did not use `_02`.
- Confirmed webhook URL and `Use webhook` were already correct; LINE endpoint API returned active=true.
- Confirmed LINE Developers Verify success and Worker route HTTP `200` for official Verify traffic.
- Enabled `Webhook redelivery` and `Error statistics aggregation` for the `_03` channel.
- Left Worker code and secrets unchanged; no Worker deploy was required.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_13.md`.
- Recorded TEST-10 failure: user-sent LINE app message produced no visible ACK and no durable `evidence:v1` marker.
- Found LINE Developers Webhook error `request_timeout` at `2026/07/18 06:06:36` for the `_03` Worker webhook URL.
- Repaired FIX-14 by moving foreground LINE webhook evidence persistence to `ctx.waitUntil(...)` through `queueEvidenceStage(...)`.
- Added unit coverage for a stalled `RUNTIME_KV.put(...)` still allowing `handleLineWebhook(...)` to return HTTP `200`.
- Deployed Worker version `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`.
- Verified LINE Developers Verify Success and Cloudflare tail HTTP `200` on the new Worker version.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_14.md`.
- Recorded TEST-11 failure: runtime path completed, but durable `evidence:v1` marker and request stage keys were missing.
- Repaired FIX-15 durable evidence persistence by writing marker index first and using deterministic request stage keys.
- Fixed no-secret `evidence_persist_failed` logging so failed stage is recorded as `failed_stage`.
- Added Worker tests for full webhook marker/stage readback and failed/slow KV evidence behavior.
- Deployed Worker version `5a41bd15-789f-43ce-9bd0-2365d9dcef21`.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_15.md`.
- Recorded TEST-12 failure as a durable evidence readback issue after visible LINE fast ACK.
- Confirmed deployed Worker `RUNTIME_KV` is bound to `_03` remote namespace id `10cdfe018b3942b483faeaca6e517ae5`.
- Found Wrangler KV evidence fallback must use `--remote`; without it, reads can hit local KV and return false `Value not found`.
- Proved TEST-12 marker `T1201-20260718053133` exists in remote KV and protected HTTP evidence readback returns full Gate 1 run 1 evidence.
- Added protected `/test/evidence/selfcheck` live diagnostic and optional secret name `EVIDENCE_SELFTEST_SECRET`.
- Added bounded fast ACK evidence checkpoint for marker and foreground stage persistence.
- Deployed Worker version `8a23d5c0-e014-4cbd-b594-9f7814eeb6c1`.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_16.md`.
- Recorded TEST-13 Gate 1 PASS and Gate 2 missing monitor/Codex/smoke-file evidence.
- Added Worker `codex_task` pending task enqueue to `_03` remote KV prefix `codex_task:v1:task:<task_id>`.
- Added Worker `codex_task_enqueued` evidence.
- Added monitor `claim-once`, `poll`, and `selftest` commands.
- Added monitor remote KV claim flow and evidence stages `monitor_claimed`, `codex_execution_completed`, and `smoke_file_written`.
- Verified live monitor selftest overwrote `_03` `codex-smoke.txt`, updated mtime, and wrote remote evidence.
- Deployed Worker version `8fedf73f-c983-43af-832b-96e9f0e957c9`.
- Added no-secret evidence file `FIX_EVIDENCE_FIX_17.md`.

## RELEASE-01 Result

- Completed `_03` TEST-only release closeout after TEST-13 `N8N MINIMAL PATH PASS` and TEST-14 `CODEX MINIMAL PATH PASS`.
- Marked `_03 MINIMAL DUAL-PATH PASS` and final closeout status `PLine03 _03 TEST PROJECT COMPLETE`.
- Confirmed Worker `/health`, required env flags, KV binding flags, current 100% deployment version `8fedf73f-c983-43af-832b-96e9f0e957c9`, and secret names without exposing values.
- Confirmed n8n no-secret local draft status for workflow `kcMcBQos5cxsnWU1` and production webhook route HTTP `200` from a no-secret RELEASE probe.
- Confirmed LINE webhook target remains the `_03` Worker route; direct invalid-signature readback returned HTTP `401`.
- Confirmed monitor health `ready`, remote Gate 2 evidence stages, completed remote task record, and `codex-smoke.txt` mtime/content.
- Confirmed folder is not a Git repository; no commit or push performed.
- Added no-secret evidence file `RELEASE_EVIDENCE_RELEASE_01.md`.
- Added post-release TEST extension for Dropbox idea JSON saving on Path A `idea_create`.
- Worker now enqueues fixed monitor action `save_idea_json` after n8n confirms `intent=idea_create` and `tool_called=idea_create`.
- Monitor now validates and writes one idea JSON per event to `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`.
- Added schema, fixed-directory, generated-filename, temp-then-rename, duplicate, and no raw User ID coverage for `save_idea_json`.
- Added monitor `idea-selftest` command for no-secret remote KV claim/write verification.
- Updated `.gitignore` for local idea JSON/temp artifacts.
- Deployed Worker version `d5cda8d2-65bc-4cc2-b953-f67d761fde39`.
- Added no-secret evidence file `FIX_EVIDENCE_DROPBOX_IDEA_JSON.md`.
- Repaired Dropbox idea JSON final LINE reply evidence gap.
- Worker now accepts monitor `idea_json_file_written` durable evidence as save completion proof if the final task record is not yet visible.
- Worker now suppresses formal final push for duplicate idea tasks and records `idea_json_final_push_suppressed`.
- Added tests for success final push after monitor evidence, timeout/failure not sending success text, duplicate suppress, and no raw User ID in evidence.
- Deployed Worker version `3ba57849-b02c-4b6e-a066-8da95575563c`.
- Added no-secret evidence file `FIX_EVIDENCE_DROPBOX_IDEA_FINAL_REPLY.md`.
- Replaced idea final reply timing-window behavior with durable exactly-once monitor callback.
- Worker now creates task-scoped `finalize_token`, stores encrypted `line_user_ref`, exposes `/test/idea-finalize`, and writes final state under `idea_json:v1:final:<task_id>`.
- Monitor now calls the Worker finalizer after `save_idea_json` completion/failure and records callback evidence.
- Added tests for saved callback push-once, repeated callback no second push, duplicate suppress, failure no success push, encrypted ref preservation, and no raw User ID in evidence.
- Deployed Worker version `cbadc5a1-4e07-44b2-853d-335c5486b11b`.
- Added no-secret evidence file `FIX_EVIDENCE_DROPBOX_IDEA_FINAL_EXACTLY_ONCE.md`.

## 2026-07-18 - TEST Dropbox Idea JSON Gate

- Ran live `_03` Dropbox idea JSON Gate using Computer Use against `菲比智能客服 測試_03`.
- Verified three Dropbox JSON writes, schema parse/9-key validation, irreversible fingerprints, and duplicate reprocess protection.
- Did not mark `DROPBOX IDEA JSON PATH PASS` because the formal LINE success final stage `idea_json_final_push_completed` was not proven.
- Added no-secret evidence file `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## 2026-07-18 - TEST Dropbox Idea JSON Gate Rerun After Final Reply Fix

- Reran live `_03` Dropbox idea JSON Gate after Worker version `3ba57849-b02c-4b6e-a066-8da95575563c`.
- Sent continuous markers `T1901-20260718082215`, `T1902-20260718082305`, and `T1903-20260718082309` through the authorized LINE app.
- Verified three new Dropbox JSON writes, JSON parse/9-key schema validation, normalized content, irreversible fingerprints, and Codex task count `0`.
- Verified duplicate deterministic reprocess with marker `T2099-20260718082930`; Dropbox JSON count stayed `13 -> 13`.
- Did not mark `DROPBOX IDEA JSON PATH PASS` because durable evidence still lacked `idea_json_final_push_completed`; current result is `DROPBOX IDEA JSON PATH PARTIAL`.
- Updated no-secret evidence file `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## 2026-07-18 - TEST Dropbox Idea JSON Gate PASS

- Reran live `_03` Dropbox idea JSON Gate after durable exactly-once finalizer Worker version `cbadc5a1-4e07-44b2-853d-335c5486b11b`.
- Sent continuous markers `T2201-20260718084633`, `T2202-20260718084802`, and `T2203-20260718084935` through the authorized LINE app.
- Verified three new Dropbox JSON writes, JSON parse/9-key schema validation, normalized content, irreversible fingerprints, and Codex task count `0`.
- Verified each run produced durable `idea_json_final_push_completed` evidence.
- Verified repeated finalizer callback returned `already_completed`, `pushed=false`, Dropbox JSON count stayed `20 -> 20`, and no second final push was produced.
- Marked `DROPBOX IDEA JSON PATH PASS`.
- Updated no-secret evidence file `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## 2026-07-18 - FIX idea_create Natural Final Without Visible ACK

- Removed the LINE-visible fixed Worker ACK `已收到 _03 TEST 訊息，我會繼續處理。` from normal idea_create processing.
- Kept LINE webhook HTTP `200` acceptance and added durable evidence `line_visible_ack_skipped` and `webhook_http_200_returned`.
- Worker finalizer now uses n8n natural `reply_text` after Dropbox JSON save succeeds, with safe saved fallback only after save success.
- Save failure now sends a truthful failure final and never sends saved-success text.
- Duplicate/repeated finalizer callbacks remain exactly-once with no second final.
- Deployed Worker version `dbda345b-a3b4-41ca-bc8b-a12c8547179c`.
- Added no-secret evidence file `FIX_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.

## 2026-07-18 - TEST IDEA NATURAL FINAL REPLY WITHOUT ACK Gate PASS

- Reran live `_03` natural final Gate after Worker version `dbda345b-a3b4-41ca-bc8b-a12c8547179c`.
- Verified three `idea_create` messages produced no visible fixed ACK, retained webhook HTTP 200 evidence, saved Dropbox JSON, and produced one natural user-visible final.
- Verified durable evidence `line_visible_ack_skipped`, `webhook_http_200_returned`, and `idea_json_final_push_completed`.
- Noted one transient LINE push HTTP 525 on the third run; task-scoped finalizer retry completed and repeated callback remained exactly-once.
- Verified safe local failure and AI fallback paths, live Codex regression, Dropbox regression, raw User ID count 0, and effective secret scan hit_count 0.
- Recorded LINE desktop read-receipt display as UI/OA setting observation only.
- Marked `IDEA NATURAL FINAL REPLY WITHOUT ACK PASS`.
- Added no-secret evidence file `TEST_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.
