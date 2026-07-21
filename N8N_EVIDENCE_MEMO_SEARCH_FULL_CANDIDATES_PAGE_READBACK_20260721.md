# Memo Search Full Candidates and Page Readback N8N Fix

Date: 2026-07-21
Workflow: `kcMcBQos5cxsnWU1`

## Published versions

- Before: `f5bf27d5-46f7-4503-8dad-a1d154082896`
- After: `58974dda-8421-4db8-815f-728054177c04`
- Workflow identity unchanged; no new workflow was created.

## Implemented contract

- Memo Search returns the complete ordered `selection_candidates` identity list when the valid result count is at most 100.
- The user-visible first page contains at most 10 globally numbered, bounded content summaries plus the total and page count; it contains no Memo identity.
- More than 100 results fails closed with no actionable candidate snapshot.
- `memo_search_page` accepts only the exact ordered page identities supplied by the Worker contract, performs exact read-only Dropbox readback, preserves global positions, and never re-searches or re-sorts.
- Missing, duplicate, malformed, reordered, non-active, or incomplete page inputs fail closed.
- Selection batch archive authorization is fixed at one item. Any request containing more than one identity fails before a Dropbox node.
- Create, Search, Modify, Delete, Natural Reply, Reply-first, Header Auth, checkpoint, and exactly-once contracts remain unchanged.

## Validation

- Full-candidate/page/batch offline tests: 12/12 PASS.
- Memo CRUD regression: 39/39 PASS.
- Memo Delete regression: 18/18 PASS.
- Memo Create, Modify, Dropbox revision adapter, Natural Reply, and Structured Output suites: PASS.
- Worker regression (retired generic CRUD contract excluded): 65/65 PASS.
- Static workflow validation: 135 nodes, 134 connection sources, 121 baseline nodes unchanged.
- Credential reference parity: OpenAI 1, Dropbox OAuth 29, Header Auth 2.
- Sanitized draft parity: PASS.
- Sanitized Published download parity: PASS.
- No Execute, LINE message, Worker deployment, credential change, or live Dropbox operation was performed.

## Backup

`backups/memo-search-full-candidates-page-readback-20260721-193041`

The backup contains the pre-change Published sanitized export, local source/test snapshots, the pre-change working-tree diff, the sanitized draft, and the post-Publish sanitized export. No credential value or delivery token is stored.
