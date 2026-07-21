# Memo Delete Archive Metadata Unique-Match — Minimal Fix Evidence

## Gate

- Gate: `Memo Delete Archive Metadata Unique-Match Minimal Fix`
- Workflow: `kcMcBQos5cxsnWU1`
- Execution inspected: `1050` (read-only)
- Published before: `bb1ce71c-d14d-4125-99e2-bae7af851db6`
- Published after: `3e24bc86-fa60-4725-841d-f406297c8003`
- Failure occurrence: 1
- Live test: not run
- Worker and credentials: unchanged
- Monitor: STOPPED / UNLOADED

## Safe diagnosis

- `Dropbox Delete Archive Metadata` produced two current-execution items.
- Exactly one item matched the canonical target filename and archive path.
- The exact target was a file and exposed a legal Dropbox revision string.
- The other item was non-target data and is not identified or retained in this evidence.
- `Memo Delete Archive Metadata Check` ran once for all input items and used `$input.all()`; the execution mode was not the failure.
- The target's current archive revision differed from the pre-move `updated_revision`.
- The previous validator required those two revisions to be equal, so it emitted `continue_operation=false` and hid the otherwise valid archive revision.
- No raw filename, path, Memo content, credential, header, reply token, user identity, or payload is stored here.

## Minimal fix

- Only `Memo Delete Archive Metadata Check` changed.
- The validator still requires exactly one canonical filename/path match, `type=file`, no error field, and a legal current archive revision.
- It also retains validation that the safe pre-move `updated_revision` is present and syntactically legal, but no longer assumes a Dropbox move preserves identical revision text.
- Zero or multiple exact matches, missing or malformed revision, wrong type/path/name, or malformed prior handoff remain fail-closed.
- Active-source absence and exact nine-field archive readback remain mandatory before terminal success.
- No revision/readback bypass, overwrite fallback, autorename, or permanent-delete path was added.

## Verification

- Delete focused offline suite: 18/18 PASS, including two list items with exactly one target, zero targets, duplicate targets, and missing/malformed target revision.
- Static minimal-scope validation: 11/11 PASS.
- Memo CRUD regression: 39/39 PASS.
- Modify metadata/response regression: 15/15 PASS.
- Dropbox revision adapter: 9/9 PASS.
- Memo Create regression: 16/16 PASS.
- Structured Output checkpoint regression: 14/14 PASS.
- Worker Reply-first, bounded ACK, checkpoint, idempotency, and exactly-once suite: 49/49 PASS.
- Pre-Publish and post-Publish sanitized parity: 9/9 PASS.

## Published parity and safety

- Nodes: 84 before / 84 after.
- Connection sources: 83 before / 83 after.
- Node names and all connections are unchanged.
- Exactly one node changed: `Memo Delete Archive Metadata Check`.
- Dropbox OAuth and Header Auth credential reference types remain unchanged and redacted.
- No workflow execution, LINE send, formal Dropbox operation, Worker deployment, Monitor start, or KV operation was performed.
- The retired live fixture was not reused, modified, moved, or inspected outside the retained execution summary.
- Raw downloaded exports were removed after sanitized copies were produced.
