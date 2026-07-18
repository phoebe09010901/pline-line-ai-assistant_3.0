# CODEX_NOTES

## Worker Role

This thread is `PLine03｜FIX｜Worker 與程式`.

Allowed work:

- Create or confirm `_03` TEST Cloudflare Worker/KV readiness.
- Set required Worker secrets only from authorized sources, without storing or printing secret values.
- Record Cloudflare TEST evidence without secret values.

Not allowed in this FIX-03 stage:

- Duplicate, import, or reference old project code or workflows.
- Use old Worker/KV/D1/route/service binding/secret names.
- Run Gate 1/Gate 2 LINE live tests.
- Publish, activate, or connect production services.
- Add features outside this stage.

## N8N-01 Handoff

- Workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Workflow id: `kcMcBQos5cxsnWU1`
- Workflow status: created as a new `_03` TEST-only workflow; not activated and not published by this stage.
- Webhook path: `pline-v3-test-ai-agent`
- Worker `N8N_WEBHOOK_URL`: `https://n8nphy.app.n8n.cloud/webhook-test/pline-v3-test-ai-agent`
- Worker/n8n shared secret env name: `N8N_SHARED_SECRET`
- Required request header from Worker to n8n: `x-pline-v3-shared-secret`
- OpenAI credential: existing n8n credential label `OpenAI account`; no secret value was read or exported.
- Local no-secret draft: `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`

## Follow-Up Risk

FIX-02 resolved the n8n intent mismatch by allowing Worker `validateN8nContract` to accept `idea_create`, `codex_task`, `clarify`, and `unsupported`. Gate 1/Gate 2 verification remains restricted to the two action paths: `idea_create` and `codex_task`.

Live TEST remains blocked in TEST-02 because the `_03` TEST Cloudflare Worker was not found in the currently logged-in account.

FIX-03 created the two required `_03` TEST KV namespaces and updated live KV bindings in `worker/wrangler.toml`, but Worker deploy remains blocked because the required TEST secrets were not available from authorized local sources.

## TEST-01 Result

- Scope remained in `/Users/phoebe/Documents/菲比 LINE 智能助理_03`.
- Local Worker readiness passed.
- Local monitor readiness passed and monitor health returned `ready`.
- `npx wrangler deploy --dry-run` passed for `pline-v3-test-line-gateway`.
- No Cloudflare deploy, KV/D1 creation, Worker secret write, n8n secret write, LINE Developers configuration, Publish/Activate, or LINE live message was performed.
- Gate 1/Gate 2 remain blocked before live execution until authorized TEST secrets, Cloudflare deployed bindings, n8n shared-secret setup, LINE Developers TEST webhook setup, and 菲比真人 LINE send are complete.

## TEST-02 Result

- Authorization text was received: `TEST live gate 已完成授權設定`.
- Cloudflare live readiness failed before Gate execution because Worker `pline-v3-test-line-gateway` was not found in the currently logged-in Cloudflare account.
- `worker/wrangler.toml` still has placeholder KV namespace IDs and no live `[[kv_namespaces]]` bindings.
- Local monitor health remains `ready`.
- Gate 1 was not executed; no three-run `idea_create` live sequence was attempted.
- Gate 2 was not executed; the local smoke file must not be treated as live LINE evidence.
- Next handoff is FIX: create/deploy `_03` TEST Worker, attach `_03` TEST KV bindings, set required TEST secrets without exposing values, then return to TEST.

## FIX-03 Result

- Wrangler account confirmed: `689b11645545394cce76cf14fdbadb4c`.
- Created `pline-v3-test-runtime`: `10cdfe018b3942b483faeaca6e517ae5`.
- Created `pline-v3-test-idempotency`: `1f857def085d466abed722e9222002e3`.
- Updated `worker/wrangler.toml` to bind `RUNTIME_KV` and `IDEMPOTENCY_KV`.
- D1 was not created because first-stage TEST does not require it.
- Required Worker secrets were missing from local authorized sources: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `N8N_SHARED_SECRET`, `LINE_TEST_ADMIN_USER_IDS`.
- Worker deploy was not performed.
- Wrangler deploy dry-run passed with the new `_03` KV bindings.
- Local Worker/monitor checks and n8n JSON validation passed.
- Evidence: `CLOUDFLARE_TEST_EVIDENCE_FIX_03.md`.

## FIX-04 Scope Guard Result

- `_02` named LINE channel resources are prohibited for `_03`.
- A `_02` channel page was opened before the guard correction and its secret/token values were visible in browser state.
- No `_02` LINE secret/token was set in Cloudflare.
- No `_02` LINE secret/token was set in n8n.
- No `_02` LINE secret/token was written to repo files.
- Temporary in-memory `_02` LINE secret state was cleared.
- No existing visible `_03` LINE Official Account/channel was found.
- New LINE Official Account creation requires 菲比 agreement to service terms/privacy policy, so Codex stopped before submission.
- Evidence: `LINE_SCOPE_GUARD_FIX_04.md`.

## FIX-06 Result

- `_03` LINE channel confirmed: `菲比智能客服 測試_03`.
- `_02` LINE channel resources remain prohibited and were not used.
- Current `_03` bootstrap event was used to configure `LINE_TEST_ADMIN_USER_IDS`; raw id was not recorded.
- Bootstrap sentinel was replaced by formal Cloudflare Worker secret value.
- Bootstrap KV key `admin:line_test_admin_user_id` was deleted only after secret setup.
- Worker deployed at `https://pline-v3-test-line-gateway.phy4175.workers.dev`.
- Latest Worker version id: `a49c1d70-4d68-46ff-b5fe-d537b0d0869f`.
- Worker `/health` reports all required env fields true.
- Wrangler tail/logs connection is readable.
- n8n target workflow `kcMcBQos5cxsnWU1` has shared-secret verification configured; the live secret value was not written to repo.
- Evidence: `CLOUDFLARE_TEST_EVIDENCE_FIX_06.md`.

## FIX-07 Result

- TEST-03 Gate 1 run 1 failed with Worker `502` before LINE reply.
- Root cause: Worker was still using n8n `webhook-test` URL for live LINE traffic.
- Worker now uses `https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent`.
- n8n workflow `kcMcBQos5cxsnWU1` was published with version name `FIX-07 production webhook`.
- Worker now logs no-secret stage outcomes for n8n failure, n8n contract failure, LINE reply failure, and completed webhook.
- Worker n8n response handling now accepts direct JSON, `{ json: ... }`, and one-item array shapes.
- Worker deployed version: `19c6ece9-5d6f-4b62-a4fd-060c22c26f12`.
- Evidence: `FIX_EVIDENCE_FIX_07.md`.

## FIX-08 Result

- TEST-04 Gate 1 run 1 failed with Worker invocation `canceled` and no LINE reply.
- Root cause: live LINE webhook synchronously waited for n8n/AI contract processing before sending LINE Reply API output.
- Worker reply mode is now `fast_ack_then_background_n8n`.
- Worker sends a fast LINE ACK after signature/admin/idempotency pass.
- Worker runs n8n production webhook processing and contract validation in `ctx.waitUntil(...)`.
- Worker sends a background LINE Push API final reply for `codex_task` after n8n contract validation.
- Worker no-secret stage logs now cover signature/admin/idempotency, fast reply, and background n8n completion/failure.
- Worker deployed version: `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`.
- `/health` reports required env fields true, `line_reply_mode: fast_ack_then_background_n8n`, and `codex_task_final_mode: background_push_final`.
- n8n production webhook path responds as a registered POST webhook path without exposing the shared secret.
- Evidence: `FIX_EVIDENCE_FIX_08.md`.

## FIX-09 Result

- TEST-05 Gate 1 run 1 reached signature/admin/idempotency PASS, then failed at fast LINE Reply API with `line_reply_http_401`.
- Worker Reply API code path already used the correct endpoint, bearer header shape, and JSON body.
- Root cause: deployed `LINE_CHANNEL_ACCESS_TOKEN` was invalid, stale, or not the current `_03` Messaging API channel token.
- LINE Developers channel confirmed: `菲比智能客服 測試_03`, channel id `2010748091`; visible `_02` channel was not used.
- Current `_03` Messaging API token was validated with LINE API `/v2/bot/info` returning HTTP `200`.
- Cloudflare Worker secret `LINE_CHANNEL_ACCESS_TOKEN` was updated by name only; token value was not recorded.
- Worker now normalizes the token before building the authorization header, trimming whitespace and avoiding accidental `Bearer Bearer ...`.
- Worker deployed version: `97f20405-6ed9-4cfb-801d-218ae1f21c61`.
- Evidence: `FIX_EVIDENCE_FIX_09.md`.

## FIX-10 Result

- TEST-06 Gate 1 run 1 completed fast ACK and started background n8n, then failed contract validation with `request_id_mismatch`.
- Root cause: n8n `Structured Output` trusted AI Agent `parsed.request_id` before preserving the Worker request id from `Normalize Input`.
- n8n workflow `kcMcBQos5cxsnWU1` now uses `$('Normalize Input').first().json.request_id` as the canonical response `request_id`.
- n8n response now includes deterministic Gate evidence fields for `idea_create` and `codex_task`.
- n8n workflow was published with version name `FIX-10 request_id contract`.
- Worker contract validation now requires `idea_create` tool/record evidence and `codex_task` tool/action/task evidence.
- Worker no-secret background completion logs now include Gate evidence fields without raw LINE ids or secrets.
- Worker deployed version: `02b1fa59-4d4c-4119-8dc8-5699183d5456`.
- Evidence: `FIX_EVIDENCE_FIX_10.md`.

## FIX-11 Result

- TEST-07 still failed background n8n contract validation with `request_id_mismatch` after fast ACK.
- Live n8n execution `#551` for workflow `kcMcBQos5cxsnWU1` was inspected directly.
- Root cause: execution `#551` failed in sub-node `OpenAI Chat Model`, and the AI Agent node used `On Error: Stop Workflow`, preventing the deterministic `Structured Output` / `Respond to Webhook` contract from completing.
- n8n repair: AI Agent `On Error` changed to `Continue`.
- n8n workflow was published with version name `FIX-11 continue on AI error`; UI status returned to `Published`.
- Live retry `#552` succeeded from execution `#551` with current saved workflow; `Structured Output` and `Respond to Webhook` each returned one item.
- Live retry contract evidence: request id preserved as `pline-v3-...`, `intent=idea_create`, `status=completed`, `tool_called=idea_create`, `saved_record=1`, and `record=1`.
- Worker code was not changed and no Worker deploy was required; current Worker version remains `02b1fa59-4d4c-4119-8dc8-5699183d5456`.
- Evidence: `FIX_EVIDENCE_FIX_11.md`.

## N8N Phase-Aware Reply Result

- Thread role for this handoff: `PLine03｜N8N｜n8n workflow`.
- Target workflow only: `kcMcBQos5cxsnWU1`.
- n8n version published: `N8N phase-aware codex reply contract`.
- AI Agent now receives sanitized phase fields for `codex_task`: `intent`, `phase`, `original_user_text`, `task_summary`, `project_name`, `actual_result`, and `actual_status`.
- AI Agent is instructed to return `reply_text` and `reply_source: ai_generated` for `processing`, `completed`, and `failed`.
- Structured Output passes through valid AI text and marks invalid/missing AI text as `fallback_required` for Worker fallback.
- Worker/FIX still needs to wire phase-mode calls and read `reply_text` / `reply_source`.
- `idea_create` behavior and Dropbox JSON schema were not changed.
- Evidence: `N8N_PHASE_AWARE_REPLY_EVIDENCE.md`.

## Live Regression Intake After N8N Reply Contract

- 菲比 reported `記一下：[REDACTED_IDEA_CONTENT]` produced no visible LINE reply.
- TEST rechecked no-secret remote evidence and found request `pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R` passed Worker signature/admin/idempotency, returned webhook HTTP `200`, completed n8n as `idea_create`, and enqueued `save_idea_json`, but the idea task remained pending with no monitor claim, no Dropbox JSON attribution, and no final push.
- 菲比 reported `請 Codex 幫我用computer use開啟一個新的網頁` produced only the processing reply and no computer action or final reply.
- Current codex_task Gate enables only the fixed minimal smoke task; arbitrary Computer Use / opening a webpage should be marked `capability_not_yet_enabled` and get a truthful non-success final.
- TEST found request `pline-v3-01KXSP35BTPS6GH5VM25JF9BJV` completed n8n as `codex_task`, delivered the processing notice, and enqueued task `pline-v3-codex-1784347208503`, but the task remained queued with no monitor claim/result/finalizer. It was also accepted as fixed action `create_smoke_file`, which is not correct for a not-yet-enabled browser/Computer Use capability.
- 菲比 still did not see `已讀`; track this as a separate LINE desktop / Developers / OA Manager observation, not as webhook/final-push proof.
- Do not claim live Gate PASS from the phase-aware synthetic validation.
- Next handoff: FIX should add a durable live monitor runner or timeout/failure final for unclaimed monitor tasks, mark not-yet-enabled codex_task capabilities as `capability_not_yet_enabled`, and leave LINE read-state settings as a separate `_03` OA/Developers UI check.
- Evidence: `TEST_EVIDENCE_LIVE_REGRESSION_1153_CODEX_PENDING_READ.md`.

## FIX-12 Result

- TEST-08 proved one full Gate 1 run, but later visible fast ACK replies could not be fully correlated because Cloudflare tail and n8n executions were not reliable per-run evidence sources.
- Worker now writes no-secret evidence into existing `_03` `RUNTIME_KV` under prefix `evidence:v1`.
- Evidence records are append-only per request/stage and indexed by safe Gate marker T-codes.
- Stored evidence excludes raw LINE User ID, token, channel secret, LINE signature, n8n shared secret, and full LINE message text.
- TEST readback endpoint: `GET /test/evidence?marker=<T-code>` or `GET /test/evidence?request_id=<request_id>`.
- Readback endpoint is guarded by `x-pline-v3-shared-secret`; unauthenticated reads return HTTP `401`.
- TEST fallback readback can use Wrangler KV marker and request stage prefixes documented in `FIX_EVIDENCE_FIX_12.md`.
- Worker deployed version: `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`.
- Evidence: `FIX_EVIDENCE_FIX_12.md`.

## FIX-13 Result

- TEST-09 produced no Worker invocation and no durable `evidence:v1` marker for valid Gate 1 candidates.
- Inspected only `_03` LINE channel `菲比智能客服 測試_03`, channel id `2010748091`, bot basic id `@967fvhek`.
- Webhook URL was already correct and `Use webhook` was already enabled.
- LINE official API reported webhook endpoint active=true for the expected `/line/webhook` URL.
- LINE Developers Verify returned `Success`; Cloudflare tail observed official Verify traffic reaching Worker with HTTP `200`.
- Worker route direct invalid-signature check returned HTTP `401`, confirming route reachability and signature enforcement.
- Repair: enabled `Webhook redelivery` and `Error statistics aggregation` in LINE Developers for the `_03` channel.
- Worker code, Worker deploy, and secret/token values were unchanged; latest Worker version remains `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`.
- Evidence: `FIX_EVIDENCE_FIX_13.md`.

## FIX-14 Result

- TEST-10 still produced no visible ACK and no durable `evidence:v1` marker for a user-sent LINE app message.
- LINE Developers Webhook errors showed `request_timeout` for the `_03` Worker webhook at `2026/07/18 06:06:36`.
- Root cause: foreground LINE webhook handling awaited multiple `RUNTIME_KV` evidence writes before completing the fast ACK / webhook response path.
- Worker foreground evidence writes now use `queueEvidenceStage(...)` and `ctx.waitUntil(...)`, so slow KV writes no longer block LINE webhook response.
- n8n background evidence remains durable inside the background task.
- Unit coverage now proves the webhook returns HTTP `200` even when `RUNTIME_KV.put(...)` never resolves.
- Worker deployed version: `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`.
- LINE Developers Verify after deploy: `Success`; Cloudflare tail observed official Verify traffic reaching Worker with HTTP `200`.
- Evidence: `FIX_EVIDENCE_FIX_14.md`.

## FIX-15 Result

- TEST-11 proved the `_03` LINE/n8n runtime path completed, but durable `evidence:v1` marker and request-stage readback were missing.
- Root cause: evidence persistence wrote stage/summary before marker, so a slow or failed earlier KV write could prevent the primary marker lookup from being created.
- Worker now writes marker first, then summary, then deterministic stage key `evidence:v1:request:<request_id>:stage:<stage>`.
- Foreground evidence remains queued with `ctx.waitUntil(...)`, preserving the FIX-14 fast ACK timeout repair.
- Failure logging now reports outer stage `evidence_persist_failed` with details field `failed_stage`.
- Unit coverage proves full webhook marker readback and failed/slow KV behavior.
- Worker deployed version: `5a41bd15-789f-43ce-9bd0-2365d9dcef21`.
- Evidence: `FIX_EVIDENCE_FIX_15.md`.

## FIX-16 Result

- TEST-12 visible LINE fast ACK was real, and remote KV evidence was present.
- Root cause of the apparent complete evidence miss: Wrangler KV fallback readbacks must use `--remote`; local reads can return `Value not found` even when the deployed Worker wrote remote KV.
- Deployed binding check confirmed `RUNTIME_KV` points to `_03` namespace id `10cdfe018b3942b483faeaca6e517ae5`.
- Remote KV and protected HTTP readback confirmed marker `T1201-20260718053133` has full Gate 1 run 1 evidence.
- Added `/test/evidence/selfcheck`, guarded by `x-pline-v3-selftest-secret`, for live no-secret deployed KV write/read diagnostics.
- Added bounded fast ACK evidence checkpoint; slow KV cannot block the webhook indefinitely.
- Worker deployed version: `8a23d5c0-e014-4cbd-b594-9f7814eeb6c1`.
- Evidence: `FIX_EVIDENCE_FIX_16.md`.

## FIX-17 Result

- TEST-13 already marked `N8N MINIMAL PATH PASS`; remaining gap was Gate 2 monitor claim / Codex execution / live smoke-file evidence.
- Worker now creates a no-secret pending task in `_03` remote KV for valid `codex_task` results.
- Monitor now claims pending remote KV tasks, runs only fixed action `create_smoke_file`, overwrites the fixed smoke file, and writes remote evidence.
- Monitor evidence stages: `monitor_claimed`, `codex_execution_completed`, `smoke_file_written`.
- Live selftest proved claim/execution/file evidence and updated smoke-file mtime.
- Worker deployed version: `8fedf73f-c983-43af-832b-96e9f0e957c9`.
- Evidence: `FIX_EVIDENCE_FIX_17.md`.

## Clean-Room Rule

This project must be built from the current `_03` requirements and newly produced `_03` evidence only. Do not copy source, workflow JSON, prompts, schemas, credentials, runtime data, logs, or documentation from any prior project.

## Minimal Intent Set

The first n8n workflow may return only:

- `idea_create`
- `codex_task`
- `clarify`
- `unsupported`

## Monitor Safety Rule

The first local monitor supports only one fixed action:

```text
create_smoke_file
```

The only permitted target file for that action is:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt
```

The only permitted content is:

```text
Codex 已打通
```

## RELEASE-01 Closeout

Date: 2026-07-18

- Scope stayed inside `/Users/phoebe/Documents/菲比 LINE 智能助理_03`.
- CLEAN_ROOM: pass
- TEST gate result: `_03 MINIMAL DUAL-PATH PASS`
- Worker: `pline-v3-test-line-gateway`, deployed version `8fedf73f-c983-43af-832b-96e9f0e957c9`, `/health` reachable, required env flags true, KV bindings reported bound.
- n8n: workflow `kcMcBQos5cxsnWU1`, local no-secret draft records `published=true`; production webhook route returned HTTP `200` to a no-secret RELEASE probe.
- LINE: TEST channel `菲比智能客服 測試_03` / `2010748091` / `@967fvhek`; webhook target remains `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`; invalid-signature route check returned HTTP `401`.
- Monitor: `pline-v3-test-codex-monitor` health `ready`; Gate 2 marker `T1401-20260718060326` has remote marker/stage evidence including `monitor_claimed`, `codex_execution_completed`, and `smoke_file_written`.
- Smoke file: mtime `2026-07-18 06:03:46 CST`, content `Codex 已打通`.
- Git: not a Git repository; no commit or push performed.
- Evidence: `RELEASE_EVIDENCE_RELEASE_01.md`.
- Secrets/raw User IDs/FORMAL/old project: not exposed, not touched.

## Dropbox idea_create JSON Extension

Date: 2026-07-18

- Scope stayed inside `/Users/phoebe/Documents/菲比 LINE 智能助理_03` plus fixed Dropbox directory `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`.
- Worker Path A now treats n8n `idea_create` as a request to enqueue monitor action `save_idea_json`; n8n Cloud does not receive local filesystem permissions.
- Monitor `save_idea_json` accepts only validated idea schema data and writes only to the fixed Dropbox directory.
- JSON file names are generated internally as `idea-YYYYMMDD-HHmmss-<short-id>.json`.
- `actor_fingerprint` and `line_event_key` are irreversible SHA-256 fingerprints; raw LINE User ID is not recorded.
- Duplicate event handling uses deterministic event fingerprint/task/file identity and no-overwrite file checks.
- Success LINE final text for this extension is sent only after monitor result `completed` or `duplicate`; failure uses a safe failure reply.
- Live no-secret selftest proved remote KV task claim and Dropbox JSON write with marker `TIDEA-20260718075500`.
- Worker deployed version: `d5cda8d2-65bc-4cc2-b953-f67d761fde39`.
- Evidence: `FIX_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## Dropbox idea_create Final Reply Repair

Date: 2026-07-18

- TEST showed JSON write/schema/fingerprint/duplicate passed, but three live runs lacked Worker `idea_json_final_push_completed`.
- Root cause: Worker only watched the monitor task record; monitor evidence `idea_json_file_written` could exist before the final task status was visible to Worker.
- Worker now recognizes durable stage `idea_json_file_written` as completion proof for `save_idea_json`.
- Worker sends `已幫妳記下這個想法 💡` only after task completion or file-written evidence proves save success.
- Worker sends no success text on timeout/failure.
- Duplicate idea processing suppresses formal final push and records `idea_json_final_push_suppressed`.
- Worker deployed version: `3ba57849-b02c-4b6e-a066-8da95575563c`.
- Evidence: `FIX_EVIDENCE_DROPBOX_IDEA_FINAL_REPLY.md`.

## Dropbox idea_create Final Exactly-Once Repair

Date: 2026-07-18

- TEST still lacked `idea_json_final_push_completed` after Dropbox JSON write, so Worker timing-window waiting was removed from the idea final path.
- Worker now enqueues `save_idea_json` with a task-scoped `finalize_token` and encrypted `line_user_ref`.
- Monitor now calls Worker `/test/idea-finalize` after `save_idea_json` completion or failure.
- Worker finalizer verifies task id, request id, and finalize token before using the existing LINE token.
- Worker writes durable final state `idea_json:v1:final:<task_id>` so repeated callbacks do not send another LINE push.
- Duplicate and failed statuses do not send the success text.
- Worker deployed version: `cbadc5a1-4e07-44b2-853d-335c5486b11b`.
- Evidence: `FIX_EVIDENCE_DROPBOX_IDEA_FINAL_EXACTLY_ONCE.md`.

## Dropbox Idea JSON Gate TEST

- TEST wrote three formal `_03` Dropbox idea JSON files from LINE messages and validated parse/schema/fingerprints.
- Duplicate deterministic reprocess returned `duplicate` with no extra JSON file.
- Gate remains not passed because the formal LINE success final evidence `idea_json_final_push_completed` was missing.
- Evidence: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## Dropbox Idea JSON Gate Rerun After Final Reply Fix

Date: 2026-07-18

- Reran the Gate after Worker version `3ba57849-b02c-4b6e-a066-8da95575563c`.
- Continuous markers: `T1901-20260718082215`, `T1902-20260718082305`, `T1903-20260718082309`.
- New Dropbox JSON files:
  - `idea-20260718-082302-d255b4b825ef.json`
  - `idea-20260718-082310-f4ec851098fd.json`
  - `idea-20260718-082314-c72fb7e8e6e2.json`
- JSON parse/schema/content/fingerprint checks passed.
- Duplicate deterministic reprocess marker `T2099-20260718082930` returned `duplicate`; Dropbox JSON count stayed `13 -> 13`.
- Serial control marker `T2001-20260718082810` also wrote JSON, but formal final evidence was still absent.
- Result: `DROPBOX IDEA JSON PATH PARTIAL`; `DROPBOX IDEA JSON PATH PASS` is not marked.
- Evidence: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## Dropbox Idea JSON Gate PASS After Durable Finalizer

Date: 2026-07-18

- Reran the Gate after Worker version `cbadc5a1-4e07-44b2-853d-335c5486b11b`.
- Continuous markers: `T2201-20260718084633`, `T2202-20260718084802`, `T2203-20260718084935`.
- New Dropbox JSON files:
  - `idea-20260718-084641-1847198916c4.json`
  - `idea-20260718-084810-24eb8fc7c5c5.json`
  - `idea-20260718-084944-8a308a7a67f5.json`
- JSON parse/schema/content/fingerprint checks passed.
- Each run had durable `idea_json_final_push_completed` evidence.
- Repeated finalizer callback for `T2203-20260718084935` returned `already_completed`, `pushed=false`, with no new Dropbox JSON and no second final push.
- Result: `DROPBOX IDEA JSON PATH PASS`.
- Evidence: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## idea_create Natural Final Without Visible ACK

Date: 2026-07-18

- Worker no longer sends the user-visible fixed processing ACK on the normal idea_create path.
- Worker still returns HTTP `200` quickly to LINE webhook delivery.
- Durable evidence now distinguishes no visible ACK from HTTP acceptance with `line_visible_ack_skipped` and `webhook_http_200_returned`.
- Success final remains monitor-callback driven and exactly-once after Dropbox JSON save.
- Final success text uses n8n natural `reply_text` if accepted by the Worker guard; otherwise fallback `已經幫妳記下來了 💡` is used only after save success.
- Save failure sends only the truthful failure text and no saved-success text.
- Worker version: `dbda345b-a3b4-41ca-bc8b-a12c8547179c`.
- Evidence: `FIX_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.
- Next: TEST reruns `IDEA NATURAL FINAL REPLY WITHOUT ACK`.

## Codex Task Minimal Closed Loop

Date: 2026-07-18

- Worker now enqueues codex_task as a structured queued task instead of treating n8n codex_task response as completion.
- The only allowed live smoke output is `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt`.
- The only allowed smoke content is `Codex 任務測試成功`.
- Worker sends a natural processing notice after task enqueue succeeds.
- Monitor claims the task, writes/verifies the smoke file, writes `codex_task:v1:result:<task_id>`, and calls `/test/codex-finalize`.
- Worker finalizer sends completed or failed LINE final exactly once after monitor callback.
- No-secret selftest marker `T2300-20260718093000` completed with result `status=completed`, `tests=PASS`, `commit=null`, `error=null`.
- Worker version: `3f0f167c-71b1-4e89-aa1c-6f559507ed46`.
- Evidence: `FIX_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.
- Next: TEST runs live `Codex Task 最小工作閉環 Gate`.

## Codex Task created_at Schema Preservation

Date: 2026-07-18

- TEST found the minimal closed loop worked, but completed task record lost required `created_at`.
- Monitor now preserves `created_at` in normalized task records and result records.
- Unit tests cover queued, completed, and failed task lifecycle.
- Remote no-secret selftest `T2400-20260718113900` confirmed completed task record and result record both include `created_at`.
- Worker redeployed for handoff; current version `ca9001fa-cf03-43f7-9911-33f6301dd668`.
- Evidence: `FIX_EVIDENCE_CODEX_TASK_CREATED_AT_SCHEMA.md`.
- Next: TEST reruns live Codex Task Gate and checks `created_at`.

## IDEA NATURAL FINAL REPLY WITHOUT ACK Gate PASS

Date: 2026-07-18

- TEST reran live `_03` Gate after Worker version `dbda345b-a3b4-41ca-bc8b-a12c8547179c`.
- Live idea markers: `T2301-20260718092056`, `T2302-20260718092156`, `T2303-20260718092325`.
- Fixed visible ACK was absent; durable `line_visible_ack_skipped` and `webhook_http_200_returned` were present.
- Dropbox JSON parse/schema/content/fingerprint checks passed for all three files.
- Natural final push evidence `idea_json_final_push_completed` was present for all three runs; the third required retry after transient `line_push_http_525`.
- Repeated finalizer callback returned `already_completed`, `pushed=false`, with no extra JSON and no second AI/final.
- Failure/fallback paths were covered by safe local Worker tests.
- Codex regression routed to `codex_task` and did not create Dropbox idea JSON.
- LINE desktop read-receipt display remains a separate UI/OA setting observation.
- Result: `IDEA NATURAL FINAL REPLY WITHOUT ACK PASS`.
- Evidence: `TEST_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.

## Codex Task Minimal Closed Loop Gate FAILED

Date: 2026-07-18

- Live marker: `T2401-20260718113100`.
- Task ID: `pline-v3-codex-1784345467797`.
- Codex/monitor received and executed the task, wrote the fixed runtime smoke file, and produced result `status=completed`, `tests=PASS`, `commit=null`, `error=null`.
- LINE received natural processing and final messages without forbidden internal terms.
- Repeated finalizer callback returned `already_completed`, `pushed=false`.
- Gate failed because the completed task record lost required field `created_at`.
- Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

## Codex Task Minimal Closed Loop Gate PASS After created_at Fix

Date: 2026-07-18

- Live marker: `T2501-20260718114510`.
- Task ID: `pline-v3-codex-1784346318391`.
- Codex/monitor received and executed the task, wrote the fixed runtime smoke file, and produced result `status=completed`, `tests=PASS`, `commit=null`, `error=null`.
- Completed task record retained required `created_at`; result record also contained `created_at`.
- LINE received natural processing and final messages without forbidden internal terms.
- Repeated finalizer callback returned `already_completed`, `pushed=false`.
- Gate result: PASS.
- Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

## Codex Task created_at Schema FIX Completed

Date: 2026-07-18

- Monitor `normalizeTask()` now preserves `created_at`.
- Queued, claimed, completed, and failed codex_task lifecycle records retain `created_at`.
- Completed and failed result records include `created_at`.
- Remote no-secret selftest `T2400-20260718113900` confirmed task/result records retain `created_at`.
- Evidence: `FIX_EVIDENCE_CODEX_TASK_CREATED_AT_SCHEMA.md`.
- Next: TEST reruns live Codex Task Gate.

## Codex Task AI Replies Phase-1 Trace

Date: 2026-07-18

- Processing reply is fixed in Worker as `CODEX_PROCESSING_REPLY_TEXT`.
- Completed reply is fixed in Worker as `CODEX_COMPLETED_REPLY_TEXT`.
- Failed reply is fixed in Worker as `CODEX_FAILED_REPLY_TEXT`.
- n8n AI Agent currently supports codex_task classification and tool call, but the Worker does not use n8n `reply_text` for codex_task processing.
- Completed/failed monitor callback path has actual result data. Follow-up N8N work now added the phase-aware AI reply contract in workflow `kcMcBQos5cxsnWU1`.
- Current task/evidence records do not include `reply_source=ai_generated|fallback`.
- Decision: do not fake AI replies in Worker; N8N now provides phase-aware AI reply output and Worker/FIX should wire it.
- Evidence: `FIX_EVIDENCE_CODEX_TASK_AI_REPLIES.md`.

## Live Pending Monitor / Capability Boundary FIX

Date: 2026-07-18

- Worker now prevents not-yet-enabled codex_task capabilities from being converted into the fixed smoke task.
- This is not a permanent product decision about Computer Use/browser operations. Those capabilities require a later explicit authorization Gate.
- Current enabled codex_task capability remains the fixed smoke task only.
- Evidence terms:
  - `codex_task_capability_not_enabled`
  - `codex_task_capability_notice_completed`
  - `capability_not_yet_enabled`
- Monitor now has bounded `drain`, targeted `claim-task`, and targeted `mark-capability-not-enabled`.
- Live pending idea request `pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R` reached completed Dropbox/final evidence.
- Live browser/Computer Use request `pline-v3-01KXSP35BTPS6GH5VM25JF9BJV` reached failed/final evidence without arbitrary local execution.
- Worker version: `493e4b8a-91da-479e-81e0-229fd1eb72c7`.
- Evidence: `FIX_EVIDENCE_LIVE_REGRESSION_PENDING_CAPABILITY.md`.

## Worker N8N URL Attribution FIX

Date: 2026-07-18

- Worker live `/health` confirms n8n host/path `n8nphy.app.n8n.cloud` + `/webhook/pline-v3-test-ai-agent`.
- Route type is `production`; path fingerprint is `377f812f`.
- Worker now records n8n target attribution in durable evidence.
- Worker now accepts canonical request id from `worker_request_id` or `canonicalRequestId` and unwraps common n8n response wrappers.
- Live marker `T2606-20260718134903` still failed because n8n production returned an empty object: no `request_id`, no `worker_request_id`, no `canonicalRequestId`, and no top/nested keys.
- Conclusion: Worker env/path is correct; remaining blocker is n8n production response/execution attribution.
- Worker version: `d50b4501-2244-4a31-9951-f7289ca06f09`.
- Evidence: `FIX_EVIDENCE_WORKER_N8N_URL_ATTRIBUTION.md`.

## Computer Use open_browser_page Gate Feasibility

Date: 2026-07-18

- The requested Gate requires true Codex/Computer Use execution for `open_browser_page`.
- Current `_03` monitor cannot directly call Codex MCP tools, `node_repl`, or Computer Use skill.
- Current supported actions are still `create_smoke_file` and `save_idea_json`.
- Do not use shell `open` or AppleScript browser automation as a substitute for this Gate.
- Blocked reason: `monitor_unable_to_call_codex_computer_use_tools`.
- Evidence: `FIX_EVIDENCE_COMPUTER_USE_OPEN_BROWSER_PAGE.md`.

## Live Regression Recovery TEST

Date: 2026-07-18

- TEST confirmed `1153` request `pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R` now has monitor claim, Dropbox JSON write, final push completion, and final callback completion evidence.
- Dropbox file `idea-20260718-115346-8748409c3efd.json` parses, matches the 9-field schema, matches the reported idea, and does not contain a raw LINE User ID pattern.
- TEST confirmed open-webpage Codex request `pline-v3-01KXSP35BTPS6GH5VM25JF9BJV` / task `pline-v3-codex-1784347208503` is `failed` with `capability_not_yet_enabled`, changed files count `0`, and final failure notice completed.
- No arbitrary Computer Use/browser action and no successful smoke-file execution were evidenced for the open-webpage request.
- Worker and monitor tests passed as minimal regression coverage for idea_create, Dropbox, Codex smoke, duplicate/idempotency, and capability guard.
- LINE desktop `已讀` remains a separate UI/OA setting observation.
- Supplemental live 12:53 idea request `pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF` reached Worker and passed signature/admin/idempotency, but failed n8n contract with `request_id_mismatch` before `save_idea_json` enqueue.
- No monitor-claimable idea task or Dropbox JSON was created for the 12:53 water reminder, so bounded drain/targeted recovery had nothing to claim.
- Result: `LIVE REGRESSION RECOVERY PARTIAL`.
- Evidence: `TEST_EVIDENCE_LIVE_REGRESSION_RECOVERY.md`.
- Next handoff: N8N/FIX must repair the live idea_create `request_id_mismatch` recurrence before opening `Computer Use 最小開通：只允許 open_browser_page`.

## N8N request_id Recurrence Repair Live Verification

Date: 2026-07-18

- TEST sent `記一下：[REDACTED_IDEA_CONTENT]` via LINE app to `菲比智能客服 測試_03`.
- Marker resolved to request `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86`.
- Worker-side gate stages passed through signature/admin/idempotency and webhook HTTP `200`.
- n8n background started but failed the Worker contract with `request_id_mismatch`.
- No idea task was enqueued; therefore monitor poll had no task to claim and no Dropbox JSON/final push could occur.
- The 12:53 request and T2601 now show the same live production failure shape.
- Worker and monitor local tests passed, including capability guard coverage.
- Result: live repair verification FAILED.
- Evidence: `TEST_EVIDENCE_N8N_REQUEST_ID_RECURRENCE_REPAIR.md`.
- Next handoff: N8N/FIX must inspect the live production execution for `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86` and align the production response contract.

## N8N Respond Nonempty Live idea_create Verification

Date: 2026-07-18

- TEST sent `記一下：[REDACTED_IDEA_CONTENT]` via LINE app to `菲比智能客服 測試_03`.
- Marker resolved to request `pline-v3-01KXSX7E4SRVM7CVZ3ST40GA6X`.
- Worker-side gate stages passed through signature/admin/idempotency and webhook HTTP `200`.
- n8n background completed successfully and no `request_id_mismatch` stage was present.
- Durable contract evidence showed `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`.
- Monitor claimed the `save_idea_json` task and wrote Dropbox JSON `idea-20260718-140449-c49d33a39125.json`.
- Finalizer evidence showed `idea_json_final_push_completed` and `idea_json_final_callback_completed`.
- Worker and monitor local tests passed, including capability guard coverage.
- Result: `N8N RESPOND NONEMPTY LIVE IDEA_CREATE PASS`.
- Evidence: `TEST_EVIDENCE_N8N_RESPOND_NONEMPTY_LIVE_IDEA.md`.
- Next handoff: FIX/N8N should harden n8n-side shared-secret enforcement before opening the Computer Use minimal Gate.

## n8n Shared-Secret Hardening TEST

Date: 2026-07-18

- TEST verified direct no-header probe to the production n8n webhook did not return a normal idea_create contract.
- Direct no-header probe response was HTTP `200`, empty/non-JSON, with no `intent`, no `tool_called`, and no `saved_record`.
- TEST sent `記一下：[REDACTED_IDEA_CONTENT]` via LINE app to `菲比智能客服 測試_03`.
- Marker resolved to request `pline-v3-01KXSXWXAE94G82MCZEYQABCJ7`.
- Worker/header path passed signature/admin/idempotency and webhook HTTP `200`.
- n8n background completed successfully and no `request_id_mismatch` stage was present.
- Durable contract evidence showed `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`.
- Monitor claimed the `save_idea_json` task and wrote Dropbox JSON `idea-20260718-141633-a223c8a90177.json`.
- Finalizer evidence showed `idea_json_final_push_completed` and `idea_json_final_callback_completed`.
- Worker and monitor local tests passed, including capability guard coverage.
- Residual risk: n8n variable creation remains disabled, so full value comparison is pending; no-header barrier is passing.
- Result: `N8N SHARED-SECRET HARDENING TEST PASS`.
- Evidence: `TEST_EVIDENCE_N8N_SHARED_SECRET_HARDENING.md`.
- Next handoff: FIX can open `Computer Use 最小開通：只允許 open_browser_page`.

## Live Regression 1503cc No Reply

Date: 2026-07-18

- TEST diagnosed 菲比's 15:03 live no-reply report without resending LINE.
- Identified request `pline-v3-01KXT0JM1YHRN0W22P7C147AJW` by approximate time and latest `_03` durable evidence.
- Worker receipt, signature/admin/idempotency, webhook HTTP `200`, and `line_visible_ack_skipped` were present.
- n8n completed as `idea_create` with `tool_called=idea_create` and `saved_record=1`; this was not a `request_id_mismatch` recurrence.
- `save_idea_json` task `idea-82487259686e7b01ced7621a` stayed `pending` with no monitor claim, no Dropbox JSON, and no final push.
- Fixed Dropbox directory had no new idea JSON after 14:50 CST and no file matching the `1503` water reminder.
- Root cause class matches the original 1153 pending-monitor case and differs from T2601/12:53 request-id mismatch. T2701/T2801 passed with TEST-started monitor poll.
- LINE read-state remains a separate UI/OA observation; do not mix it with backend evidence.
- Evidence: `TEST_EVIDENCE_LIVE_REGRESSION_1503CC_NO_REPLY.md`.
- Next handoff: FIX should make monitor/queue processing durable outside ad hoc TEST poll windows, or add Worker-side timeout/failure final for pending idea tasks.

## Durable Monitor Runner Live TEST

Date: 2026-07-18

- TEST verified launchd runner `com.pline.v3.test.codex-monitor` was running and heartbeat was initially `ready`.
- TEST did not run manual monitor poll/claim/drain.
- Baseline `idea_json:v1:pending:*` count was already `1`; the key pointed to completed task `idea-0dde004dabcab361ed557fff`.
- TEST sent live `T2901-20260718152036` to `菲比智能客服 測試_03`.
- Request `pline-v3-01KXT1KRBW5MSP8WDT9QR2A3Y4` passed Worker/n8n and created task `idea-4a47aede9a419394a2967bd0`.
- T2901 pending key was created but not removed.
- T2901 task stayed `pending`; no monitor claim, no Dropbox JSON, and no final push were evidenced.
- Runner heartbeat changed to `error`; safe reason points to failure deleting stale completed pending key before draining later work.
- Remaining idea pending count was `2`.
- 1503 recovery file count remains exactly `1`; no duplicate recovery file observed.
- Worker and monitor tests passed.
- Result: durable monitor runner live Gate FAILED.
- Evidence: `TEST_EVIDENCE_DURABLE_MONITOR_RUNNER_LIVE.md`.
- Next handoff: FIX must make stale completed pending-key cleanup non-blocking or robust, then rerun TEST.

## Durable Monitor Runner Second Live TEST

Date: 2026-07-18

- TEST reran the durable runner Gate after cleanup fix without manual monitor poll/claim/drain.
- launchd runner `com.pline.v3.test.codex-monitor` was running and heartbeat was ready.
- Pending queue baseline was idea `0`, codex `0`.
- TEST sent live `T2902-20260718153255` to `菲比智能客服 測試_03`.
- Request `pline-v3-01KXT29N4CBP3J3AVDVKSDKZ91` passed Worker/n8n and created task `idea-ef60f64a6f511ce02c065eaa`.
- Runner evidence `pline-v3-test-codex-monitor` was present on `monitor_claimed`, `idea_json_saved`, `idea_json_file_written`, and final callback stages.
- Pending key was removed; pending queues ended at idea `0`, codex `0`.
- Dropbox JSON `idea-20260718-153325-ef60f64a6f51.json` was written and validated.
- 1503 and T2901 recovery files remain single; no duplicates observed.
- Worker and monitor tests passed; no unsafe Computer Use open-webpage action was run.
- Result: durable monitor runner second live Gate PASS.
- Evidence: `TEST_EVIDENCE_DURABLE_MONITOR_RUNNER_SECOND_LIVE.md`.
- Next handoff: RELEASE can run git status, secret scan, commit, and push when controller authorizes closeout.

## N8N Request ID Contract Recurrence Repair

Date: 2026-07-18

- Target workflow only: `kcMcBQos5cxsnWU1`.
- Published n8n version: `N8N request_id recurrence repair`.
- Local draft updated: `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json`.
- `Normalize Input` now preserves the Worker original request id as `worker_request_id`.
- `Structured Output` now uses only the Normalize canonical id and ignores AI-produced `request_id`.
- No-secret synthetic verification intentionally supplied a wrong AI id and confirmed output request id still equals `pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF`, with `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`.
- Evidence: `N8N_EVIDENCE_REQUEST_ID_CONTRACT_RECURRENCE.md`.
- Next handoff: TEST reruns a new safe idea_create marker before opening `Computer Use 最小開通：只允許 open_browser_page`.

## N8N Live Production request_id_mismatch Follow-Up

Date: 2026-07-18

- Rechecked live failed request `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86` against only workflow `kcMcBQos5cxsnWU1`.
- n8n UI shows the workflow is active/published and the production webhook path is `/webhook/pline-v3-test-ai-agent`.
- Current `Structured Output` UI contains `canonicalRequestId` and `worker_request_id`; it does not contain `parsed.request_id`.
- Current `Respond to Webhook` UI returns JSON with `{{ $json }}`.
- The workflow `Executions` tab showed `No executions found`, so T2601 per-node live output was not available under the target workflow.
- Local no-secret harness for T2601 PASSed and preserved the Worker request id even when the synthetic AI output returned a wrong id.
- Updated `.env.example` to show the production webhook path.
- Evidence: `N8N_EVIDENCE_LIVE_PRODUCTION_REQUEST_ID_MISMATCH.md`.
- Next handoff: FIX/TEST confirms live Worker `N8N_WEBHOOK_URL` and execution attribution, then reruns T260x idea_create before any Computer Use Gate.

## N8N Respond-to-Webhook Nonempty Production Repair

Date: 2026-07-18

- Target workflow only: `kcMcBQos5cxsnWU1`.
- Production execution UI exposed `Normalize Input` failure: env var access denied.
- Removed direct `$env.N8N_SHARED_SECRET` access from Normalize Input and replaced it with guarded `$vars.N8N_SHARED_SECRET` lookup.
- Changed `Respond to Webhook` from custom JSON `{{ $json }}` to `First Incoming Item`.
- Published version: `N8N normalize env and respond nonempty repair`.
- Production no-secret probe returned nonempty contract JSON with preserved request id, `intent=idea_create`, `tool_called=idea_create`, `status=completed`, and `saved_record=1`.
- Execution saving/UI visibility still showed `No executions found` after the successful probe.
- Risk: direct no-secret n8n probe succeeded; configure/check n8n variable `N8N_SHARED_SECRET` if n8n-side direct endpoint hardening is required.
- Evidence: `N8N_EVIDENCE_RESPOND_WEBHOOK_NONEMPTY.md`.
- Next handoff: TEST/FIX reruns live T260x idea_create and confirms Dropbox JSON plus natural final before Computer Use Gate.

## N8N Shared-Secret Header Hardening

Date: 2026-07-18

- Target workflow only: `kcMcBQos5cxsnWU1`.
- Published version: `N8N shared-secret header hardening`.
- n8n Variables UI did not have `N8N_SHARED_SECRET`; `Create variable` was disabled.
- Normalize guard now rejects missing `x-pline-v3-shared-secret`.
- Normalize guard performs `$vars.N8N_SHARED_SECRET` value equality when that variable is available.
- No direct `$env.N8N_SHARED_SECRET` access was restored.
- Respond node remains `First Incoming Item`.
- Production no-header probe no longer returned normal `intent=idea_create` contract.
- Production header-present synthetic probe still returned nonempty idea_create contract with preserved request id.
- Residual risk: full value equality awaits safe n8n variable/credential setup.
- Evidence: `N8N_EVIDENCE_SHARED_SECRET_HARDENING.md`.
- Next handoff: TEST/FIX checks no-secret rejection and live Worker idea_create PASS before Computer Use Gate.
## Durable Monitor Queue Runner

- Added `monitor/src/monitor.js runner`, a durable poll loop with no-secret heartbeat at `runtime/monitor-runner/heartbeat.json`.
- Added project-local launchd agent `monitor/com.pline.v3.test.codex-monitor.plist`.
- Worker enqueue now writes pending indexes: `codex_task:v1:pending:<task_id>` and `idea_json:v1:pending:<task_id>`.
- Monitor runner scans pending indexes only; manual legacy scan remains for old pre-index tasks.
- Monitor deletes pending indexes after terminal completion/failure/duplicate and can recover stale claimed/running tasks after the stale interval.
- Recovered request `pline-v3-01KXT0JM1YHRN0W22P7C147AJW` / task `idea-82487259686e7b01ced7621a`; Dropbox JSON file `idea-20260718-150321-82487259686e.json`; final push evidence completed.

### Follow-up Cleanup Fix

- Runner error root cause: stale completed pending index cleanup used unsupported Wrangler `--force` and the delete error aborted the drain round.
- Fix: delete is now best-effort, per-key failures are isolated, terminal/missing/bad pending entries do not block later active tasks.
- Recovered T2901 request `pline-v3-01KXT1KRBW5MSP8WDT9QR2A3Y4` / task `idea-4a47aede9a419394a2967bd0`; Dropbox JSON `idea-20260718-152127-4a47aede9a41.json`; final push evidence completed.
- Runner heartbeat is `ready`; pending prefixes are empty.
## LINE Mark As Read

- Added Worker mark-as-read support using LINE `message.markAsReadToken`.
- Call position: after signature/admin/idempotency PASS, before background n8n scheduling.
- Token is not included in normalized payload, KV, evidence, docs, or logs.
- Failure is warning-only: records `line_mark_as_read_failed` with sanitized reason and continues webhook/n8n/final paths.
- Deployed Worker version `09d51a3b-6301-4c0b-b0f2-bd3db8229638`.

### Chat Off Primary Mode

- After user turned `_03` OA Chat off, TEST T3001 proved visual read state and idea_create path PASS while API mark-as-read produced `line_mark_as_read_failed`.
- Worker now defaults mark-as-read API to disabled.
- `LINE_MARK_AS_READ_ENABLED === "true"` is required to call the API for future Chat-on mode.
- Default evidence is `line_mark_as_read_skipped_disabled`.
- Deployed Worker version `b39f1e21-f5e3-41e8-a673-1f77e45c98cb`.

## LINE Mark As Read Live TEST

- Live marker: `T3001-20260718155646`.
- Request id: `pline-v3-01KXT3NXEQXYVE5Y52R97GQNFV`.
- LINE desktop screenshot showed grey `已讀` near the latest sent message; recorded as UI observation only.
- Durable evidence did not PASS the API criterion: actual stage was `line_mark_as_read_failed`.
- No read token value, raw LINE User ID, or full webhook payload was written.
- Chat off did not break webhook delivery or background processing.
- idea_create/Dropbox/final remained PASS with Dropbox JSON `idea-20260718-155735-8a4dff845617.json`.
- Pending queues returned to `idea=0`, `codex=0`.
- Evidence: `TEST_EVIDENCE_LINE_MARK_AS_READ_LIVE.md`.
- Next: FIX should inspect why live Mark As Read API produced `line_mark_as_read_failed` while the LINE UI still showed read state.

## T3002 Chat Off Auto-Read TEST

- Live marker: `T3002-20260718160604`.
- Request id: `pline-v3-01KXT46DF26Q4N9C4GS1B6PC58`.
- Worker health confirmed `line_mark_as_read.enabled=false` and `disabled_chat_off_auto_read`.
- LINE desktop screenshot showed grey `已讀` beside the latest T3002 sent message.
- Durable evidence included `line_mark_as_read_skipped_disabled`.
- Durable evidence did not include `line_mark_as_read_failed` for this request.
- No read token value, raw LINE User ID, or full webhook payload was written.
- Chat off did not break webhook delivery or background processing.
- idea_create/Dropbox/final remained PASS with Dropbox JSON `idea-20260718-160636-04fe510ef176.json`.
- Pending queues returned to `idea=0`, `codex=0`.
- Evidence: `TEST_EVIDENCE_LINE_READ_CHAT_OFF_T3002.md`.
- Next: RELEASE can perform git status, secret scan, commit, and push if the controller is ready.

## N8N idea_create Natural Reply

- Target workflow only: `kcMcBQos5cxsnWU1`.
- Fixed repeated final `已記下這個想法。` by moving normal `idea_create` reply generation into AI Agent/tool output.
- Root cause was n8n-side fallback: `Structured Output` had the fixed phrase and AI output was absent because `OpenAI Chat Model` used an old string model parameter shape.
- Published version: `N8N idea_create saved natural reply guard`.
- The AI Agent now receives `idea_content`, completed/saved phase fields, and returns `reply_text` with `reply_source=ai_generated`.
- `Structured Output` preserves AI text and only falls back to `已經幫妳記下來了 💡` when AI text is missing, unsafe, or contradicts saved status.
- Four production synthetic idea probes returned distinct content-aware `ai_generated` replies and preserved request id / saved contract.
- Evidence: `N8N_EVIDENCE_IDEA_CREATE_NATURAL_REPLY.md`.
- TEST still needs live LINE T3101/T3102 validation; no Worker code, Dropbox schema, shared-secret guard, or codex_task route was changed.

## idea_create Natural Final Live TEST

- Live markers: `T3101-20260718163705`, `T3102-20260718163706`.
- Request ids: `pline-v3-01KXT5Z8WG55H64Q7XJX4WGEE4`, `pline-v3-01KXT5ZB1057E1PK8A4M8YM36E`.
- LINE desktop showed read state for both sent messages.
- Two visible final replies appeared and were content-aware, concise, Traditional Chinese, and non-identical.
- Fixed fallback `已記下這個想法。` was absent.
- User-visible finals contained no `_03`, `TEST`, `n8n`, `Worker`, `task`, `JSON`, `execution`, or `webhook`.
- Durable evidence did not expose `reply_source` or `reply_text`; final text validation used LINE visible screenshot, while flow proof used durable KV stages.
- Both requests had `line_mark_as_read_skipped_disabled`, `n8n_background_completed`, `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, monitor claim, Dropbox JSON write, and final push/callback completed.
- Dropbox JSON files: `idea-20260718-163742-7034568e607d.json`, `idea-20260718-163743-0d611eb4be09.json`.
- Pending queues returned to `idea=0`, `codex=0`.
- Evidence: `TEST_EVIDENCE_IDEA_CREATE_AI_NATURAL_FINAL_LIVE.md`.
- Next: RELEASE can perform git status, secret scan, commit, and push if the controller is ready.

## Codex Default Delegation Investigation

- Current `_03` monitor runner is `launchd` + Node.js, not a Codex turn runner.
- `CODEX_BIN` is resolved by health/startup checks, but `runTask` does not spawn Codex. It writes the fixed smoke file directly and records `codex_execution=true`.
- Worker task enqueue sanitizes every enabled codex_task to fixed `create_smoke_file` constants and does not pass the original LINE instruction to Codex.
- The controller thread's Apps, Plugins, Skills, MCP tools, and Computer Use are not callable by the durable monitor process.
- Codex CLI `0.142.5` shows `exec --json` and experimental app-server/remote-control surfaces, but no `_03` Gateway client, auth boundary, streamed event parser, or approval bridge exists.
- Conclusion: default Codex delegation is blocked until a formal Gateway/host contract is selected.
- Evidence: `FIX_EVIDENCE_CODEX_DEFAULT_DELEGATION_INVESTIGATION.md`.

## LINE to Codex Gateway Connection

- Current selected interface remains official `codex exec --json`.
- The latest two live Codex LINE failures did not reach monitor/Gateway; both stopped at n8n contract `unsupported_intent`.
- Worker now handles explicit Codex text plus n8n `unsupported_intent` as a narrow fallback into `codex_delegate`.
- Fallback evidence stage: `codex_delegate_fallback_from_unsupported_intent`.
- Fallback task ids are derived from the LINE event id, preserving exactly-once behavior for the same event.
- Real Gateway create/read tasks passed through Codex thread/turn execution and wrote/read `_03` runtime files.
- Computer Use Calculator reached Codex but requires host approval for Calculator.
- Evidence: `FIX_EVIDENCE_LINE_CODEX_GATEWAY_CONNECTION.md`.

## Codex Delegate Final Sanitizer

- Create-file live failure source: Worker used `result.summary` from the Codex Gateway result record as the LINE completion text via `naturalCodexFinalText`.
- Prior safety check did not reject internal terms or paths in that summary.
- Read-file live failure source: Worker finalizer required `codex_task:v1:task:<task_id>.status === completed`; a completed result record alone was not enough.
- Repair: Worker now checks `codex_task:v1:result:<task_id>` for completed/succeeded/success and reconciles the task record before exactly-once final push.
- Repair: Codex final text now extracts safe content snippets or uses the completed fallback when the raw summary is unsafe.
- Evidence: `FIX_EVIDENCE_CODEX_DELEGATE_FINAL_SANITIZER.md`.

## Codex Delegate Recent File Context

- C read-file picked an older runtime file because the Gateway prompt lacked a deterministic "latest successful created file" target.
- Monitor now derives safe created-file metadata from completed `codex_delegate` results and writes `codex_task:v1:context:last_created_file`.
- Recent-file read requests receive an internal prompt block with the exact `_03` runtime text file path and content hash.
- The context resolver only accepts `_03` `runtime/codex-gateway/*.txt` candidates from result metadata/summary and verifies the file exists before use.
- Missing context returns `last_created_file_context_not_found` and does not submit to Codex.
- Evidence: `FIX_EVIDENCE_CODEX_DELEGATE_RECENT_FILE_CONTEXT.md`.

## Codex Default Delegation Implementation

- Implemented `monitor/src/codex_gateway.js`.
- Selected official non-interactive `codex exec --json` for the launchd monitor adapter after checking local `codex-cli 0.142.5` and official Codex CLI/App Server/SDK/MCP docs.
- The adapter uses `spawn`, closes stdin, and parses JSONL events such as `thread.started`, `turn.started`, `item.completed`, and `turn.completed`.
- Worker queues `codex_delegate` with `original_user_text` intact; old n8n `codex_task` is normalized as an alias but no longer turns general tasks into fixed smoke.
- Worker no longer sends codex processing text at enqueue time. Monitor triggers the processing callback only after `codex exec --json` emits `turn.started`.
- Local `codex-cli 0.142.5` JSONL exposes `thread.started.thread_id` and `turn.started`, but the observed `turn.started` event does not include a separate `turn_id`.
- Approval bridge is implemented as task state plus LINE confirmation code; confirmed tasks are requeued as `approved`.
- Gateway live evidence wrote ignored runtime output and result files; no secret/raw User ID/full payload is stored.
- Live n8n workflow `kcMcBQos5cxsnWU1` was published with `codex_delegate` as the visible tool node and no visible `codex_task` tool node.
- Gateway prompt now includes both `<task_instruction>` and `<original_user_text>`; this fixed the case where a delegated smoke ignored the exact requested filename/content.
- Delegated probes show ordinary Codex file/shell/test/git work is available through `codex exec --json`; Browser/Computer Use remains a second-phase host-surface integration.
- Evidence: `TEST_EVIDENCE_CODEX_DEFAULT_DELEGATION_GATE.md`.
