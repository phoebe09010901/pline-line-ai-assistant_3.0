# N8N Evidence: idea_create Natural AI Reply

Date: 2026-07-18

Scope:

- Project: `菲比 LINE 智能助理_03`
- Workflow: `kcMcBQos5cxsnWU1`
- Workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Production path: `/webhook/pline-v3-test-ai-agent`
- No old project, old workflow, raw LINE User ID, secret value, or full webhook payload was used or recorded.

## Root Cause

The fixed LINE final text `已記下這個想法。` came from the n8n `Structured Output` fallback branch.

Observed causes:

- `Normalize Input` did not originally provide `idea_content`.
- `AI Agent` prompt did not require an `idea_create` natural `reply_text`.
- `idea_create` tool only returned `tool_called`, `saved`, `saved_record`, and `idea_text`; it did not return `reply_text` or `reply_source`.
- `OpenAI Chat Model` was not producing output because its model parameter was saved as an old string shape, causing `Could not get parameter "model.value"`.
- Because the AI output was absent or not parseable, `Structured Output` set `reply_source=fallback_required` and used the fixed fallback.

## Fix

Published n8n version:

- `N8N idea_create saved natural reply guard`

Changed nodes:

- `Normalize Input`: provides `idea_content`, `phase=completed`, `saved_status=saved`, and preserves canonical request id.
- `AI Agent`: now requires `idea_create` to call the tool and return a Traditional Chinese natural saved reply with `reply_source=ai_generated`.
- `idea_create`: now asks AI for `reply_text` and returns `reply_source=ai_generated` with saved contract fields.
- `OpenAI Chat Model`: model parameter set through n8n resource-locator mode so `model.value` exists.
- `Structured Output`: preserves AI `reply_text` when `reply_source=ai_generated`; fallback is only used when AI text is missing or unsafe. Added a saved-reply contradiction guard.

Unchanged:

- Dropbox idea schema.
- Request id preservation contract.
- Shared-secret header guard.
- `codex_task` route.
- Worker code and monitor runner.

## AI Agent Input Fields

For `idea_create`, the AI Agent receives at least:

- `intent=idea_create`
- `original_user_text`
- `idea_content`
- `phase=completed`
- `saved_status=saved`
- `task_summary`
- `project_name`
- `actual_status=completed`

## Synthetic Production Validation

Production synthetic probe used public sample text and a redacted non-secret header value. It did not include raw LINE User ID, reply token, secret value, or a full LINE payload.

| Case | idea_content | reply_source | reply_text |
| --- | --- | --- | --- |
| A | 我今天要喝1555cc的水 | ai_generated | 妳的喝水目標1555cc已經幫妳記錄下來囉！ |
| B | 把課程介紹做成短影片 | ai_generated | 妳的想法「把課程介紹做成短影片」已經幫妳保存好了，隨時可以再來查看。 |
| C | 網站首頁增加作品輪播 | ai_generated | 妳的想法「網站首頁增加作品輪播」已經幫妳保存好了。 |
| D | 下週整理報價單流程 | ai_generated | 妳的想法「下週整理報價單流程」已經幫妳保存好了。 |

Contract result:

- HTTP 200: PASS
- request id preserved: PASS
- `intent=idea_create`: PASS
- `tool_called=idea_create`: PASS
- `saved_record=1`: PASS
- `saved_status=saved`: PASS
- `reply_source=ai_generated`: PASS
- four reply texts not identical: PASS
- reply text content-aware: PASS
- no internal words in reply text: PASS
- no saved/failure contradiction: PASS

## Handoff

This is n8n production synthetic PASS only. TEST should send fresh live LINE markers such as `T3101` and `T3102` and verify the visible final reply is no longer repeatedly `已記下這個想法。`, while preserving Dropbox JSON creation and final delivery.
