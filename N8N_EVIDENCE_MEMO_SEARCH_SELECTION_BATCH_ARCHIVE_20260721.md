# Memo Search Selection Candidates and Batch Archive Evidence

Date: 2026-07-21

## Scope

- Workflow: `kcMcBQos5cxsnWU1`
- Published baseline: `1067536e-7736-41ba-ae6b-ab7c7e014079`
- Gate changes only the Memo Search callback contract and adds the deterministic batch archive branch.
- Worker, credentials, production Dropbox data, Monitor, LINE delivery, and live execution were not changed or exercised during offline validation.

## Search selection contract

- Search ordering and the existing ten-result display cap remain deterministic.
- Callback adds `selection_candidates` with stable positions `1..N`, exact `memo_id`, and a bounded safe summary.
- The public Search reply contains numbered summaries and omits internal Memo identifiers.
- Candidate data contains no reply token, raw user identity, credential, or delivery secret.

## Batch archive contract

- Accepted modes: single, multiple, range, and all; all enter the same structured `memo_ids` contract.
- Batch limit: 10 unique, syntactically valid Memo identifiers.
- n8n never resolves ordinals or re-queries a selection snapshot; it accepts only the exact identifiers already resolved by the Worker.
- Each item uses exact ACTIVE and ARCHIVE paths derived from the identifier, revision-aware conditional archive-state update, no-overwrite/no-autorename move, active-absence verification, and exact nine-field archive readback.
- Existing matching archive data is accepted as same-event reentry only when the terminal JSON and event timestamp match exactly; mismatch is a conflict.
- Any failed, conflicted, or unverifiable item makes the overall result non-success. The callback contains counts and no identifiers in user-facing reply text.
- The Loop Over Items branch is batch size one and preserves item linking explicitly; loop nodes do not use the run-zero default of `first()`.

## Validation results

- New batch logic: 9/9 PASS.
- Memo CRUD: 39/39 PASS.
- Memo Delete archive: 18/18 PASS.
- Memo Create cloud writer: 16/16 PASS.
- Dropbox revision adapter: 9/9 PASS.
- Modify metadata/readback: 15/15 PASS.
- Natural Reply bridge: 9/9 PASS.
- Structured Output regression: 14/14 PASS.
- Worker regression: 58/58 PASS.
- Static workflow validation: PASS, 127 nodes, 126 connection sources.
- Credential references: OpenAI 1, Dropbox OAuth 28, Header Auth 2; all references equal the Published baseline references.
- Baseline parity: 83 unchanged Published nodes remain byte-for-byte identical; only the five declared shared contract nodes changed.
- Sensitive batch-contract scan: PASS.
- Three legacy regression assertions were updated without workflow changes: sanitized Dropbox reference types are expected instead of an empty credential object, Delete TOCTOU is proven from the actual node topology instead of non-exported custom metadata, and the Natural Reply callback check accepts n8n's harmless expression whitespace serialization.

## Safety state

- No workflow execution or LINE message was sent.
- No production Dropbox read, write, move, overwrite, or canary was performed.
- No Worker deployment or credential change was performed.
- Monitor remains STOPPED / UNLOADED.

## Publish verification

- Published the original workflow ID only; no workflow was created.
- Published version: `f5bf27d5-46f7-4503-8dad-a1d154082896`.
- Pre-publish sanitized draft parity: PASS, 127 nodes / 126 connection sources.
- Post-publish sanitized export parity: PASS, 127 nodes / 126 connection sources.
- Credential reference counts after publish: OpenAI 1, Dropbox OAuth 28, Header Auth 2.
- n8n UI serialization regenerated canvas-only node IDs/positions and omitted only the explicit default values for Loop batch size one and binary property `data`; the parity validator normalizes only these exact defaults.
- Publish was not followed by Execute, LINE delivery, Worker deployment, or live Dropbox access.
