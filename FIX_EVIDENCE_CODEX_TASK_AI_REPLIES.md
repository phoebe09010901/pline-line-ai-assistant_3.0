# FIX Evidence: Codex Task AI Replies Phase-1 Trace

Date: 2026-07-18T12:04:02+0800

## Scope

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Runtime safe directory only: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke`
- Old project access: prohibited
- Git commit/push: not executed
- Secret/raw User ID/full webhook payload recorded: none

## Local State

- Branch: `v1/minimal-dual-path`
- Local HEAD: `400b7ccd766c67e2fb782f870998582b7bc90a2f`
- `git status --short --branch`: clean at start of trace

## Required Trace Findings

1. codex_task processing reply source:
   - Source: Worker constant `CODEX_PROCESSING_REPLY_TEXT` in `worker/src/index.js`.
   - Send path: `processN8nInBackground()` calls `pushToLine(normalized.user_id, CODEX_PROCESSING_REPLY_TEXT, env)`.
   - Evidence stage: `codex_task_processing_notice_completed`.

2. codex_task completed reply source:
   - Source: Worker constant `CODEX_COMPLETED_REPLY_TEXT` in `worker/src/index.js`.
   - Send path: `pushCodexFinalOnce()` calls `pushToLine(userId.value, CODEX_COMPLETED_REPLY_TEXT, env)`.
   - Evidence stage: `codex_task_final_push_completed`.

3. AI Agent receives codex_task:
   - Local workflow `N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json` contains an `AI Agent` node connected to the `codex_task` tool.
   - The AI Agent system message requires JSON output with `request_id`, `intent`, `reply_text`, `task_id`, and `status`.

4. AI Agent reply_text generation:
   - Workflow `Structured Output` parses `agent.output`.
   - If `parsed.reply_text` exists, it is carried as `reply_text`.
   - If missing, `Structured Output` fallback for codex_task is fixed text `Codex 任務已建立。`.

5. reply_text overwritten/ignored:
   - Worker validates n8n `reply_text` through `validateN8nContract()`.
   - For codex_task processing, Worker ignores `contractResult.body.reply_text` and sends `CODEX_PROCESSING_REPLY_TEXT`.
   - For codex_task completed/failed, Worker has no AI-generated reply_text in the monitor callback path and uses Worker constants.

6. Fallback frequency:
   - Current durable evidence does not record `reply_source=ai_generated/fallback`.
   - Live task record check for task `pline-v3-codex-1784346318391` showed no `processing_reply_text`, no `final_reply_text`, and no `reply_source` / `ai_reply_source` fields.
   - Therefore fallback vs AI-generated cannot be audited from current evidence.

7. Whether only idea_create uses AI Agent:
   - codex_task does use the AI Agent for classification/tool selection in n8n.
   - codex_task LINE-visible processing/final text does not use AI Agent output in Worker.
   - idea_create final path already stores `final_reply_text` from n8n `reply_text` and applies Worker natural fallback guard.

8. LINE final text field source:
   - Processing LINE text comes from Worker `CODEX_PROCESSING_REPLY_TEXT`.
   - Completed LINE text comes from Worker `CODEX_COMPLETED_REPLY_TEXT`.
   - Failed LINE text comes from Worker `CODEX_FAILED_REPLY_TEXT`.

9. Fixed processing sentence location:
   - `worker/src/index.js`: `CODEX_PROCESSING_REPLY_TEXT = "收到～這件事需要一點時間，我處理完成後再告訴妳 🛠️"`.

10. Fixed completed sentence location:
   - `worker/src/index.js`: `CODEX_COMPLETED_REPLY_TEXT = "已經處理完成了 ✨\n指定的小任務已成功執行。"`.

## Live Evidence Reference

`TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md` observed LINE-visible messages:

- Processing: `收到～這件事需要一點時間，我處理完成後再告訴妳 🛠️`
- Completed: `已經處理完成了 ✨` plus `指定的小任務已成功執行。`

These match Worker constants, not n8n AI output.

## Decision

Worker/monitor alone cannot honestly satisfy "truly AI-generated codex_task processing and final replies" without a phase-aware n8n AI reply contract.

Reason:

- Existing n8n workflow only receives the initial LINE webhook context and performs intent/tool classification.
- Existing n8n workflow does not accept `phase=processing|completed|failed` with actual monitor result data.
- Existing Worker finalizer currently has actual completion/failure state, but no AI Agent endpoint/contract to convert that state into natural `reply_text`.
- Implementing local template/rule text in Worker would violate the Gate requirement because it would not be genuinely AI Agent generated.

## N8N Handoff Requirement

N8N thread should modify only workflow `kcMcBQos5cxsnWU1` / `PLine｜菲比智能客服｜V3 最小 AI Agent` to support a phase-aware AI reply contract for codex_task.

Minimum desired input:

```json
{
  "intent": "codex_task",
  "phase": "processing | completed | failed",
  "original_user_text": "<sanitized LINE user instruction>",
  "task_summary": "<short task summary>",
  "project_name": "<public project name>",
  "actual_result": "<actual result or empty>",
  "actual_status": "queued | processing | completed | failed"
}
```

Minimum desired output:

```json
{
  "intent": "codex_task",
  "phase": "processing | completed | failed",
  "reply_text": "<short Traditional Chinese natural reply>",
  "reply_source": "ai_generated | fallback",
  "status": "completed"
}
```

Rules:

- Do not expose task id, local absolute path, branch, commit hash, n8n, Worker, JSON, execution, stack trace, node names, secrets, or tokens in `reply_text`.
- processing must not claim completion.
- completed must reflect actual result.
- failed must not pretend success.
- Fallback must be explicit as `reply_source=fallback`.

After N8N provides this contract, FIX can wire Worker processing reply and monitor finalizer reply to the AI reply path with durable evidence fields.

## Verification Performed

- `node --check worker/src/index.js && node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js && node monitor/test/monitor.test.mjs`: PASS
- `npx wrangler deploy --dry-run`: PASS
- Worker `/health`: reachable
- invalid-signature `POST /line/webhook`: HTTP `401`

## Status

This phase is blocked on N8N workflow support for phase-aware codex_task AI replies. No Worker/monitor behavior was changed in this phase.
