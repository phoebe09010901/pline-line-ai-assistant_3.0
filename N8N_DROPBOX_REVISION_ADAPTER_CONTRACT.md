# Dropbox Revision-Aware Existing OAuth Adapter Contract

Status: local capability contract only. It is not Published, Executed, or connected to the active workflow.

## Authentication boundary

- n8n authentication mode: `predefinedCredentialType`.
- Existing credential type: `dropboxOAuth2Api`.
- The actual credential reference must be selected from the already-existing workflow credential at deployment time. Its name, ID, and value are never exported to this repository.
- No generic bearer token, inline `Authorization` header, Code-node credential access, new credential, OAuth reauthorization, sharing change, or policy expansion is allowed.

## Fixed API surface

Only the following exact `POST` endpoints are permitted:

- `https://api.dropboxapi.com/2/files/get_metadata`
- `https://content.dropboxapi.com/2/files/upload`
- `https://content.dropboxapi.com/2/files/download`
- `https://api.dropboxapi.com/2/files/move_v2`

Every path is derived from an exact `memo-[a-f0-9]{64}` identifier. User input can never supply a URL, directory, slash, relative segment, or Dropbox path.

## Conditional modify contract

1. `get_metadata` reads the current active file revision.
2. The expected revision is carried as an opaque bounded value in memory only.
3. `files/upload` uses `mode={".tag":"update","update":"<expected-rev>"}`, `autorename=false`, and `strict_conflict=true`.
4. A missing revision is rejected locally. A stale revision is a conflict and must produce safe HTTP 409 handling with no overwrite and no success finalization.
5. The modified file must be downloaded/read back and semantically verified before success finalization.

## Revision-bound archive/delete contract

1. Read active metadata and content.
2. Change the active Memo to its archived JSON state using conditional `upload update(rev0)`. This is the actual revision-protected write and returns `rev1`.
3. Immediately call `get_metadata` again and require the returned revision to equal `rev1`.
4. Only after that equality check, call `move_v2` from the exact active path to the exact archive path with `autorename=false`.
5. A destination collision is a conflict: zero overwrite, no success finalization, and the source must remain available for safe reconciliation.
6. Download/read back the archive result before final success.

`move_v2` has no source-revision parameter. Therefore step 3 and step 4 are not atomic: another actor can change the source after the final metadata check but before the move. This adapter documents that metadata-to-move TOCTOU race and never calls the move revision-atomic. If the product requires a strict atomic source-revision move, the Dropbox API surface in this contract cannot provide it and the next Gate must stop rather than claim stronger safety.

## Failure and privacy policy

- Revision mismatch, archive collision, missing revision, unsafe path, unexpected host, unexpected endpoint, and readback mismatch are terminal operation failures; they do not emit a success callback.
- No token, credential reference details, raw LINE User ID, reply token, finalize token, raw webhook payload, or sensitive headers may appear in request bodies, output, logs, evidence, or health.
- This helper does not alter Memo Create, `idea_create`, fixed `codex_task`, Header Auth callback, Reply-first, Worker, Monitor, or the active n8n workflow.
