# CALENDAR_UPDATE_GATE Implementation Report

DATE: 2026-07-22 Asia/Taipei  
PROJECT: 菲比 LINE 智能助理_03  
FIXED_CATEGORY: PLine｜N8N｜n8n workflow 調整  
GATE: CALENDAR_UPDATE_GATE  
TASK_TYPE: implementation_update_gate  

## Scope and evidence boundary

- Calendar Update only. Calendar Delete and Calendar checkpoint were not started.
- Formal LINE Update acceptance was not executed in this implementation thread. The Gate remains pending the existing TEST thread.
- Calendar Search is retained as `PASS_WITH_RETRY_EVIDENCE_LIMITATION`.
- `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed`
- No Calendar fixture or external Calendar event was created, updated, or deleted by local tests in this thread.
- Memo Core remains frozen. Production Memo effect: 0.

## Root cause and implementation

The Search baseline provided a same-actor numbered snapshot but had no Update parser, candidate-bound pending record, confirmation lifecycle, or update/readback workflow path. The implementation adds:

- sequence selection from the current same-actor Search snapshot;
- a single unique keyword target lookup with zero update on no result or ambiguity;
- title, date, start, end, duration, and location patches;
- multi-message Update pending state bound to a stable actor hash and exact candidate;
- TTL 600 seconds and explicit `確認修改` / `取消`;
- fail-closed behavior for expiry, actor mismatch, snapshot replacement, missing candidate, and changed original Calendar event;
- one mutation per confirmation event and exactly-once LINE final delivery state;
- readback-only recovery after an ambiguous update response;
- public replies without event, calendar, request, credential, or other internal identifiers.

## Workflow protection and publication

- Unique mother file: `N8N_WORKFLOW_PLINE_V3_CALENDAR_SEARCH_LUNA_IMPORT.json`
- Mother SHA-256: `93d05c15782e727ae88ab888060310e4f4e1cd7d4e57fb7733ac640a827dbb1b`
- Update import file: `N8N_WORKFLOW_PLINE_V3_CALENDAR_UPDATE_LUNA_IMPORT.json`
- Update import SHA-256: `d3318464e88e91e7e2a9219f70607754bc17d20238492dad453ddfd6b0a475c2`
- Backup: `backups/calendar-update-gate-20260722-155553/`
- Imported draft node count / connection sources: 154 / 153
- Existing Search/Create/Memo nodes and existing connections are byte-equivalent except the required `Normalize Input` insertion point.
- User-controlled OpenAI core is preserved: `gpt-5.6-luna`, temperature `0.1`, existing credential reference.
- Google Calendar nodes retain the existing credential reference and use only `primary`.
- Workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Workflow ID: `kcMcBQos5cxsnWU1`
- Published version: `a2002f5e-1cbf-40a8-b79c-0c6a514d3a3f`
- Published name: `Calendar Update Actor Snapshot Confirmation Gate`

The editor contained an unpublished 291-node append residue. It was not published. The draft was safely rebuilt from the complete protected mother/candidate files, verified at 154 nodes with no suffixed duplicate nodes, and only then published.

## Worker deployment

- Worker changed: yes
- Worker: `pline-v3-test-line-gateway`
- Final deployment ID: `d12384eb-98a2-416a-bc7a-3fb9707e3891`
- Post-deploy health: Calendar Update contract present with primary backend, TTL 600, confirmation required, original-candidate guard, readback-only retry, final exactly once, and Calendar Delete effect 0.

## Local verification

- Worker Update/Create/Search/Memo/reply/idempotency integration: 118/118 PASS
- Calendar Update Worker focused suite: 13/13 PASS
- n8n Calendar Update structural/integrity suite: PASS
- n8n Calendar Search regression: 38/38 PASS
- n8n Calendar Create regression: 18/18 PASS
- Memo CRUD: 39/39 PASS
- Memo natural reply: 9/9 PASS
- Memo selection batch/archive: 19/19 PASS
- Memo archive-only delete: 18/18 PASS
- Calendar external write/update/delete effect during implementation verification: 0 / 0 / 0
- LINE external send count during implementation verification: 0

## Formal TEST handoff

Use the existing `PLine｜TEST` thread. Create only a new uniquely marked fixture such as `CALENDAR-UPDATE-GATE-YYYYMMDD-HHMMSS` in the authorized primary/default Calendar, then verify and clean up only that exact fixture.

Required live cases:

1. Search the marker, select the numbered result, change title/date/start/duration/location, verify summary appears before mutation, reply `確認修改`, and verify Google readback.
2. Search the updated marker, change end time, confirm, and verify readback.
3. Send `修改第一個` with no changes, verify only the next missing Update information is requested, provide a supported field change, confirm, and verify readback.
4. Propose a change and reply `取消`; Calendar update effect must remain 0.
5. Verify no-result and ambiguous natural targets clarify with Calendar update effect 0.
6. Verify same-actor snapshot, actor isolation, TTL expiry, snapshot replacement, and changed-candidate fail closed.
7. Verify duplicate confirmation produces one Calendar mutation and one LINE final. Preserve the existing limitation if formal identical-webhook live replay remains unsafe.
8. Verify every LINE response excludes internal identifiers.
9. Run Calendar Create/Search and Memo regressions, then clean up only the exact verified test fixture and read back absence.

Do not begin Calendar Delete or checkpoint. Do not commit or push until formal TEST passes and Orchestrator authorizes closeout.
