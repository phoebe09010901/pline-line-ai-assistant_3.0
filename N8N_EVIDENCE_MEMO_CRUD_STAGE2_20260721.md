# Memo Search Modify Delete - Stage 2 Offline Evidence

- Gate: Memo Search Modify Delete Workflow Implementation
- Sequence: 2_OF_3_RETRY_AFTER_FIX
- Workflow ID: kcMcBQos5cxsnWU1
- Published version before: 03181dd4-b574-4cd1-bc51-6ea78382668f
- Published version after: fad98dad-d5a4-4013-9b18-2eb88b1f6899
- Active Worker unchanged: b4bc8d3a-2eb9-4bfc-8fa4-11b871ecf5a0
- Live workflow execution: not run
- LINE delivery: not run
- Dropbox production mutation: not run
- Monitor: stopped / unloaded
- n8n Published: yes

## Implemented contract

Search is a deterministic, read-only branch before the AI Agent. It lists only the first level of the active Dropbox folder, admits only canonical memo-64hex.json files whose exact eight-field JSON is an active Memo, performs Unicode substring or exact memo ID matching, sorts by updated_at descending and memo_id ascending, reports the full admitted match count, and displays at most ten summaries. A 501-entry probe creates a fail-closed overflow result instead of reporting an incomplete total.

Modify derives one active path only from a complete safe Memo ID. It reads Dropbox metadata, validates the current exact eight-field active Memo, then uses the existing Dropbox OAuth reference through HTTP Request Predefined Credential Type. The upload uses the exact Dropbox content endpoint with mode=update(expected_rev), autorename=false, and strict_conflict=true. A revision conflict is a safe 409 with no overwrite. The result is successful only after exact eight-field readback.

Delete is archive-only. It conditionally updates the active file at the expected revision to the nine-field archived document, obtains the new revision, verifies the same revision immediately before moving, and uses collision-safe move_v2 with autorename=false. Completion requires the active source to be absent, archive metadata to carry the conditional-update revision, and exact archive readback to pass.

move_v2 has no revision precondition and is not atomic with the preceding metadata check. The metadata-to-move TOCTOU window is retained and explicitly disclosed. If the moved revision or archive readback differs, the workflow returns safe ambiguity/failure and never reports success. The workflow does not retry a move.

All three branches converge on one existing Header Auth finalizer callback contract. The callback body is limited to task_id, request_id, terminal status, operation, optional safe memo_id, and natural-language reply_text. No reply token, raw user identity, credential value, finalize token, or raw webhook payload is included.

## Offline results

- Memo CRUD direct tests: 31/31 PASS.
- Dropbox revision adapter: 8/8 PASS.
- Memo Create regression: 16/16 PASS.
- Applicable Worker suites: 62/62 PASS.
- Generated Code node parse validation: 30/30 PASS.
- Static topology: 84 nodes, 83 connection sources, zero duplicate node names, zero dangling references.
- Existing non-Normalize nodes: zero drift.
- Existing non-Normalize connections: zero drift.
- Sanitized local workflow: zero credential references.
- Published export parity: 84 nodes and 83 connection sources; zero functional node drift after ignoring n8n-normalized default fields and canvas-only node IDs/positions.
- Published Dropbox credential binding: all 18 applicable nodes bound to the same existing Dropbox OAuth reference.
- Published callback binding: both applicable finalizer nodes bound to the same existing Header Auth reference.
- Published sanitized export: backups/memo-search-modify-delete-stage2-retry-20260721-080742/published/current-published-after.sanitized.json.
- Prohibited Calendar, generic CRUD, codex_delegate, google_calendar_direct, and crud_task:v1 contracts: absent.

The retired worker/test/worker.test.mjs still targets removed generic CRUD exports and remains NOT_APPLICABLE_RETIRED_CRUD_CONTRACT; it was not modified or deleted.
