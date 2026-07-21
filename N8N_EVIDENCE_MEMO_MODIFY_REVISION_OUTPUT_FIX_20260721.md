# Memo Modify Dropbox Revision Output Minimal Fix

## Scope

- Workflow: `kcMcBQos5cxsnWU1`
- Published before: `fad98dad-d5a4-4013-9b18-2eb88b1f6899`
- Published final: `e98dc9b7-b195-4aca-a9d1-528e7c256a98`
- Worker, credential policy, Monitor, Dropbox data, and live LINE were not changed or executed.

## Root cause

Execution 1038 showed that the successful Dropbox metadata HTTP node produced a full-response object whose `body` was a readable stream containing the JSON metadata. The existing Modify check assumed a parsed object at `response.body.rev`, so the revision normalized to an empty string and the safe failure route blocked the conditional update.

The stored fixture records only the de-identified field shape and types. It contains no payload values, memo content, user identity, reply token, header, or credential data.

## Minimal fix

- `Memo Modify Metadata Check` now accepts the observed readable-stream body and the already-supported JSON object/string/buffer forms, parses only the current item, validates a non-empty opaque `rev`, and fails closed on missing, empty, malformed, or error responses.
- Its explicit safe handoff includes `rev`, the legacy-compatible `revision` alias, `path`, `memo_id`, `expected_content`, and `updated_content`.
- `Dropbox Modify Conditional Update` reads the normalized `path` and `rev` while retaining `mode=update(rev)`, `autorename=false`, and `strict_conflict=true`.
- Create, Search, Delete, Header Auth, Dropbox credential references, and all connections are unchanged.

## Validation

- Metadata shape tests: 10/10 PASS.
- Memo CRUD tests: 35/35 PASS.
- Dropbox revision adapter: 8/8 PASS.
- Memo Create cloud-writer regression: 16/16 PASS.
- Structured Output legacy subgraph regression: PASS.
- Applicable Worker/Reply-first/bounded-ACK/checkpoint regression: 49/49 PASS.
- Static topology: 84 nodes, 83 connection sources, no duplicate or dangling nodes.
- Published parity: only `Memo Modify Metadata Check` and `Dropbox Modify Conditional Update` differ from the before export; local and final Published parameters match exactly.
- Credential reference parity and Header Auth parity: PASS.
- No workflow execution or live request was performed.

## Publish note

An interim version exposed an n8n expression-editor concatenation during post-publish export comparison. It was never executed and was immediately superseded. The final Published export was downloaded and matched byte-for-byte at the two changed parameter blocks.

## Backup

`backups/memo-modify-revision-output-fix-20260721-100920/`

The directory preserves the before Published export, the final Published export, the local before files, and the pre-change working-tree diff without credential values or private execution payloads.
