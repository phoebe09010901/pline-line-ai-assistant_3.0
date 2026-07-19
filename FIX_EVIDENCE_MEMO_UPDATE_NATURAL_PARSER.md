# FIX Evidence - Memo Update Natural Parser

Date: 2026-07-19

Scope: `_03` TEST only.

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project access: prohibited
- Old `_02` resources: not used
- Secrets, raw LINE User ID, and full webhook payload were not recorded.

## Problem

Fresh Memo A3 failed for marker `M4001-20260719071906`.

No-secret TEST summary:

- Request: `pline-v3-01KXVRMHJBE56Y9YH4T126N5NC`
- Task: `memo-8b44d7d70fc4b6b702bfea63`
- Operation: `memo_update`
- Terminal status: `needs_clarification`
- Cause shape: executor treated the full phrase `把 <marker> 的內容改成 <new text>` as the query, so the existing memo marker was not matched.

## Root Cause

- Worker and monitor parsers only handled quoted update forms such as `把「原內容」改成「新內容」`.
- Natural unquoted forms with `的內容改成` or `的備忘錄改成` were not parsed into separate query and new content.
- When n8n provided a broad `query` containing the whole sentence, Worker/monitor could prefer that broad query over a parsed update target.

## Repair

- Added memo update parser support for:
  - `把 <marker> 的內容改成 <new text>`
  - `修改備忘錄：把 <marker> 的內容改成 <new text>`
  - `把 <marker> 的備忘錄改成 <new text>`
- Worker `memo_update` now prefers a successfully parsed query/new content from `body_text` over a broad n8n query.
- Monitor `memo_update` normalization now overwrites broad query text when the body text is parseable.
- Query normalization removes command verbs such as `把` and connector text such as `的內容改成`.
- Ambiguity and not-found behavior remains unchanged.

## Validation

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- Worker `/health`: PASS; required env present
- Invalid LINE signature POST `/line/webhook`: `401`
- Remote pending queues: `crud=0`, `idea=0`, `codex=0`
- Secret/private scan effective hits: `0`

## Deployment

- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Worker version: `d0084e7a-e209-4eb7-86ca-76e15222cec9`
- Monitor launchd runner: reloaded, state `running`, heartbeat `ready`

## TEST Handoff

TEST should rerun fresh Memo A1-A8.

Expected A3 behavior:

- `備忘錄 把 <marker> 的內容改成 <new text>` maps query to `<marker>`.
- `new_content` maps to `<new text>`.
- If exactly one memo matches, update completes and sends one safe natural final.
- If zero/multiple memos match, clarification remains terminal and no update is performed.
