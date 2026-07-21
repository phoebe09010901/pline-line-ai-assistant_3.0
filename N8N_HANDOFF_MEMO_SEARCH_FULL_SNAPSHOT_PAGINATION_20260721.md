# Memo Search Full Snapshot and Pagination — n8n Handoff

Status: Worker local contract only; not deployed. n8n is unchanged in this Gate.

Current partial Published baseline: `f5bf27d5-46f7-4503-8dad-a1d154082896`.

## Safety boundary

- A Search snapshot is actionable only when the callback supplies the complete, ordered candidate ID set.
- Maximum complete candidate count: 100.
- Page size: 10.
- Snapshot TTL: 600 seconds from the Search completion. Page reads must not extend it.
- The snapshot contains only schema/version fields, safe scope/event hashes, timestamps, pagination integers/booleans, and ordered `{ position, memo_id }` entries.
- It must not contain summaries, Memo content, raw LINE User ID, replyToken, credentials, secrets, paths, filenames, headers, bodies, or payload copies.
- A callback with `total > 100` or `selection_candidates.length !== total` is fail-closed. It invalidates the previous actionable snapshot and asks the user to narrow the Search.

## Search completion callback contract

For `operation=memo_search`, a successful protected callback must provide:

```json
{
  "operation": "memo_search",
  "status": "completed",
  "total": 15,
  "page": 1,
  "selection_candidates": [
    { "position": 1, "memo_id": "memo-<64 lowercase hex>" }
  ],
  "page_candidates": [
    { "position": 1, "memo_id": "memo-<same exact id>", "summary": "safe summary" }
  ]
}
```

Requirements:

- `selection_candidates` contains all results, positions `1..total`, in the deterministic Search order; IDs are unique.
- `page_candidates` contains exactly positions `1..min(total,10)` and IDs must match the first slice of `selection_candidates` in the same order.
- Summaries exist only in `page_candidates`; Worker validates, redacts, bounds, renders them, and does not persist them.
- `reply_text` is not trusted as the full candidate source.
- The current partial shape (`total=15`, only 10 selection candidates) remains safely rejected; Worker does not infer missing IDs.

## Page request contract

Worker sends the existing protected n8n webhook a deterministic request:

```json
{
  "intent": "memo_search_page",
  "safe_event_hash": "<safe hash>",
  "received_at": "<ISO timestamp>",
  "page_scope": "memo_search_selection_snapshot",
  "selection_snapshot_version": "<safe search event hash>",
  "page_number": 2,
  "page_count": 2,
  "total": 15,
  "global_start": 11,
  "memo_ids": ["memo-<64 lowercase hex>"],
  "reply_delivery_reference": {
    "callback_url": "<existing protected callback URL>",
    "task_id": "<opaque reference>",
    "request_id": "<opaque reference>"
  }
}
```

n8n must:

1. Accept only `intent=memo_search_page` through the existing protected webhook/auth path.
2. Validate the page integers and each full Memo ID.
3. Read back only the exact supplied IDs from the active Memo store.
4. Preserve the supplied order and global positions; do not Search again, sort again, add candidates, or accept user-built paths.
5. Fail the whole page if any requested candidate is missing, invalid, duplicated, or no longer active.
6. Return the normal immediate completion envelope with `callback_sent=true` and the same ordered `memo_ids`.
7. Send one protected callback containing the same ordered `memo_ids` plus:

```json
{
  "operation": "memo_search_page",
  "status": "completed",
  "memo_ids": ["memo-<64 lowercase hex>"],
  "page_candidates": [
    { "position": 11, "memo_id": "memo-<same exact id>", "summary": "safe summary" }
  ]
}
```

Worker rejects any ID/order/position mismatch, does not update `current_page`, and sends only a safe failure reply. On success it atomically updates only `current_page` while preserving the original absolute expiry.

## Selection and batch execution boundary

- Parser syntax supports single, comma-list, range, and all-selection commands.
- Explicit list/range parsing is bounded to 10 selected positions, but positions are global across the full snapshot (for example, position 12 is valid on page 2).
- `刪除全部` always means all candidates in the complete latest snapshot, never an active-store scan.
- Live execution authorized limit is currently 1 selected Memo for every selection mode, including list, range, and all.
- Any resolved selection containing more than 1 ID is rejected before n8n dispatch with `selection_batch_limit_unverified`.
- A later Gate may raise this limit only after deterministic and live evidence proves the full archive/readback/final path completes safely inside Reply eligibility. Parser support alone is not authorization.

## Required n8n tests for the next Gate

- 15 results: complete ID callback, page 1 positions 1–10, page 2 exact readback positions 11–15.
- Next/previous/specific page request, missing/expired/out-of-range Worker handling.
- Missing or reordered page ID fails with zero expansion and zero guessed summary.
- Search result over 100 produces no actionable snapshot.
- Search callback with only the first 10 of 15 candidates fails closed.
- No raw User ID, replyToken, credential, secret, raw payload, content, path, or filename in the Worker snapshot.
- Existing Memo Create/Search/Modify/Delete, Reply-first, bounded ACK, Header Auth, idempotency, and final exactly-once regressions remain PASS.
- Multi-item selection remains dispatch-blocked until a separately authorized live batch limit is proven.
