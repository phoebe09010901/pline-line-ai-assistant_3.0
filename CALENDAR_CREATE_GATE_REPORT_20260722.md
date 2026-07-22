# CALENDAR_CREATE_GATE Report — 2026-07-22

## Scope and control

- Project: 菲比 LINE 智能助理_03
- Gate: `CALENDAR_CREATE_GATE`
- Thread: `019f8709-1c44-7151-adf0-4cd2a6770efe`
- Final turn: `019f87f9-f008-7800-88eb-5e332cb26629`
- Fixed category: `PLine｜N8N｜n8n workflow 調整`
- Public Calendar alias: `authorized_test`
- Authorized backend mapping: the connected Google Calendar credential's `primary` calendar
- Timezone: `Asia/Taipei`
- Memo baseline remained frozen at `MEMO_CORE_STABLE_CHECKPOINT_20260722` / `memo-core-stable-20260722`.

The resumed authorization explicitly permitted mapping `authorized_test` to the same connected credential's `primary` calendar. No Calendar was created and no alternate or shared Calendar was selected.

## Implemented contract

- Deterministic Calendar Create routing runs before generic AI classification.
- Complete date/start/end or date/start/duration creates directly without a second confirmation.
- Missing or ambiguous required fields return one focused clarification with zero Calendar writes.
- Timed, all-day, location, relative-date, month/year rollover and the 10,080-minute duration ceiling are covered.
- Calendar state TTL is 600 seconds.
- A deterministic event reference is used for retry-safe create/readback.
- Dispatch or result uncertainty performs readback before any retry; it never blindly recreates.
- Successful LINE final content is restricted to title, Asia/Taipei date/time or all-day, and optional location.
- Calendar Search/Update/Delete product functions were not implemented. The only delete actions were the explicitly authorized cleanup of this Gate's fully verified fixtures.
- Memo routes, behavior and formal Memo data were not modified.

## Local evidence

- Calendar Worker tests: 15/15 PASS.
- Calendar n8n tests: 16/16 PASS.
- Selected Calendar Worker and Memo regression suite: 86/86 PASS.
- n8n Memo Create compatibility: PASS.
- n8n Memo CRUD compatibility: 39/39 PASS.
- Same-webhook/request retry and LINE-final retry contracts: PASS in the deterministic Worker suite.
- API/credential failure does not produce a success final: PASS in the deterministic Worker suite and was also observed fail-closed during the prior unresolved-alias attempt.

## Workflow and Worker release

- Workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Workflow ID: `kcMcBQos5cxsnWU1`
- Previous Calendar Gate version: `a04a52cf-52bf-42f2-a40d-8cea2d8e2709`
- Final Published version: `7545f703-441a-4a0b-ac81-ac87c8340a03`
- Version name: `Calendar Create authorized_test to primary Mapping`
- Published workflow shape: 144 nodes / 143 connection sources.
- All three Google Calendar nodes retain their credential binding and use backend calendar locator `primary`.
- Public Worker contract still exposes alias `authorized_test`; no Worker change was required for the resumed mapping.
- Existing Worker deployment reused: `942bf3c4-3f1d-4126-882a-ba30c98d1f0b`.
- Monitor dependency: not required. Final check confirmed the monitor service is unloaded.

## Formal LINE acceptance

- Target: LINE `菲比智能客服`.
- Marker: `CALENDAR-CREATE-GATE-20260722-120340`.
- Missing-time case: one focused clarification; Calendar writes 0.
- Ambiguous-time case: one focused clarification; Calendar writes 0.
- Complete timed case: `2026-07-25 10:00–11:00`; create, LINE final and Google readback PASS.
- Duration + location + tomorrow case: `2026-07-23 15:00–16:00`, location `彰化`; create, LINE final and Google readback PASS.
- All-day + cross-month case: `2026-08-03` all-day; create, LINE final and Google readback PASS.
- Today case: `2026-07-22 19:00–20:00`; create, LINE final and Google readback PASS.
- Next Monday case: `2026-07-27 14:00–15:00`; create, LINE final and Google readback PASS.
- Cross-year case: `2027-01-02 10:00–11:00`; create, LINE final and Google readback PASS.
- Each valid input produced exactly one matching active Calendar event and one public LINE final.
- No LINE final displayed event ID, calendar ID, credential reference, operation/request ID, JSON or raw API data.
- Live duplicate Calendar event count: 0.
- Live duplicate LINE final count: 0.
- Formal fixture creates: 6.

## Cleanup and terminal readback

- Before cleanup, all six event references were re-read and their exact marker title, start, end and location were verified.
- Cleanup targeted only those six verified references in `primary`; all six delete calls completed successfully.
- A bounded active-event search across the full fixture date range returned zero events containing the marker after cleanup.
- Direct ID reads through the connector continued to expose normalized pre-delete content, consistent with connector-side read caching; this was not used as active-state evidence.
- The authoritative active-event search readback is clean: marker result count 0.
- Existing Calendar events touched: 0.
- Formal Memo data touched: 0.

## Final gate decision

- Contract and product decisions: verified.
- Credential: exists, remains bound and is usable; no secret was read or emitted.
- External connection to Google Calendar `primary`: verified.
- Workflow import and Publish: complete.
- Worker deployment: not required for this resumed alias-only workflow mapping.
- Local regression: PASS.
- Formal LINE acceptance: PASS.
- Fixture cleanup and active readback: PASS.
- Calendar Create Gate: COMPLETED / PASS.
- Calendar Search/Update/Delete remain out of scope and were not started.
