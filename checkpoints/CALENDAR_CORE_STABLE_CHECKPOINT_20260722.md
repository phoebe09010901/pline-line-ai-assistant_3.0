# CALENDAR_CORE_STABLE_CHECKPOINT_20260722

## 1. Checkpoint identity

- Project: `菲比 LINE 智能助理_03`
- LINE official account: `菲比智能客服`
- Fixed category: `PLine｜RELEASE｜階段收尾與上線檢查`
- Time zone/date: `Asia/Taipei`, `2026-07-22`
- Release thread/turn: `019f8709-63a4-7482-b804-ddea7b8940cf` / `019f892c-0152-7353-8449-85879a394064`
- Source controller: `019f8708-7a01-7852-ba19-def6245786b4`

## 2. Terminal status

- `CALENDAR_CREATE_GATE_STATUS=completed`
- `CALENDAR_CREATE_FOLLOWUP_STATUS=completed_with_retry_evidence_limitation`
- `CALENDAR_SEARCH_GATE_STATUS=completed_with_retry_evidence_limitation`
- `CALENDAR_UPDATE_GATE_STATUS=completed_with_retry_evidence_limitation`
- `CALENDAR_DELETE_GATE_STATUS=completed_with_retry_evidence_limitation`
- `CALENDAR_CORE_STATUS=completed_and_frozen`
- `CALENDAR_CHECKPOINT_STATUS=recorded`
- `MEMO_CORE_STATUS=completed_and_frozen`
- Controller state after this checkpoint: `STOP_AFTER_CHECKPOINT`

## 3. Evidence grading

- Formal acceptance is recorded only where the existing TEST thread supplied user-visible LINE evidence and Google Calendar readback.
- Local regression is recorded separately and is not promoted to formal acceptance.
- Implementation-thread zero-effect checks are separate from TEST effects.
- No identical signed LINE webhook was replayed in this RELEASE task.

## 4. Calendar Create formal scope

- PASS: focused missing/ambiguous-time clarification, six valid date/time forms, Google `primary` readback, exactly one event and one LINE final per valid input, and bounded cleanup.
- Published: `7545f703-441a-4a0b-ac81-ac87c8340a03` (`Calendar Create authorized_test to primary Mapping`).
- Worker deployment reused: `942bf3c4-3f1d-4126-882a-ba30c98d1f0b`.
- Formal fixtures created/cleaned: 6 / 6; marker active 0; existing Calendar effect 0; Memo production effect 0; duplicate Calendar event/final 0 / 0.

## 5. Calendar Create follow-up continuity

- Formal A/B/C continuation and D cancel PASS. The same actor retains the partial title/start and supplies only the next missing date, duration or end time; cancel clears pending state.
- Contract: actor-safe hash, TTL 600, actor isolation, next-missing-field-only, readback-before-recreate and exactly-once final state.
- Published: `fe757d90-b40b-4234-af4d-6162aded24a4` (`Calendar Create Follow-up Continuity Fix`).
- Worker deployment: `814fcaca-2040-4323-aced-6e176073c178`.
- Google readback/cleanup PASS; marker active 0; existing Calendar effect 0; Memo effect 0; duplicate write/final 0 / 0.
- Retry/idempotency is isolated evidence only: 15/15 PASS.

## 6. Calendar Search formal scope

- Read-only today, tomorrow, week, keyword, date, date-time, no-result, multi-result and first/second ordinal continuation PASS.
- Results bind to a same-actor snapshot with TTL 600; a newer search replaces it. Internal Calendar references are not displayed.
- Published: `c12e141f-fac1-481b-8f98-7b385fd9aebe` (`Calendar Search Read Only Snapshot Gate`).
- Worker deployment: `09b42c7b-12e9-4f86-9d83-97595a9128f2`.
- Google readback PASS; 10 LINE finals including one auxiliary result; duplicate final 0.
- Calendar create/update/delete/existing effect 0 / 0 / 0 / 0; Memo production effect 0.

## 7. Calendar Update formal scope

- Sequence selection, unique natural target, title/date/start/end/duration/location changes, multi-turn confirmation, cancel, ambiguity, no-result, missing candidate and changed-snapshot safety PASS.
- Contract: same-actor snapshot, TTL 600, confirmation, original-candidate guard, terminal readback and idempotency.
- Published: `a2002f5e-1cbf-40a8-b79c-0c6a514d3a3f` (`Calendar Update Actor Snapshot Confirmation Gate`).
- Worker deployment: `d12384eb-98a2-416a-bc7a-3fb9707e3891`.
- Fixtures created/cleaned 2 / 2; update effects 4; duplicate update 0; five safety cases effect 0; marker active 0.
- Google readback PASS; existing Calendar effect 0; duplicate final 0; Memo production effect 0.

## 8. Calendar Delete formal scope

- Formal A sequence selection + confirmation and B unique natural target + confirmation PASS. C cancel PASS with delete effect 0.
- Ambiguous, no-result, missing candidate, changed snapshot, actor mismatch, expired state, unbounded/all delete and confirmation replay fail closed.
- Whole-calendar `全部` / `所有` / `清空` remains prohibited. Delete is limited to the exact actor/snapshot/confirmation-bound candidate.
- Published: `bc6483ba-7c06-43db-91b9-88d53c07dfe3` (`Calendar Delete Cancelled Tombstone Readback Fix`).
- Worker deployment: `5aba605e-a31d-4a4f-b9ed-de301895f2cd`; final n8n-only tombstone fix Worker changed no / deploy not required.
- Google pre-readback 3, after A 2, after B 1; cancelled C remained until exact cleanup; final marker active 0.
- Formal delete 2; cleanup delete 1; duplicate delete/write/final 0 / 0 / 0; false-negative recurrence 0; existing Calendar effect 0; Memo effect 0.

## 9. Delete false-negative repair boundary

- Root cause: Google terminal `get event` may return a `status=cancelled` tombstone after a successful delete.
- A cancelled tombstone counts as verified absence only after an eligible delete attempt or explicit readback-only recovery. A candidate missing/changed before delete still fails closed.
- Only `Calendar Delete Inspect Existing` and `Calendar Delete Verify Absence` changed; topology stayed 161 nodes / 160 connection sources.
- Terminal readback executable contract: 6/6 PASS.

## 10. Safety, isolation and exactly-once

- Cancel, ambiguity, no-result, missing, snapshot change, unbounded/all, TTL, actor isolation and idempotency safety cases PASS at their recorded formal or isolated layer.
- Worker health covers pending-state isolation, TTL 600, confirmation/cancel, readback guard and exactly-once final behavior.
- Duplicate LINE final count across accepted Calendar Gate records: 0.
- No raw LINE user ID, replyToken, raw headers/body, credential value or replayable secret is stored here.

## 11. Google readback and fixture cleanup

- All accepted mutation Gates used Google Calendar `primary` and operation-appropriate terminal readback.
- Cleanup targeted only fully referenced isolated fixtures.
- Create, follow-up, Update and Delete final marker active counts: 0 / 0 / 0 / 0.
- Existing Calendar effect count: 0.

## 12. Memo regression and effect isolation

- RELEASE local Memo regression: CRUD 39/39, natural reply 9/9, selection/batch archive 19/19, archive-only delete 18/18; total 85/85 PASS.
- Formal Calendar Gate records report Memo production effect 0.
- Memo Core remains completed and frozen; this checkpoint changed no Memo runtime or data.

## 13. Calendar Core local regression

- Worker selected non-retired Calendar/Memo/reply/idempotency suites: 130/130 PASS.
- n8n Create 18/18; Search 38/38; Update PASS; Delete PASS; Delete terminal readback 6/6.
- Delete bare command now defaults to `N8N_WORKFLOW_PLINE_V3_CALENDAR_DELETE_TOMBSTONE_FIX_LUNA_IMPORT.json`.
- The earlier bare-command failure was a stale pre-fix local default-source issue, not a Published runtime failure.

## 14. Actual Published workflow snapshot

- Workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent` (`kcMcBQos5cxsnWU1`).
- Published: `bc6483ba-7c06-43db-91b9-88d53c07dfe3`, `Calendar Delete Cancelled Tombstone Readback Fix`.
- Live Version History time: `2026-07-22 17:20:02 +08:00`; actual export file time: `2026-07-22 17:21:33 +08:00`.
- Actual pre-sanitization export SHA-256: `75eb037087bd2e5a588488c7991b89f94ca1810032959fc7d91123187fc55b2f`.
- Snapshot: `checkpoints/workflows/PLine_V3_CALENDAR_CORE_STABLE_PUBLISHED_bc6483ba_SANITIZED.json`.
- Snapshot SHA-256: `edd045161472b9ef4b655a0fd77d90c91bb676ac52a2dc1f64696146e0aa1629`.
- Checksum: `checkpoints/workflows/PLine_V3_CALENDAR_CORE_STABLE_PUBLISHED_bc6483ba_SANITIZED.sha256`.
- Identity/shape matches: 161 nodes / 160 connection sources; active true; pinData absent.
- Credential bindings retain only type with redacted placeholders; no credential secret, ID or name is stored.
- `PUBLISHED_VERSION_STATUS=matched_actual_formal_runtime`.

## 15. Frozen OpenAI and Worker identity

- OpenAI core: `gpt-5.6-luna`; temperature `0.1`; existing credential reference unchanged.
- Current Worker deployment: `5aba605e-a31d-4a4f-b9ed-de301895f2cd`, active at 100% traffic.
- This RELEASE performed no n8n Publish, Worker Deploy, credential/OAuth change, LINE send, Google mutation, fixture creation, Memo mutation or identical webhook replay.

## 16. Known limitation, Git release and next action

- `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed`.
- Retry/idempotency is accepted only from isolated suites plus no duplicate effects/finals in formal sequences. No unsafe identical-webhook replay PASS is claimed.
- Release branch: `v1/minimal-dual-path`; baseline HEAD/upstream before checkpoint: `ab97969b7a15d0a52f3830cdbe3c3d76dea0312a`, 0 ahead / 0 behind.
- Annotated tag: `calendar-core-stable-20260722`; it resolves the checkpoint commit containing this file and snapshot.
- Pre-existing unrelated dirty files remain outside the checkpoint commit and were not cleaned, overwritten or discarded.
- Next safe action: stop after release verification. Calendar Core is frozen; no new Calendar feature or OpenAI core change starts here.
