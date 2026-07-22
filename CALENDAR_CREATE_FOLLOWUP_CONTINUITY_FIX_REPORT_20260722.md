# CALENDAR_CREATE_FOLLOWUP_CONTINUITY_FIX — 2026-07-22

## Control boundary

- Thread: `019f8709-1c44-7151-adf0-4cd2a6770efe`
- Turn: `019f8858-871f-78c0-b829-92ecad131282`
- Formal evidence closeout turn: `019f8885-4748-772f-80fc-cdbf20d5bf10`
- Baseline commit: `3f7104a`
- Baseline n8n Published version: `7545f703-441a-4a0b-ac81-ac87c8340a03`
- Baseline Worker deployment: `942bf3c4-3f1d-4126-882a-ba30c98d1f0b`
- Source failing formal TEST final: `019f8845-d72b-7fe1-bf61-2415317b1b5c`
- Fresh formal TEST final: `019f8872-1f35-7de2-9b0b-16e78d93c7a5`
- Calendar alias remains `authorized_test`; n8n backend remains the connected credential's `primary` calendar.
- Memo remains frozen at `MEMO_CORE_STABLE_CHECKPOINT_20260722`.
- Calendar Search/Update/Delete are outside this Gate.

## Root cause

The original single-message parser returned immediately when the date was missing and discarded the already parsed title and start time. The Worker persisted only a per-webhook Calendar acceptance record, so standalone replies such as `今天` and `5分鐘結束` had no same-actor Calendar draft to merge and fell through to the generic n8n route.

The formal TEST reproduced this same `missing_date continuation` boundary three times. This implementation round therefore changed the Worker state/routing boundary and did not repeat formal LINE testing.

## Implementation repair

- Preserve partial title, date, start, end/duration and location in a separate Calendar pending record before sending the clarification reply.
- Bind the pending key to a SHA-256 actor fingerprint derived from the stable LINE source identity. The key excludes reply token, webhook event ID, execution ID and request ID.
- Keep the pending record for 600 seconds and validate an explicit expiry timestamp in addition to KV TTL.
- Check the same-actor pending record before generic intent routing.
- Bind every continuation to the pending record's source event hash and fail closed if the pending snapshot changes.
- Support `今天`, `明天`, `下週一`, `5分鐘`, `一小時`, `到三點`, `5分鐘結束`, `全天` and `取消` in the expected missing-field position.
- Ask only the next missing field while retaining previously parsed values.
- Clear pending state after completion, cancellation, expiry, rejected continuation or a new explicit complete Create command.
- Keep per-webhook acceptance separate from the actor pending draft so webhook redelivery does not create or reply twice.
- Keep readback-before-recreate, Reply-first and public-only LINE summaries unchanged.

## Local evidence

- Follow-up continuity suite: 10/10 PASS.
- Existing Calendar Create suite: 15/15 PASS.
- Selected non-retired Worker/Calendar/Memo suites: 109/109 PASS.
- n8n Calendar contract: 16/16 PASS.
- n8n Memo CRUD: 39/39 PASS.
- n8n Memo Create compatibility: PASS.
- Scenario A local mock preserved the title and 14:00 start across `今天`; `5分鐘結束` produced one canonical 14:00–14:05 dispatch and one final.
- Scenario B local mock produced one canonical 14:00–15:00 dispatch from `一小時`.
- Scenario C local mock produced one canonical 14:00–15:00 dispatch from `到三點`.
- Cancel, expiry, rejected continuation and actor mismatch produced zero Calendar dispatches.
- Same webhook retry produced one Calendar dispatch and one LINE final in the isolated mock.
- Public replies contained no event, calendar, request or credential identifiers.

## n8n release

- Workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent` (`kcMcBQos5cxsnWU1`).
- A full-file import was rejected before Publish because n8n merges imported nodes into an open workflow and detected the duplicate webhook path. The merged draft was discarded; the active workflow and webhook were never deactivated.
- The verified Published Calendar Create baseline was restored through Version History, preserving the 144-node/143-connection runtime topology and the three existing Google Calendar credential references.
- Published version: `fe757d90-b40b-4234-af4d-6162aded24a4`.
- Published version name: `Calendar Create Follow-up Continuity Fix`.
- The version description records that same-actor continuation is resolved in Worker before general n8n routing and that n8n receives only complete canonical `calendar_create` payloads.

## Worker release

- Deployment: `814fcaca-2040-4323-aced-6e176073c178`.
- Public health readback confirms pending context `same_actor_safe_hash_partial_draft`, TTL 600 seconds, continuation inputs, actor isolation, next-missing-field-only behavior, deterministic event reference, readback-before-recreate and exactly-once final delivery.
- No formal LINE message was sent and no Google Calendar or Memo external write was performed in this implementation round.

## Fresh formal acceptance

- Marker: `CALENDAR-CREATE-FOLLOWUP-20260722-NEWFIX-141153`.
- Case A formal LINE PASS: missing-date continuation preserved the earlier title/start, accepted `今天`, accepted `5分鐘結束`, created exactly one expected event, and Google primary readback passed.
- Case B formal LINE PASS: `一小時` completed the pending duration and created exactly one expected event; Google primary readback passed.
- Case C formal LINE PASS: `到三點` completed the pending end time and created exactly one expected event; Google primary readback passed.
- Case D cancel formal LINE PASS: pending state cleared and marker Calendar write count was zero.
- Case E retry evidence is limited to isolated verification: retry/idempotency suite 15/15 PASS, duplicate Calendar write 0, and duplicate LINE final 0. A live identical webhook replay was intentionally not executed because safely reproducing the original signed webhook identity is not available from the formal LINE surface.
- Pending continuity A-D formal PASS; isolated pending suite 10/10 PASS; TTL 600 seconds and actor isolation retained.
- Every created fixture passed Google primary readback. Cleanup removed only the fully referenced Gate fixtures; post-cleanup marker active count is zero.
- Existing Calendar data effect: zero. Memo production effect: zero. Memo offline regression: 39/39 PASS.
- LINE output contained no event ID, calendar ID, request ID, credential reference, or other internal identifier.
- Calendar Search/Update/Delete remain not started.

## Published workflow evidence

- Sanitized export: `backups/calendar-create-followup-continuity-fix-20260722-135222/CURRENT_PUBLISHED_SANITIZED.json`.
- Export SHA-256: `141aad725558c5b8e431db639daf281efacf83e8331d8260180f87ea2a768bcc`.
- Evidence manifest: `backups/calendar-create-followup-continuity-fix-20260722-135222/PUBLISHED_FE757D90_MANIFEST.md`.
- Credential references are redacted placeholders; no credential secret is stored.

## Closeout decision

- Gate status: `COMPLETED_WITH_RETRY_EVIDENCE_LIMITATION`.
- Formal LINE A-D, Google readback, fixture cleanup, existing-data isolation, Memo regression, and deployed identities are accepted.
- Case E is accepted only at the isolated evidence layer; no live identical webhook replay is claimed.
- Next safe action: stop at this Gate and return control to Orchestrator. Calendar Search/Update/Delete require separate Gates.
