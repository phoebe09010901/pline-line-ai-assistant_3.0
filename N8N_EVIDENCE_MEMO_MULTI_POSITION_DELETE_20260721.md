# Memo Multi-Position Delete — n8n Batch Archive and Aggregate Final

- Gate: Memo Multi-Position Delete Minimal Implementation
- Phase: n8n Batch Archive＋Aggregate Final
- Workflow: `kcMcBQos5cxsnWU1`
- Published before: `58974dda-8421-4db8-815f-728054177c04`
- Published after: `10c5ea99-7f57-4375-86d5-224d7964ad45`
- Live workflow execution: NOT RUN
- Worker change/deployment: none
- Monitor: STOPPED／UNLOADED

## Implemented contract

- Batch limit is 5; only `single`, `multiple`, and `range` are accepted.
- Blank mode, `all`, duplicate IDs, invalid IDs, empty arrays, and more than five IDs fail closed before Dropbox.
- All active sources, revisions, source JSON, and archive collisions are preflighted for the full batch before any update or move.
- Items execute sequentially after preflight, using revision-aware archive-state update, collision-safe move, active-absence verification, and exact nine-field archive readback.
- A terminal item failure stops the unstarted suffix and emits one safe aggregate failure.
- Same-event archived-source and completed-archive states are recognized for safe resume without a second update or move.
- Only a fully completed batch emits one aggregate success callback with `success_count=N`; there is no per-item callback or Push.

## Verification

- Direct batch archive tests: 17/17 PASS.
- Memo CRUD regression: 39/39 PASS.
- Memo Delete regression: 18/18 PASS.
- Worker non-retired test suite: 69/69 PASS.
- Memo Create, Modify metadata, Dropbox revision adapter, Natural Reply, and checkpoint structured-output regressions: PASS.
- Static validation: PASS at 137 nodes and 136 connection sources.
- Credential reference counts: OpenAI 1, Dropbox OAuth 28, Header Auth 2; reference parity PASS.
- Draft parity: PASS.
- Downloaded Published semantic parity: PASS; empty `pinData` and expected version ID confirmed.
- No workflow Execute, LINE send, live Dropbox mutation, Worker deploy, credential change, or Monitor start occurred.

## Backup

Timestamped backup: `backups/memo-multi-position-delete-20260721-214823`

It contains the Published-before sanitized export, local-before files, direct tests, pre-change diff, sanitized draft, and sanitized Published-after export.
