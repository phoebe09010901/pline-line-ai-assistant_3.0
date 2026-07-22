# CALENDAR_DELETE_GATE Implementation Report

DATE: 2026-07-22 Asia/Taipei  
PROJECT: 菲比 LINE 智能助理_03  
FIXED_CATEGORY: PLine｜N8N｜n8n workflow 調整  
GATE: CALENDAR_DELETE_GATE  
TASK_TYPE: implementation_delete_gate  

## Scope and evidence boundary

- Calendar Delete only. Calendar Core checkpoint was not started.
- Formal LINE Delete acceptance was not executed in this implementation thread. The Gate remains pending the existing TEST thread.
- Calendar Update is retained as `PASS_WITH_RETRY_EVIDENCE_LIMITATION`.
- `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed`
- No Calendar fixture or external Calendar event was created, updated, or deleted by implementation verification.
- Memo Core remains frozen. Production Memo effect: 0.

## Root cause and implementation

The Update baseline had Search snapshots and numbered candidates, but did not have a Calendar Delete parser, actor-bound selection/confirmation state, or a terminal absence-readback path. The implementation adds:

- explicit Calendar Delete commands and numbered selection from the current same-actor Search snapshot;
- single unique natural-language target lookup with zero delete on no result or ambiguity;
- rejection of unbounded `全部` / `所有` / `清空` Calendar deletion;
- a public summary followed by required `確認刪除`, plus `取消` / `不要刪` cancellation;
- stable actor-bound pending state, exact snapshot/candidate binding, and TTL 600 seconds;
- fail-closed behavior for expiry, actor mismatch, snapshot replacement, missing candidate, or changed original event;
- one mutation per confirmation event, exactly-once LINE final state, and readback-only recovery after an ambiguous delete response;
- terminal Google Calendar absence verification and public replies without event, calendar, request, credential, or other internal identifiers.

An initial integrated regression exposed a command collision: shorthand such as `刪除第一個` could claim a Memo Delete intent. The route was narrowed so shorthand Calendar Delete is accepted only when the same actor has a current Calendar Search snapshot; explicit Calendar Delete commands remain deterministic. After this one repair cycle, the full integrated Worker suite passed 130/130.

## Workflow protection and publication

- Unique mother file: `N8N_WORKFLOW_PLINE_V3_CALENDAR_UPDATE_LUNA_IMPORT.json`
- Mother Published version: `a2002f5e-1cbf-40a8-b79c-0c6a514d3a3f`
- Mother SHA-256: `d3318464e88e91e7e2a9219f70607754bc17d20238492dad453ddfd6b0a475c2`
- Delete import file: `N8N_WORKFLOW_PLINE_V3_CALENDAR_DELETE_LUNA_IMPORT.json`
- Delete import SHA-256: `fd0d7399a19530adb0363ede11f2e29f61ef5fc7167d43cd099e019e112f0e66`
- Backup: `backups/calendar-delete-gate-20260722-163646/`
- Imported draft node count / connection sources: 161 / 160
- Existing Update/Search/Create/Memo nodes and connections are preserved except the required `Normalize Input` Delete insertion point.
- User-controlled OpenAI core is preserved: `gpt-5.6-luna`, temperature `0.1`, existing credential reference.
- Google Calendar nodes retain the existing credential reference and use only `primary`.
- Workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Workflow ID: `kcMcBQos5cxsnWU1`
- Published version: `29a73423-26f1-41dd-9398-bc2a62ed77b9`
- Published name: `Calendar Delete Actor Snapshot Confirmation Gate`

The editor initially appended the candidate to the existing draft, producing an unpublished 315-node residue. That residue was cleared without publishing. The exact protected candidate was then imported, verified at 161 nodes with one instance of every Calendar Gate node and the frozen OpenAI settings intact, and only then published.

## Worker deployment

- Worker changed: yes
- Worker: `pline-v3-test-line-gateway`
- Final deployment ID: `5aba605e-a31d-4a4f-b9ed-de301895f2cd`
- Post-deploy health: Calendar Delete contract present with primary backend, actor snapshot binding, TTL 600, confirmation/cancel, unbounded-delete rejection, original-candidate guard, terminal absence readback, readback-only retry, and exactly-once final state.

## Local verification

- Calendar Delete focused Worker suite: 12/12 PASS
- Worker Delete/Search/Update/Create/Memo/reply/idempotency integration: 130/130 PASS
- n8n Calendar Delete structural/integrity suite: PASS
- n8n Calendar Update structural/integrity regression: PASS
- n8n Calendar Search regression: 38/38 PASS
- n8n Calendar Create regression: 18/18 PASS
- Memo CRUD: 39/39 PASS
- Memo natural reply: 9/9 PASS
- Memo selection batch/archive: 19/19 PASS
- Memo archive-only delete: 18/18 PASS
- Calendar external write/update/delete effect during implementation verification: 0 / 0 / 0
- LINE external send count during implementation verification: 0
- Auto-fix retry count: 1, resolved at the Calendar/Memo shorthand route boundary.

## Formal TEST handoff

Use the existing `PLine｜TEST` thread, ID `019f8709-3547-71f1-93e6-2807a4b3f51d`. Create only a new uniquely marked fixture such as `CALENDAR-DELETE-GATE-YYYYMMDD-HHMMSS` in the authorized primary/default Calendar. Delete and clean up only that exact fixture after its reference is fully verified.

Required live cases:

1. Search the marker, choose its displayed sequence, verify the public summary appears before mutation, reply `確認刪除`, and verify Google readback confirms absence.
2. Verify a single unique natural-language target follows the same summary/confirmation/readback path.
3. Propose deletion and reply `取消` and `不要刪`; Calendar delete effect must remain 0.
4. Verify no-result and ambiguous targets clarify with Calendar delete effect 0.
5. Verify unbounded `全部` / `所有` / `清空` requests are rejected with effect 0.
6. Verify same-actor binding, actor isolation, TTL expiry, snapshot replacement, missing candidate, and changed original candidate fail closed.
7. Verify duplicate confirmation produces one Calendar delete and one LINE final. Preserve the existing limitation if formal identical-webhook live replay remains unsafe.
8. Verify every LINE response excludes internal identifiers.
9. Run Calendar Create/Search/Update and Memo regressions. If a cancellation fixture remains, clean up only that exact verified fixture and read back absence.

Do not begin Calendar Core checkpoint. Do not commit or push until formal TEST passes and Orchestrator authorizes closeout.
