# FIX Evidence: Memo Create Normalization and Memo Update Mapping

Date: 2026-07-19

Scope:

- Project: `菲比 LINE 智能助理_03`
- Root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Monitor: `pline-v3-test-codex-monitor`
- Dropbox boundary: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- Old projects, `_02`, old Dropbox data, old workflows, secrets, raw LINE User ID, and full webhook payloads were not used.

## TEST Failure Input

After the previous memo search repair:

- A2 fresh `memo_search`: PASS.
- A3 `memo_update`: FAILED.
- A3 task reached n8n, monitor, and finalizer, but terminal state was `needs_clarification`.
- Evidence showed `query_preview=""` and `new_content_preview=""`.
- The searched memo content included unintended command syntax prefix `新增：`, so the intended original memo text did not match cleanly.

## Root Cause

- `memo_create` stored command syntax such as `新增：` as part of the memo content.
- Worker CRUD sanitization did not parse update instructions such as `把「原內容」改成「新內容」` into `query` and `new_content` when n8n omitted those explicit fields.
- Monitor runtime had the same missing fallback parse, so a live task could still reach `needs_clarification` even after enqueue.

## Repair

- Worker `memo_create` sanitization now strips command prefixes when they are used as syntax:
  - `新增：`
  - `新增:`
  - `新增 `
  - `建立：`
  - `建立:`
  - `建立 `
  - `新增備忘錄...`
  - `建立備忘錄...`
- Monitor `memo_create` applies the same normalization before writing memo JSON.
- Worker and monitor both parse quoted update text:
  - `把「原內容」改成「新內容」`
  - `將「原內容」改為「新內容」`
- Monitor `memo_update` uses parsed `query` / `new_content` before searching and writing.
- Memo search still accepts normalized body text when query is absent.

## Validation

- Worker syntax and unit tests: PASS
- Monitor syntax and unit tests: PASS
- Focused Worker coverage:
  - `memo_create` enqueued content no longer contains `新增：`.
  - `memo_update` enqueued body contains parsed `query` and `new_content`.
- Focused monitor coverage:
  - prefixed create writes clean memo content.
  - A2-style search still finds created memo from `body_text`.
  - quoted update succeeds and overwrites the unique memo.
  - no-match update reaches terminal `needs_clarification`.
  - pending cleanup happens after completed / clarification states.
- Regression scope:
  - Worker existing tests passed.
  - Monitor existing idea_create, Dropbox, Codex, CRUD, and runner tests passed.
- Worker `/health`: PASS.
- Invalid signature `/line/webhook`: HTTP `401`.
- Remote `crud_task:v1:pending:*`: empty.
- Monitor launchd runner: `running`; heartbeat `ready`.

## Deploy / Reload

- Worker deployed version: `b462fca6-fdeb-4942-9036-5af392a15387`.
- Monitor launchd runner reloaded; current pid observed: `20236`.

## TEST Handoff

TEST should start from a fresh Memo A1 create so the stored memo content is normalized from the beginning, then rerun Memo A2 search and A3 update.
