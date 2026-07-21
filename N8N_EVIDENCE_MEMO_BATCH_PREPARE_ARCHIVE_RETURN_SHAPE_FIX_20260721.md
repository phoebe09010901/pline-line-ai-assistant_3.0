# Memo Batch Delete Prepare Archive Return Shape Fix

- Gate: Memo Multi-Position Delete Minimal Implementation
- Phase: Prepare Archive Error Diagnosis＋Minimal Fix
- Workflow: `kcMcBQos5cxsnWU1`
- Execution inspected: `1137` (read-only)
- Published before: `10c5ea99-7f57-4375-86d5-224d7964ad45`
- Published after: `a88e1361-c4fa-4f44-b79b-a0fe9c44e7c2`
- Live retest: NOT RUN
- Worker change/deployment: none
- Monitor: STOPPED／UNLOADED

## Safe diagnosis

- `Memo Batch Delete Prepare Archive` received three items after inventory and source readback.
- The node was configured as `Run Once for Each Item` but returned an array containing one item.
- n8n rejected the first return value with the safe runtime class `json_property_not_object` before emitting any valid output item.
- The executed-node boundary ended at Prepare Archive. Conditional archive-state update and collision-safe move were not executed.
- Dropbox write/move before failure: zero.

## Minimal fix

- Only the Prepare Archive Code node return wrapper changed from a one-element array to one item object.
- Validation predicates, expected archive JSON, batch fields, node mode, node ID, connections, credentials, callback behavior, and all other nodes are unchanged.
- The builder and direct/static tests were updated to lock the supported per-item return contract.

## Verification

- Direct batch archive suite: 19/19 PASS, including actual Code-node execution for three-item comma, four-item range, single-item, and malformed inputs.
- Memo CRUD: 39/39 PASS.
- Memo Delete: 18/18 PASS.
- Worker non-retired suite: 69/69 PASS.
- Memo Create, Modify, Dropbox revision adapter, Natural Reply, Reply-first, and checkpoint regressions: PASS.
- Static topology: 137 nodes and 136 connection sources; PASS.
- Draft versus Published-before: exactly one changed node and no connection changes.
- Published-after semantic parity: PASS.
- Credential references: Dropbox OAuth 28, Header Auth 2, OpenAI 1; parity PASS.
- No workflow Execute, LINE send, live Dropbox operation, Worker deploy, credential change, or Monitor start occurred.

## Backup

`backups/memo-batch-prepare-fix-20260721-222536`

The timestamped backup contains the sanitized Published-before export, local-before files, direct tests, pre-change diff, sanitized draft, and sanitized Published-after export.
