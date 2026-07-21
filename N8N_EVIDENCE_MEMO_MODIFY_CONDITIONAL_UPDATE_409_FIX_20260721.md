# Memo Modify Conditional Update 409 — Minimal Fix Evidence

## Gate

- Gate: `Memo Modify Conditional Update 409 Diagnosis and Minimal Fix`
- Workflow: `kcMcBQos5cxsnWU1`
- Execution inspected: `1044` (read-only)
- Published before: `7ae12a67-ea65-4f7d-80fa-918976885728`
- Published after: `572818e4-e114-4677-9c22-380fb4f543fd`
- Live test: not run

## Safe diagnosis

- Conditional update returned HTTP 409; the retained response body was not safely materialized, so the exact Dropbox error subtag was not recorded.
- The single update item retained a non-empty lowercase-hex revision; `rev` and `revision` were identical.
- The canonical active memo path, expected update content, and serialized update body were present exactly once.
- The existing endpoint remained `https://content.dropboxapi.com/2/files/upload` with `mode=update(rev)`, `autorename=false`, and `strict_conflict=true`.
- The first proven request-contract defect was the raw non-ASCII active path in `Dropbox-API-Arg`. Dropbox requires non-ASCII header characters to be represented as JSON `\uXXXX` sequences.

## Minimal fix

- `Dropbox Modify Conditional Update`: serialize `Dropbox-API-Arg` as 7-bit header-safe JSON while preserving the exact decoded path, update revision, `autorename=false`, and `strict_conflict=true`.
- `Memo Modify Metadata Check`: accept only Dropbox file revisions matching lowercase hexadecimal with length 9–255.
- Missing, malformed, or stale revision remains fail-closed; there is no overwrite fallback or automatic retry.
- No node, connection, endpoint, credential type, response text, Create, Search, Delete, Worker, or Monitor change was made.

## Offline verification

- Modify metadata shape: 11/11 PASS.
- Memo Search/Modify/Delete contract: 35/35 PASS.
- Dropbox revision adapter: 9/9 PASS.
- Memo Create cloud writer: 16/16 PASS.
- Structured Output checkpoint: 14/14 PASS.
- Worker Reply-first, bounded ACK, checkpoint, idempotency, and exactly-once suite: 49/49 PASS.
- Unicode path header is ASCII-only before transport and JSON-decodes to the exact original Dropbox path.
- Matching revision mock performs one conditional write; stale revision returns conflict with zero write.

## Published parity

- Nodes: 84 before / 84 after.
- Connection sources: 83 before / 83 after.
- Connections: identical.
- Structural node changes: none.
- Parameter changes: exactly `Memo Modify Metadata Check` and `Dropbox Modify Conditional Update`.
- Dropbox OAuth and Header Auth credential-type references: unchanged.
- Raw downloaded exports were removed after producing the sanitized Published-after export.
- Monitor remained `STOPPED / UNLOADED`; workflow was not executed and LINE was not used.

## References

- Dropbox API specification: `files.stone` (`WriteMode.update`, `strict_conflict`, and file revision semantics).
- Dropbox API v2 upload style: binary body with JSON arguments in `Dropbox-API-Arg`.
- Dropbox moderator guidance: non-ASCII characters in `Dropbox-API-Arg` must be JSON `\uXXXX` escaped so the HTTP header remains safe.
