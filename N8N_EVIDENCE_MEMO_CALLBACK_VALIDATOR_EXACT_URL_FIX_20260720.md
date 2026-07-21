# Memo Create Callback Validator Exact-URL Minimal Fix

- Gate: `Memo Create Callback Validator Exact-URL Minimal Fix`
- Fix round: `1`
- Workflow: `kcMcBQos5cxsnWU1`
- Published version before: `9683b218-2e56-44ed-a1ca-472fa1c37c02`
- Published version after: `858c7df5-99da-4ebc-a4eb-bc87eb9646b6`
- Live execution: `NOT_RUN`
- Worker deployment: `NOT_RUN`

## Minimal change

Only `Memo Build and Validate` changed:

- Removed the `new URL(...)` runtime dependency and its empty `catch`.
- Read `reply_delivery_reference.callback_url` without trimming or case normalization.
- Accepted only an exact match to the single protected HTTPS callback URL.
- Added the safe failure reason `invalid_callback_url`; no callback value is returned on rejection.

## Verification

- Memo Create cloud-writer offline suite: PASS, 14/14 grouped assertions.
- Fixed callback: PASS.
- Query, hash, trailing slash, other host, other path, case, leading whitespace and trailing whitespace: rejected.
- Missing `URL` global: exact fixed callback remains accepted.
- First create/readback, duplicate, collision mismatch and Dropbox failure fixtures: PASS.
- Checkpoint, Path A, bounded ACK and Reply-first regression: PASS, 25/25 tests.
- Workflow JSON and JavaScript syntax: PASS.
- Workflow identity and topology: PASS, 20 nodes and 23 connections.
- Non-target nodes: byte-equivalent after canonical JSON normalization.
- Connections: unchanged.
- Credential references: unchanged.
- Published download equals the pre-publish draft download.
- Local target node code equals the Published target node code.
- Search, Modify, Delete, CRUD, Calendar, delegate and removed route guards: PASS.
- `git diff --check`: PASS.

## Backup

`backups/memo-callback-validator-exact-url-20260720-215343/`

The backup contains the pre-change Published download, local workflow, builder, direct tests, evidence, full working-tree diff, direct diff, pre-publish draft download and post-publish download.

No secret, credential value, reply token, raw user identity, raw payload or retired Memo content is recorded here.
