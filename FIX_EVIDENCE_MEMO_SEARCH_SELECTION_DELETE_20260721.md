# Memo Search Result Selection Delete — FIX Evidence

- Gate: `Memo Search Result Selection Delete Contract and Worker Minimal Fix`
- Status: `PASS_LOCAL_NOT_DEPLOYED`
- Worker deployed: `no`
- n8n changed/published/executed: `no / no / no`
- LINE live test: `NOT_RUN`

## Existing protected mechanism

The existing `IDEMPOTENCY_KV` binding is reused. One snapshot key is derived from a salted SHA-256 hash of LINE actor plus conversation scope. The record has a 600-second TTL and contains only:

- fixed schema
- safe scope hash
- safe Search event hash/version
- ordered `{position,memo_id}` candidates, at most 10
- created/expiry timestamps

It does not contain raw LINE User ID, replyToken, message/search text, content summary, credential, secret, filename, or path. A later successful Search writes the same scope key and replaces the earlier snapshot.

## Worker contract

- Supported user commands:
  - `刪除第 2 筆備忘錄`
  - `刪除第 2、4、5 筆備忘錄`
  - `刪除第 2 到第 5 筆備忘錄`
  - `刪除全部`
- `刪除全部` resolves only the current snapshot candidates; no active-folder scan contract exists.
- Missing, expired, malformed, empty, out-of-range, or duplicate selections are durably accepted as safe validation failures, receive one natural Reply, and dispatch zero n8n batch operations.
- The existing full memo-ID delete command remains as an internal/legacy deterministic contract.
- Search callback candidates are validated as a bounded structured array. Worker stores only internal IDs and constructs numbered LINE text without exposing memo IDs.
- Selection delete dispatch carries only the exact resolved ordered memo ID array plus safe event/snapshot identity and the existing opaque callback reference.
- Callback success/failure must echo the exact ordered array; Worker validates it before the existing final exactly-once gate.

## Validation

- Direct selection and Memo route tests: `33/33 PASS`
- Complete current Worker regression excluding the explicitly retired CRUD-era test: `58/58 PASS`
- Existing Memo CRUD n8n offline regression: `39/39 PASS`
- Syntax, static validation, and `git diff --check`: `PASS`
- Wrangler dry-run: `PASS`, Worker name and existing bindings unchanged; no deployment performed.
- Existing local n8n workflow diff hash before/after this Gate: identical.

## Required next n8n work

Batch archival is not implemented in this Gate. The exact protected Search callback and batch-delete input/output contract is recorded in:

`N8N_HANDOFF_MEMO_SEARCH_SELECTION_DELETE_20260721.md`

The next existing n8n Gate must reuse the current revision-aware single-item archive pipeline per supplied memo ID, add bounded per-item exactly-once/re-entry state, return one aggregate callback, and never treat partial failure as overall success.
