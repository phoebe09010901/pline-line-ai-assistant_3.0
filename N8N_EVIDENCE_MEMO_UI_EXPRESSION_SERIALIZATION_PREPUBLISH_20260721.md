# Memo UI Expression Serialization Pre-Publish Evidence

## Gate

- Gate: `Memo UI Expression Serialization Pre-Publish Fix`
- Workflow: `kcMcBQos5cxsnWU1`
- Current Published version: `3e24bc86-fa60-4725-841d-f406297c8003`
- Target node: `Dropbox Modify Conditional Update`
- Target parameter: `Dropbox-API-Arg` expression
- Live test: not run
- Worker and credentials: unchanged

## Safe diagnosis

- The n8n editor showed the workflow as `Published`; there was no unpublished functional draft.
- The target expression in the expanded UI editor contained 271 characters and no serialized leading equals marker.
- The sanitized download contained 272 characters and exactly one leading equals marker.
- This is n8n's normal UI/export representation: the expression editor hides the serialization marker and the exported workflow restores exactly one marker.
- There was no second marker or other extra character to remove.
- Editing the visible expression solely to remove a character would have damaged the valid expression, so no parameter was changed and no no-op version was published.

## Parity

- Local expected expressions: 44.
- Current downloaded expressions: 44.
- Expression differences: zero; all expression strings are exact.
- Target expression is exact across local expected, current sanitized download, and current Published sanitized export.
- Nodes: 84 / 84 with identical names.
- Semantic connections: 105 / 105 with no missing or extra edge; connection sources remain 83.
- Current sanitized download and current Published sanitized export are byte-identical.
- Dropbox OAuth and Header Auth credential-type references are identical between the two sanitized exports.
- `pinData` is empty and sensitive runtime fields are absent.
- Dropbox revision adapter validation: 9/9 PASS.

## Safety

- No workflow node, expression, connection, credential, Worker, Monitor, or Memo JSON was changed.
- No workflow Publish, Execute, LINE send, Worker deployment, credential mutation, or formal Dropbox operation was performed.
- The raw download was removed after the sanitized copy was created.
- Existing unrelated working-tree changes were preserved.
