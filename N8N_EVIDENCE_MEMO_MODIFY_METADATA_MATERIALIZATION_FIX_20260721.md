# Memo Modify Dropbox Metadata Materialization Minimal Fix

## Scope

- Workflow: `kcMcBQos5cxsnWU1`
- Published before: `e98dc9b7-b195-4aca-a9d1-528e7c256a98`
- Published after: `5f0fab6f-50e1-443b-a073-5fb740ed4fee`
- Failure occurrence: 1 for `DROPBOX_METADATA_RESPONSE_MATERIALIZATION`
- Worker, credentials, credential policy, Monitor, Dropbox data, and live LINE were not changed or executed.

## Root cause

The Modify metadata HTTP node returned a full-response wrapper whose body was retained as a serialized stream placeholder. The following Code node could not materialize that placeholder as supported plain JSON, so no top-level revision was available and the safe update gate stayed closed.

## Minimal fix

- `Dropbox Modify Metadata` retains JSON response format but disables the full-response wrapper and `Never Error`. Its existing `continueRegularOutput` error policy remains unchanged.
- Successful metadata responses therefore reach the next node as supported plain JSON with a top-level `rev:string`.
- `Memo Modify Metadata Check` reads only that top-level revision and rejects wrappers, arrays, errors, missing revisions, malformed revisions, or invalid handoff fields.
- Its safe handoff remains `rev`, `revision`, `path`, `memo_id`, `expected_content`, and `updated_content`.
- The conditional update remains `mode=update(rev)`, `autorename=false`, and `strict_conflict=true`.
- No stream-private fields are parsed or treated as a contract.

## Validation

- Metadata materialization and handoff: 11/11 PASS.
- Memo CRUD offline suite: 35/35 PASS.
- Dropbox revision adapter: 8/8 PASS.
- Memo Create cloud-writer regression: 16/16 PASS.
- Structured Output regression: PASS.
- Applicable Worker, Reply-first, bounded ACK, checkpoint, idempotency, and exactly-once regression: 49/49 PASS.
- Static topology: 84 nodes and 83 connection sources; no duplicate or dangling nodes.
- Published diff: only `Dropbox Modify Metadata` and `Memo Modify Metadata Check` parameters changed.
- Published connections, pin data, Dropbox OAuth reference, and Header Auth reference are unchanged.
- Local sanitized target parameters match the downloaded Published export.
- No workflow execution, live request, LINE message, or Dropbox operation was performed.

## Backup

`backups/memo-modify-metadata-materialization-fix-20260721-115120/`

The directory preserves the before and after Published exports, local before files, directly related tests/evidence, and the pre-change working-tree diff. No credential value, token, raw webhook payload, reply token, raw user identity, or Memo content was added to this evidence.
