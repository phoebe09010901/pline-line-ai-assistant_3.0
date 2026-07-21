# N8N Handoff — Memo Search Result Selection Delete

Status: `WORKER_CONTRACT_READY / N8N_NOT_CHANGED`

Target existing workflow: `kcMcBQos5cxsnWU1`

## 1. Search callback contract

For a successful `memo_search`, the existing protected Memo callback must add:

```json
{
  "operation": "memo_search",
  "status": "completed",
  "total": 3,
  "selection_candidates": [
    { "position": 1, "memo_id": "memo-<64 lowercase hex>", "summary": "safe bounded summary" }
  ],
  "reply_text": "safe text without memo_id"
}
```

Rules:

- `selection_candidates` is ordered, at most 10 items, positions exactly `1..N`, with unique full memo IDs.
- `total` is an integer greater than or equal to the candidate count.
- `reply_text` must not contain memo IDs, filenames, Dropbox paths, credentials, or engineering fields.
- Worker validates the structured fields, stores only `{position,memo_id}` in the protected short-lived snapshot, and constructs the numbered LINE text itself.
- Empty successful search sends `total=0` and `selection_candidates=[]`, replacing the prior snapshot with an empty snapshot.
- The callback remains Header-Auth protected and must not contain raw LINE identity or replyToken.

## 2. Selection-delete input from Worker

The existing protected n8n webhook will receive:

```json
{
  "intent": "memo_delete",
  "safe_event_hash": "<64 lowercase hex>",
  "received_at": "<ISO-8601 UTC>",
  "delete_scope": "memo_search_selection_snapshot",
  "selection_mode": "single|multiple|range|all",
  "selection_snapshot_version": "<64 lowercase hex>",
  "memo_ids": ["memo-<64 lowercase hex>"],
  "reply_delivery_reference": {
    "callback_url": "<existing exact callback URL>",
    "task_id": "<opaque safe reference>",
    "request_id": "<opaque safe reference>"
  }
}
```

Rules:

- `memo_ids` is non-empty, unique, ordered, and at most 10 items.
- Do not accept paths, filenames, partial IDs, user-provided memo IDs, or an unbounded `delete_all` flag.
- `all` means exactly the supplied snapshot memo IDs; n8n must never scan all active Memo files for this command.
- Derive active/archive paths only from each validated full memo ID using the existing safe path builder.

## 3. Batch archive behavior

- Reuse the existing single-item revision-aware archive pipeline for every supplied memo ID:
  `metadata -> conditional update(expected_rev) -> pre-move revision check -> collision-safe move -> active absence -> archive metadata/readback`.
- Never permanently delete and never overwrite an archive collision.
- Maintain per-item terminal state so retrying the same safe event does not move an already completed item again.
- An item already archived with exact expected terminal readback may be treated as idempotent completion; ambiguous or mismatched state is failure, never success.
- Produce exactly one protected callback after every item reaches a terminal result.
- Any partial failure returns overall `failed` or `conflict`; never report overall success. The workflow must remain safely re-entrant for unfinished items.

## 4. Batch callback and n8n response

The protected callback and the final webhook response must echo the exact ordered `memo_ids` array:

```json
{
  "intent": "memo_delete",
  "operation": "memo_delete",
  "status": "completed|duplicate|failed|conflict|readback_failed",
  "memo_ids": ["memo-<64 lowercase hex>"],
  "callback_sent": true,
  "reply_text": "natural Traditional Chinese text without any memo ID"
}
```

- Success/duplicate is accepted only when the returned ordered array exactly matches the Worker durable record.
- Failure callbacks must also include the exact ordered array so Worker can authenticate the batch identity before replying.
- Callback remains single/final exactly-once; no processing Push and no additional public route.

## 5. Required n8n offline checks

- Structured Search candidates are ordered, bounded and ID-free in visible reply text.
- Single, multiple, range and all modes use only the supplied memo ID list.
- Empty/malformed/duplicate IDs reject with zero Dropbox move.
- Archive collision causes zero overwrite.
- Partial failure is not overall success and retry skips terminal completed items.
- Callback and response arrays match Worker input exactly.
- Existing Memo Create/Search/Modify/single-ID Delete, Header Auth, Reply-first and redaction regressions remain PASS.
