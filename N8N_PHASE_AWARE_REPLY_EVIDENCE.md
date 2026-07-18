# N8N Phase-Aware Codex Reply Evidence

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- n8n workflow id: `kcMcBQos5cxsnWU1`
- n8n workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Version name published in n8n: `N8N phase-aware codex reply contract`
- Secret values, raw User IDs, and full webhook payloads: not recorded
- Git commit or push: not performed

## Original Path Trace

- `codex_task` already had a `reply_text` field through `AI Agent` and `Structured Output`.
- The previous `codex_task` response was single-stage task creation output.
- The previous workflow did not expose a phase-aware contract for `processing`, `completed`, and `failed`.
- The previous workflow did not guarantee `reply_source: ai_generated`.

## Implemented Contract

For `intent: codex_task` and a phase value, `Normalize Input` now passes these public/sanitized fields to `AI Agent`:

```json
{
  "intent": "codex_task",
  "phase": "processing | completed | failed",
  "original_user_text": "sanitized LINE user instruction",
  "task_summary": "short public task summary",
  "project_name": "public project name",
  "actual_result": "public result text, empty if not done",
  "actual_status": "queued | processing | completed | failed"
}
```

`AI Agent` is instructed to return only:

```json
{
  "reply_text": "自然繁中，最多兩句",
  "reply_source": "ai_generated",
  "intent": "codex_task",
  "phase": "processing | completed | failed",
  "status": "accepted | completed | failed"
}
```

`Structured Output` normalizes that result. If the AI result is missing or contains blocked internal terms, it returns `reply_source: fallback_required` with empty `reply_text`, leaving fallback to Worker.

## Synthetic Validation

Validation rule:

- `reply_source` must be `ai_generated`.
- `reply_text` must be Traditional Chinese and at most two sentences.
- `processing` must not claim completion.
- `completed` must reflect actual completion.
- `failed` must not claim success.
- `reply_text` must not contain blocked internal words, local paths, IDs, service names, secrets, tokens, or technical pipeline terms.

Synthetic results:

| Case | Phase | Status | Reply source | Reply text | Result |
| --- | --- | --- | --- | --- | --- |
| 建立檔案 | processing | processing | ai_generated | 收到，我正在建立確認連線用的檔案，有結果會再告訴妳。 | PASS |
| 建立檔案 | completed | completed | ai_generated | 完成了，確認連線的檔案已建立，內容也正確。 | PASS |
| 讀取檔案 | processing | processing | ai_generated | 我正在讀取妳指定的檔案內容，會用簡短結果回覆妳。 | PASS |
| 讀取檔案 | completed | completed | ai_generated | 讀取完成，檔案內容確認為「Codex 已打通」。 | PASS |
| 執行最小測試 | processing | processing | ai_generated | 我正在執行最小連線測試，先確認流程能不能順利跑完。 | PASS |
| 執行最小測試 | completed | completed | ai_generated | 最小連線測試已通過，這次流程可以正常完成。 | PASS |
| 可控失敗 | failed | failed | ai_generated | 這次可控失敗已被攔下，指定動作沒有完成。 | PASS |

Synthetic validation result: `PASS`

This is not a live Gate PASS. It only proves the no-secret phase-aware reply contract shape and synthetic wording checks.

## Live Regression Intake

Source: 菲比 LINE desktop screenshot / live field report, received after the synthetic contract validation.

Current N8N status must be treated as `needs live TEST/FIX verification`, not PASS.

Observed cases:

1. User input:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Observed result:

- LINE screen showed no reply.
- This is an `idea_create` live regression risk.
- Do not ignore this because the N8N synthetic phase-aware contract passed.

2. User input:

```text
請 Codex 幫我用computer use開啟一個新的網頁
```

Observed result:

- LINE replied only: `收到～這件事需要一點時間，我處理完成後再告訴妳 🛠️`
- The computer did not act.
- No completed or failed final reply was observed.
- Current project safety scope only allows the fixed minimal smoke task for `codex_task`; arbitrary Computer Use / opening a webpage is out of scope.
- Out-of-scope `codex_task` should be naturally rejected or fail with a final user-facing message, not stay indefinitely processing.

3. LINE read-state observation:

- 菲比 still did not see "已讀".
- Track this separately as a LINE desktop / LINE Developers / OA Manager observation.
- Do not merge it with webhook HTTP `200`, LINE event receipt, or final push evidence.

## Live Regression Required Follow-Up

Hand off to TEST or FIX before any PASS claim:

- Recheck marker/text `1153`: idea_create marker/evidence, n8n execution, Worker evidence, and finalizer path.
- Recheck `computer use開啟網頁`: whether it was incorrectly accepted as executable `codex_task`, whether a pending task exists, and whether it lacks completed/failed final state.
- Recheck LINE read-state separately in LINE desktop / LINE Developers / OA Manager settings.

## Worker Handoff

Worker/FIX should pass the same production n8n webhook with phase mode fields when it wants AI-generated processing or final copy:

- `intent`
- `phase`
- `original_user_text`
- `task_summary`
- `project_name`
- `actual_result`
- `actual_status`

Worker/FIX should read:

- `reply_text`
- `reply_source`
- `phase`
- `actual_status`

Worker/FIX should use the AI text only when:

- `reply_source === "ai_generated"`
- `reply_text` is present
- the current phase matches the expected phase

Otherwise Worker/FIX should use its own safe fallback.
