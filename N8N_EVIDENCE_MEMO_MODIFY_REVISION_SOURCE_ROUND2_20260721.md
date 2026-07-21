# Memo Modify Dropbox Revision Source Minimal Fix Round 2

- Gate date: 2026-07-21 (Asia/Taipei)
- Workflow: `kcMcBQos5cxsnWU1`
- Published before: `5f0fab6f-50e1-443b-a073-5fb740ed4fee`
- Published after: `7ae12a67-ea65-4f7d-80fa-918976885728`
- Live execution inspected: `1042` (read-only; never retried)
- Live test in this Gate: not run

## Root cause and safe source

The existing Modify metadata HTTP Request called Dropbox RPC `files/get_metadata`.
Dropbox defines this as a JSON metadata response with a top-level file revision,
but execution 1042 retained only a serialized stream-shaped object. It retained
neither a supported plain JSON body nor response headers, so no safe revision
could be materialized. Private stream state was explicitly rejected as a
contract source.

The replacement uses the existing native Dropbox OAuth node to list the exact
active Memo directory. The node returns supported plain item JSON including
file type, path and top-level revision fields. `Memo Modify Metadata Check` runs
once for all items, selects exactly one file whose normalized path equals the
validated target path, accepts only a bounded revision string, and forwards only:

- `rev`
- `revision`
- `path`
- `memo_id`
- `expected_content`
- `updated_content`

Missing, malformed, error, duplicate or nonmatching entries produce
`continue_operation=false`; the conditional update does not run. The Dropbox
node has `Always Output Data` and `Continue` enabled so empty/error results reach
the existing safe failure final.

## Scope and parity

- Changed functional nodes: `Dropbox Modify Metadata`, `Memo Modify Metadata Check`
- Node count: 84 before / 84 after
- Connection sources: 83 before / 83 after
- Connection changes: none
- Duplicate node names: zero
- Dangling connection targets: zero
- Dropbox OAuth credential type/reference: present and unchanged in kind
- Finalizer Header Auth credential type/reference: present and unchanged in kind
- Create, Search and Delete nodes/connections: unchanged
- Worker and credential policy: unchanged

## Redaction

The normalized output contains no response headers, raw body, stream internals,
reply token, raw user identity, secret or credential. Published exports in the
project backup redact credential reference values and retain only credential
type presence. Temporary raw downloads were removed after sanitization.

## Verification

- Modify metadata-shape tests: 11/11 PASS
- Memo CRUD tests: 35/35 PASS
- Revision adapter tests: 8/8 PASS
- Memo Create tests: 16/16 PASS
- Structured Output tests: 14/14 PASS
- Worker/checkpoint/Reply-first/bounded-ACK tests: 49/49 PASS
- Published safe export parity: PASS
- Workflow execution / LINE / Dropbox live mutation: NOT RUN

An initial Published draft was superseded after parity detected that the native
node needed explicit empty/error-output settings. The final Published version
above includes both settings and passed the final sanitized parity check.
