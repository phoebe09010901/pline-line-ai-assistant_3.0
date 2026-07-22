# Memo Delete Selection Repair — Worker Authorization Handoff

Date: 2026-07-22 (Asia/Taipei)
Gate: `MEMO_DELETE_SELECTION_REPAIR_GATE`
Status: `FORMAL_GATE_COMPLETED`

## Authorization follow-up

Orchestrator accepted this root-cause report and authorized the minimal formal Worker repair in the same Gate. The authoritative implementation is now in `worker/src/index.js` and the local n8n export/build assets; the `proposals/` files remain only an isolated contract model.

Local implementation/regression、n8n Publish、必要 Worker Deploy 與正式 LINE 隔離驗收均已完成。只建立並 archive 本輪 6 筆唯一 marker fixture；既有正式 Memo、既有 MBATCH fixture、Calendar 與 credential 均未變更。完整結果以 `MEMO_DELETE_SELECTION_REPAIR_GATE_REPORT_20260722.md` 為準。

## Root cause

The mismatch is at the Worker command and state boundary, not in the n8n archive implementation.

- `MBATCH-20260721221413-7874-*` is fixture/search-summary content. It is not a canonical Memo identifier.
- Search callback candidates already contain canonical `memo-<64 hex>` references. Worker validates them, stores only ordered `{position,memo_id}` values in an actor/conversation-scoped snapshot, applies TTL 600 seconds, and renders numbered summaries without exposing the internal references.
- The current Worker selection parser accepts only the exact Arabic-number forms with the trailing word `備忘錄`, such as `刪除第 1 筆備忘錄`. It rejects the newly required prefix, compact, Chinese-number, list, and current-search-all forms.
- The current direct `備忘錄刪除：...` parser accepts only a canonical `memo-...` identifier, which produces the observed user-facing mismatch.
- The current snapshot schema forces `delete_all_eligible=false` and the resolver rejects `selection_mode=all`.
- Current selection delete dispatches the resolved Memo references directly to n8n. There is no non-retired pending-confirmation state machine for `確認刪除` / `取消`, actor+snapshot+selection binding, TTL 600, or single consumption.
- n8n correctly accepts only canonical Memo references already resolved by Worker. It does not receive raw LINE text, own the actor snapshot, or resolve displayed sequence numbers.

## Required authorized Worker change

1. Extend only the deterministic Memo Delete parser to accept:
   - `備忘錄刪除：第1筆`
   - `刪除第1筆`
   - `備忘錄刪除：第一筆到第五筆`
   - `刪除第1、3、5筆`
   - `備忘錄刪除：這次搜尋的全部`
   - `備忘錄刪除：全部`
2. Resolve every form only against the current actor/conversation snapshot. Never accept MBATCH text, filenames, paths, request IDs, or user-entered internal Memo identifiers as a public selection mechanism.
3. For `all`, resolve exactly the current snapshot candidates. Without a valid snapshot, Reply exactly: `妳想刪除哪些備忘錄？請先搜尋，或告訴我關鍵字／日期。`
4. Preserve the current n8n batch hard limit of five. If the current snapshot has more than five candidates, fail closed with zero dispatch and ask the user to narrow the search; never partially interpret `all`.
5. Add a new KV confirmation record separate from search snapshot and webhook acceptance:
   - same hashed actor/conversation scope
   - exact snapshot version
   - exact ordered selected Memo references and safe summaries
   - TTL 600 seconds bounded by snapshot expiry
   - status `waiting_confirmation | consumed | cancelled | expired`
   - no raw actor ID, reply token, raw message, credential, path, filename, or Memo content beyond the bounded safe summary already shown
6. The initial selection event writes only the pending confirmation and Replies with safe summaries. It must dispatch zero n8n operations.
7. Exact `確認刪除` atomically consumes the pending record before one n8n dispatch. `取消`, expiry, redelivery, actor mismatch, changed snapshot, candidate mismatch, or missing active item must dispatch zero.
8. Keep n8n preflight and archive-only semantics unchanged. The callback must preserve expected/success/failed counts; partial success must not become overall success.
9. Reuse the existing final exactly-once gate so confirmation or callback redelivery cannot produce another delete or final Reply.
10. Do not restore the retired generic CRUD path or `enqueueCrudTask`.

## Original isolated draft

The isolated prototype and tests are under:

- `proposals/memo-delete-selection-repair-gate/worker_selection_confirmation_draft.mjs`
- `proposals/memo-delete-selection-repair-gate/worker_selection_confirmation_draft.test.mjs`

They are not imported by Worker, contain no external service code, and cannot read or mutate Memo data. They remain testable reference material, while `worker/src/index.js` is the implemented local repair.

## n8n compatibility follow-up

The actor/snapshot/selection confirmation state remains exclusively in Worker. n8n received only the necessary compatibility change: require `confirmation_status=consumed`, accept `single|multiple|range|all`, keep the five-item bound, and preserve archive-only preflight plus terminal readback. The repaired workflow is Published as version `271add4b-71e9-4f06-82c6-38f7d1ca765c`。
