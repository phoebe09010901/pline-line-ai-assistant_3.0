# CODEX_NOTES

## Calendar Core stable release checkpoint — 2026-07-22

- Fixed RELEASE thread/turn: `019f8709-63a4-7482-b804-ddea7b8940cf` / `019f892c-0152-7353-8449-85879a394064`.
- Checkpoint: `checkpoints/CALENDAR_CORE_STABLE_CHECKPOINT_20260722.md`.
- Current runtime: n8n `kcMcBQos5cxsnWU1` / `bc6483ba-7c06-43db-91b9-88d53c07dfe3`; Worker `5aba605e-a31d-4a4f-b9ed-de301895f2cd`, active 100%.
- Bare Delete offline test now defaults to `N8N_WORKFLOW_PLINE_V3_CALENDAR_DELETE_TOMBSTONE_FIX_LUNA_IMPORT.json`; test-source correction only.
- Closeout regression: Worker 130/130; Create 18/18; Search 38/38; Update PASS; Delete PASS; Delete readback 6/6; Memo 85/85.
- Saved snapshot is credential-redacted and checksum-verified. OpenAI stays `gpt-5.6-luna`, temperature `0.1`, credential reference unchanged.
- Never upgrade isolated retry proof: `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed`.
- Resume only after branch/tag/dirty-scope verification. Calendar Core is frozen; later features need a separate Gate.

## Calendar Delete final false-negative implementation fix - 2026-07-22

- Gate remains `CALENDAR_DELETE_GATE`; task `implementation_fix`; failure round 1; formal re-test pending.
- Root cause confirmed in deployed execution: successful Google Delete produced an event tombstone with `status=cancelled`; the n8n verifier only recognized 404/not-found and therefore returned `calendar_delete_readback_still_exists`.
- Repair is bounded to Delete precheck/absence mapping. Cancelled tombstone is success only after `safe_to_delete` or explicit `readback_only`; initial missing/changed candidate remains fail closed.
- Workflow diff: two Delete nodes, zero connection changes, 161/160 retained. Frozen OpenAI core, credentials, primary backend, Memo and Create/Search/Update are preserved.
- Local proof: readback 6/6, Worker 130/130, Calendar/Memo regression PASS; implementation external effects 0.
- Published `bc6483ba-7c06-43db-91b9-88d53c07dfe3`; Worker unchanged, Deploy not required. No commit/push/checkpoint.
- Fresh formal A/B handoff: existing `PLine｜TEST` thread `019f8709-3547-71f1-93e6-2807a4b3f51d`.
- `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed`.
- Full evidence: `CALENDAR_DELETE_GATE_FALSE_NEGATIVE_FIX_REPORT_20260722.md`.

## Calendar Delete Gate implementation - 2026-07-22

- Gate: `CALENDAR_DELETE_GATE`; status `implementation_completed_pending_formal_test`; Calendar Core checkpoint not started.
- Delete is candidate-bound to the current actor Search snapshot or a single unique natural target, with TTL 600, public summary, explicit confirmation/cancel, original-candidate guard, terminal absence readback and readback-only ambiguous recovery.
- Unbounded Calendar deletion is disabled. No result, ambiguity, actor mismatch, expiry, snapshot/candidate change and missing candidate fail closed with effect 0.
- Calendar/Memo shorthand routing was isolated after one repair cycle; fresh integrated Worker 130/130 and Delete focused 12/12 PASS.
- OpenAI core remains user-controlled and preserved: `gpt-5.6-luna`, temperature `0.1`, existing credential reference. Calendar backend remains primary/default.
- n8n Published `29a73423-26f1-41dd-9398-bc2a62ed77b9`; Worker deployment `5aba605e-a31d-4a4f-b9ed-de301895f2cd`; local n8n Calendar/Memo regressions PASS.
- Formal LINE Delete TEST is pending. No Calendar fixture, external Calendar mutation, LINE send, commit, push or checkpoint occurred here.
- `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed`.
- Full evidence: `CALENDAR_DELETE_GATE_IMPLEMENTATION_REPORT_20260722.md`.

## Calendar Update Gate implementation - 2026-07-22

- Gate: `CALENDAR_UPDATE_GATE`; status `implementation_completed_pending_formal_test`.
- Update is candidate-bound to the current actor Search snapshot or a single unique keyword lookup, with TTL 600, explicit confirmation/cancel, original-candidate guard and readback-only ambiguous recovery.
- Supported changes: title, date, start, end, duration and location. Public replies expose no internal identifiers.
- OpenAI core remains user-controlled and preserved: `gpt-5.6-luna`, temperature `0.1`, existing credential reference. Calendar backend remains primary/default.
- n8n Published `a2002f5e-1cbf-40a8-b79c-0c6a514d3a3f`; Worker deployment `d12384eb-98a2-416a-bc7a-3fb9707e3891`; local integrated regression 118/118 PASS.
- Formal LINE Update TEST is pending. No Calendar fixture, LINE send, commit, push, Delete implementation or checkpoint occurred here.
- `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed`.
- Full evidence: `CALENDAR_UPDATE_GATE_IMPLEMENTATION_REPORT_20260722.md`.

## Calendar Create Follow-up Continuity Fix - 2026-07-22

- Gate: `CALENDAR_CREATE_FOLLOWUP_CONTINUITY_FIX`; implementation Worker turn `019f8858-871f-78c0-b829-92ecad131282`; fresh TEST turn `019f8872-1f35-7de2-9b0b-16e78d93c7a5`.
- Root cause and repair: missing same-actor pending context before general routing; partial draft now saves before clarification under a stable hashed actor key with TTL 600, preserves title/start, merges date/duration/end, and clears on success/cancel/expiry.
- Formal marker `CALENDAR-CREATE-FOLLOWUP-20260722-NEWFIX-141153`: A/B/C and D cancel PASS, Google primary readback PASS, cleanup PASS, post-cleanup active count 0, existing Calendar effect 0.
- Case E remains evidence-layer qualified: isolated retry 15/15 PASS, duplicate Calendar write 0, duplicate LINE final 0; live identical webhook replay was unsafe and not run.
- Memo offline regression 39/39 PASS; production Memo effect 0. No internal identifiers appeared in LINE.
- Published n8n `fe757d90-b40b-4234-af4d-6162aded24a4`; Worker deployment `814fcaca-2040-4323-aced-6e176073c178`; sanitized export SHA-256 `141aad725558c5b8e431db639daf281efacf83e8331d8260180f87ea2a768bcc`.
- Gate closes here. Calendar Search/Update/Delete are not started.

## Memo Core Stable Checkpoint - 2026-07-22

- Checkpoint: `MEMO_CORE_STABLE_CHECKPOINT_20260722`.
- Fixed thread/turn: `019f8709-63a4-7482-b804-ddea7b8940cf` / `019f879c-06eb-7ef0-b467-12d9a9612364`.
- Formal Delete Gate evidence remains PASS for single, sequence selection, bounded multi/range, and current-search-all against the same valid actor snapshot. Whole-database Delete All remains disabled and not formally verified.
- Published n8n was rechecked as `271add4b-71e9-4f06-82c6-38f7d1ca765c`; the one saved sanitized snapshot is 137/136 with empty pin data, zero stored credential IDs/names/values, and checksum `4a3bae95603eb3ff91fe05a161fb6123a2d98726f214a0156207199ad6be668a`.
- Worker source `859e556` remained unchanged through intake HEAD `9e2423f`; deployment `5f707990-60df-4331-8598-d6716da56e11` was active at 100% and health metadata parity PASS.
- Checkpoint rerun passed Worker 71/71, isolated contract 12/12, and the current no-side-effect Memo/n8n offline suites.
- Formal fixture/readback state retained: created 6, active 0, archive 6, existing formal Memo effect 0, duplicate Delete 0, duplicate LINE success final 0, permanent delete 0, Calendar effect 0.
- Google was not part of the Gate and is `not_applicable`; no Google event or Calendar Gate was opened.
- Known ingress hardening note remains recorded separately: shared-secret rejection occurs in `Normalize Input`, not at an HTTP 401/403 Webhook boundary. This checkpoint did not modify that behavior.
- Final states: Memo Delete completed, Memo Core completed/frozen, checkpoint recorded, Calendar Create queued/not started.

## Memo Delete Selection Repair Gate - 2026-07-22

- Root cause: Search already retained canonical Memo references, but the public Worker Delete parser/state boundary did not map the displayed sequence forms to the same snapshot and had no active confirmation state.
- Implemented in the formal local Worker after Orchestrator authorization: the five required natural commands, same actor/snapshot/candidate binding, TTL 600, `確認刪除` / `取消`, single consumption, and fail-closed handling for expiry, actor mismatch, snapshot/candidate change, and redelivery.
- `全部` means only the current unexpired same-actor search snapshot and remains capped at five; it never means the whole database. Without a valid snapshot the exact clarification is returned.
- The local n8n contract accepts only canonical references from a consumed Worker confirmation and retains revision-aware archive-only processing, terminal active-absence/archive readback, duplicate suppression, and safe partial-result reporting.
- Local proof: Worker 71/71; isolated contract 12/12; n8n/Memo 139/139; static workflow 137/136 PASS. External writes and formal Memo effects: zero.
- Calendar DOC/progress was preserved and Calendar remained paused/not started. No Publish, Deploy, live LINE delete, credential operation, commit, or push.


## FIX Naming Sync - 2026-07-22

- Task: `PLine｜FIX｜小修正與命名同步`.
- Canonical project name: `菲比 LINE 智能助理_03`; routing prefix: `PLine`.
- Current state remains `STOP_AFTER_CLOSEOUT` at `MEMO_CORE_COMPLETED_20260721`; there is no active Gate.
- Changed only current naming/status entrypoints. Historical task names, Documents-root evidence, and dated failure snapshots were preserved.
- Git branch and upstream both resolve to `9fdf119bd999de51a05f958d7712e0e6d2e09bda`; existing dirty files belong to prior work and were preserved.
- No runtime, external-service, TEST, Calendar, deploy, stage, commit, or push action occurred.
- Evidence: `FIX_EVIDENCE_NAMING_STATUS_SYNC_20260722.md`.

## ARCHIVE Historical Build Record Synchronization - 2026-07-22

- Task: `PLine｜ARCHIVE｜歷史建置紀錄`.
- Current archived checkpoint: `MEMO_CORE_COMPLETED_N8N_LOCAL_RECHECK_BLOCKED_CALENDAR_NOT_STARTED`.
- Retained the 2026-07-20 `BLOCKED_INCOMPLETE` state as a dated historical checkpoint; it is superseded by later evidence, not erased.
- Registered the authoritative-root alignment as PASS from existing FIX evidence and the 2026-07-21 Memo Core completion from terminal closeout evidence.
- Memo Create, keyword Search, Search All, Modify, single-position Delete, comma-list Delete, range Delete, natural user-visible finals, Reply-first, bounded ACK, idempotency, exactly-once, duplicate safety, revision-aware update, and archive-only deletion are PASS as recorded in existing evidence. This ARCHIVE task did not rerun them.
- The 2026-07-22 local n8n checkpoint remains separately `BLOCKED` on inbound Webhook Header Auth alignment and the `Structured Output` `/s+/g` semantic defect. Current offline contracts, Worker non-retired tests, and Monitor tests pass; live n8n state was not checked.
- Calendar and all new Gates remain `NOT_STARTED`; `刪除全部` remains unsupported; Previous Page / specific-page navigation has no fresh-live PASS recorded.
- Scope stayed documentation-only. `EXTERNAL_ACTIONS=none`; `TESTS_RUN=none`; `DEPLOY_ACTIONS=none`; `COMMIT_PUSH=no`; `FORMAL_ALLOWED=false`; `OLD_PROJECT_ACCESS=none`.
- Target files were already dirty before this sync: `PLine_ARCHIVE_HISTORY.md` was untracked, while `CHANGELOG.md` and `CODEX_NOTES.md` were modified. Existing content was preserved.

## N8N Local Recheck - 2026-07-22

- Task: `PLine｜N8N｜n8n workflow 調整`; interpreted under the Dropbox `_03` default as local evidence registration only.
- Workflow snapshot `00451c520cb72b7c44ed7d981a48027b8b18becf988a395493653e70ff1e4680` passed current structure and topology checks at 137 nodes / 136 connection sources.
- Current N8N offline contracts passed; Worker non-retired suites passed 69/69; Monitor suites passed 31/31.
- Overall local verdict remains `BLOCKED`: inbound Webhook Header Auth is not established by the local export, and `Structured Output` still contains the semantic `/s+/g` defect.
- The closeout-retired generic Worker suite remains `NOT_APPLICABLE`; do not restore `enqueueCrudTask`. Earlier 127-node and 135-node snapshot validators are historical, not current acceptance.
- Live n8n state, draft/published parity, credentials, executions, LINE, Dropbox runtime effects, and user-visible results were not checked. Evidence: `N8N_EVIDENCE_LOCAL_RECHECK_20260722.md`.

## Memo Core Completion Milestone - 2026-07-21 22:52 Asia/Taipei

- Marker: `MEMO_CORE_COMPLETED_20260721_2252`.
- Evidence-backed result: Memo Create, keyword Search, Search All, Modify, single-position Delete, comma-list Delete, and range Delete are complete with fresh user-visible LINE acceptance.
- Search All uses a complete ordered candidate snapshot and numbered paged summaries; later Delete resolves explicit positions only against the latest valid snapshot.
- Batch Delete is capped at five unique positions, fails closed on invalid selection, moves records to the archive without overwrite or permanent deletion, and requires terminal archive readback. Delete All remains unsupported.
- Create/Modify/Delete success finals use natural Traditional Chinese and hide `memo_id` and internal system fields. Search keeps safe numbered context for follow-up selection.
- Reply-first, exactly-once, idempotency, duplicate safety, revision-aware update, and Dropbox archive readback remain PASS. Final isolated batch acceptance observed duplicate file/reply 0, Push 0, permanent delete 0, active fixture 0, and archived fixture 5.
- Accepted runtime references: Worker `56558dd5-7856-4a67-9a8f-e6a1e8e96358`; n8n workflow `kcMcBQos5cxsnWU1`, Published `a88e1361-c4fa-4f44-b79b-a0fe9c44e7c2`.
- This entry is documentation-only. It does not modify program code, n8n, credentials, deployment state, or Calendar scope.

## Daily Closeout - Memo Core - 2026-07-21

- Marker: `MEMO_CORE_COMPLETED_20260721`.
- Authoritative completed functions: Create, keyword Search, Search All with numbered content pages, Modify, single-position Delete, multi-position Delete, and range Delete.
- Final live evidence is terminal and user-visible: Create/Search/Modify/Delete PASS; the isolated five-fixture batch sequence completed comma positions 2/4/5 and range positions 1–2 with active 0 / archive 5, 9/9 expected visible finals, Push 0, duplicate file/reply 0, and permanent delete 0.
- Create/Modify/Delete success replies use natural Traditional Chinese and contain no `memo_id` or system fields. Search intentionally retains numbered selection context.
- Archive contract remains collision-safe and revision-aware with no overwrite, active-absence verification, exact readback, exactly-once, and duplicate suppression.
- Closeout regression: Worker/Memo 62 PASS; Dropbox revision 9/9; CRUD 39/39; Delete 18/18; Natural Reply 9/9; multi-position archive 19/19.
- `刪除全部` remains unsupported. Calendar and other new Gates remain not started. Previous Page / specific-page navigation does not have a new fresh live PASS in this closeout.
- The retired `worker/test/worker.test.mjs` generic CRUD/Calendar suite remains `NOT_APPLICABLE` and is excluded; prohibited `enqueueCrudTask` must not be restored.
- The earlier failed test prefix `MBATCH-20260721221413-7874` remains active 5 / archive 0 and requires a separately authorized cleanup decision.
- Closeout did not Publish, Deploy, send LINE, start Monitor, change credentials, or modify runtime logic.

## FIX Project Root Alignment - 2026-07-20

- Task: `PLine｜FIX｜小修正與命名同步`.
- Selected the current Dropbox `_03` workspace as the single authoritative local project root.
- Aligned Worker, Monitor, Wrangler configuration, launchd plist, and unit-test path assertions to that root.
- Kept `/Users/phoebe/Documents/...` references inside historical evidence/history unchanged.
- Local verification passed, including both unit suites and Monitor health path readback; the prior `EPERM` / `BLOCKED_PATH_SCOPE` cause is resolved in FIX, while TEST still owns the acceptance rerun.
- Monitor unit tests now remove only the exact synthetic idea files returned by the current run; the verification rerun left no matching test artifact in the project root.
- No deploy, live smoke, LINE send, n8n/Cloudflare/KV mutation, FORMAL action, commit, or push was performed.
- Evidence: `FIX_EVIDENCE_PROJECT_ROOT_ALIGNMENT_20260720.md`.

## ARCHIVE Historical Build Record - 2026-07-20

- Task: `PLine｜ARCHIVE｜歷史建置紀錄`.
- Added `PLine_ARCHIVE_HISTORY.md`; updated companion entries in `CHANGELOG.md` and this file.
- Historical endpoint recorded from existing `_03` evidence: RELEASE-01 and minimal dual-path completion, Dropbox exactly-once, Codex minimal closed loop, durable monitor recovery, T3002 Chat-off auto-read, and T3101/T3102 content-aware natural finals.
- Current checkpoint remains `BLOCKED_INCOMPLETE`: Worker local tests pass, but monitor path alignment, local n8n checks, fresh Memo A6 terminal confirmation, Calendar CRUD, and latest final LINE delivery acceptance are not complete in this workspace copy.
- Historical PASS does not imply current online health, final delivery, or user-visible acceptance; none was rechecked by this ARCHIVE task.
- `PROJECT_STATE.md` names the original Documents path, while this task ran in the Dropbox path; path parity was not asserted.
- Active workspace is not a Git repository. `COMMIT_PUSH=no`; `EXTERNAL_ACTIONS=none`; `FORMAL_ALLOWED=false`; `OLD_PROJECT_ACCESS=none`.

## Worker Role

This task is `PLine｜FIX｜小修正與命名同步`.

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

## 2026-07-20 Local TEST Acceptance Recheck

- Current Dropbox root is not a Git repository.
- Worker syntax/unit tests and n8n workflow JSON parse passed.
- Monitor syntax passed, but its unit suite attempted to write the hard-coded Documents-root smoke path and stopped with `EPERM`.
- Monitor health still said `ready` while reporting Documents-root project/smoke/heartbeat paths; record this as `READY_BUT_PATH_MISALIGNED`, not PASS.
- No external or live action was run and no historical marker was resent.
- Verdict: `TEST ACCEPTANCE: BLOCKED_INCOMPLETE`.
- Evidence: `TEST_EVIDENCE_LOCAL_ACCEPTANCE_20260720.md`.
- Next: FIX aligns the authoritative project root; TEST reruns locally before any separately authorized live smoke.

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
## N8N Local Recheck — 2026-07-20

- Scope was local recheck and evidence registration for workflow `kcMcBQos5cxsnWU1` only.
- `N8N_JSON_STRUCTURE=PASS`: 8 unique nodes, complete connection targets, and valid Code syntax.
- `N8N_LOCAL_HEADER_AUTH_ALIGNMENT=BLOCKED`: the local Webhook has no authentication or credential reference, while Code-level equality remains conditional on `$vars.N8N_SHARED_SECRET`.
- `N8N_STRUCTURED_OUTPUT_SEMANTIC_CHECK=BLOCKED`: `sanitizeReply` uses `/s+/g`; no node-logic change was made in this evidence-only run.
- Worker local tests passed. Monitor local tests were blocked because the copied monitor still writes to the old Documents project path.
- No Save, Import, Publish, Activate, Execute, LINE, Cloudflare, external API, FORMAL, commit, or push action occurred.
- Evidence: `N8N_EVIDENCE_LOCAL_RECHECK_20260720.md`.
