# TEST Evidence: Codex Gateway Live Validation

Date: 2026-07-18
Local time: 21:00-21:10 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- LINE target: `菲比智能客服 測試_03`
- Old project / `_02` access by TEST: not used
- Git: not run
- Deploy: not run
- Secrets / raw LINE User ID / full webhook payload: not output and not written

## Precheck

cwd:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03
```

Worker health:

- Required env flags: true
- Runtime KV bound: true
- Idempotency KV bound: true
- Reply mode: `no_visible_ack_background_n8n`
- Mark-as-read mode: `disabled_chat_off_auto_read`

Historical failure check:

- 20:31 request `pline-v3-01KXTKBMRG5QGQ3MW64GVNGZM2`: stopped at `n8n_background_contract_failed`, reason `unsupported_intent`; no task, no monitor claim, no Gateway, no Codex thread/turn.
- 20:43 request `pline-v3-01KXTM25ZP6JYFZN6V39PEHNX8`: stopped at `n8n_background_contract_failed`, reason `unsupported_intent`; failure notice completed; no task, no monitor claim, no Gateway, no Codex thread/turn.

## Live B: Codex Create File

LINE text:

```text
請 Codex 在指定測試資料夾建立一個文字檔，內容寫：真正 Codex 執行成功 T3201-20260718210047
```

Request id:

```text
pline-v3-01KXTN3G649JKB3FK03WWQHP8S
```

Task id:

```text
codex-delegate-01KXTN3G649JKB3FK03WWQHP8S
```

Durable evidence:

- `line_event_received`
- `signature_pass`
- `admin_pass`
- `idempotency_pass`
- `webhook_http_200_returned`
- `line_mark_as_read_skipped_disabled`
- `n8n_background_started`
- `n8n_background_contract_failed`, reason `unsupported_intent`
- `codex_delegate_fallback_from_unsupported_intent`
- `n8n_background_completed`, `intent=codex_delegate`
- `codex_task_enqueued`
- `monitor_claimed`
- `codex_task_processing_notice_completed`
- `codex_execution_completed`
- `codex_task_result_received`
- `codex_task_result_recorded`
- `codex_task_final_callback_completed`
- `codex_task_final_push_completed`

Codex proof:

- Codex received original text: yes
- Codex execution: yes
- Codex thread id present: yes
- Result file: `runtime/codex-gateway/codex-delegate-01KXTN3G649JKB3FK03WWQHP8S.json`
- Output file: `runtime/codex-gateway/codex-delegate-01KXTN3G649JKB3FK03WWQHP8S.txt`
- File content readback: `真正 Codex 執行成功 T3201-20260718210047`
- Content hash: `0ffed8d769164757f22f5b5e0bb802a4caf833ed9df6e45b0ab109d2a44053f7`

LINE visible result:

- Processing notice appeared before completion.
- Final appeared after completion.
- Final exposed internal path and engineering/safety terms.
- Final therefore violates the user-visible content requirement.

Live B result:

```text
FAILED_USER_VISIBLE_FINAL_CONTAINS_INTERNAL_TERMS
```

## Live C: Codex Read File

LINE text:

```text
請 Codex 讀取剛才建立的檔案，並告訴我內容。
```

Request id:

```text
pline-v3-01KXTN9VJK40S6P4999FB3YK2Z
```

Task id:

```text
codex-delegate-01KXTN9VJK40S6P4999FB3YK2Z
```

Codex proof:

- Codex received original text: yes
- Codex execution: yes
- Codex thread id present: yes
- Result file: `runtime/codex-gateway/codex-delegate-01KXTN9VJK40S6P4999FB3YK2Z.json`
- Codex result summary included the real content from the T3201 file.
- Changed files: none

Durable evidence:

- Worker/signature/admin/idempotency/webhook stages present.
- `codex_execution_completed` present.
- `codex_task_result_recorded` present.
- `codex_task_final_callback_failed` present with reason `codex_task_not_completed`.
- `codex_task_final_push_completed` absent.

LINE visible result:

- Processing notice appeared.
- Completion final did not appear by the end of the TEST observation window.

Live C result:

```text
FAILED_FINALIZER_NO_COMPLETION_PUSH
```

## Live D: Computer Use Calculator

Not executed.

Reason:

- Live D is allowed only after Live B and Live C both PASS.
- Live B failed user-visible final hygiene.
- Live C failed final push.

## Regression / Safety

Invalid signature:

- Synthetic invalid-signature `POST /line/webhook`: HTTP `401`

Local focused tests:

- `node worker/test/worker.test.mjs`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- Local duplicate/idempotency paths are covered by focused tests.
- Live same-event replay was not performed because raw LINE payload/full event replay is prohibited in this TEST scope.

idea_create / Dropbox regression:

- LINE marker: `T3203-20260718210047`
- Request id: `pline-v3-01KXTNFDEFH9ZQHVYYSHMFSJ5A`
- Stages present: Worker received, signature/admin/idempotency, HTTP 200, n8n completed, `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, monitor claim, Dropbox JSON write, final push/callback completed.
- Dropbox JSON: `idea-20260718-210841-42d09d1b3b23.json`
- JSON parse/schema: PASS
- Raw UID shape: not found

Pending queues:

- `idea_json:v1:pending:*`: `0`
- `codex_task:v1:pending:*`: `0`

## Conclusion

```text
CODEX GATEWAY LIVE FAILED
```

The live LINE to Codex execution channel is partially functional: Worker routes explicit Codex text into `codex_delegate`, monitor claims it, Gateway calls official `codex exec --json`, Codex creates and reads files, and result records are written. The Gate cannot pass because user-visible LINE completion hygiene fails for the create-file task, and the read-file task does not emit a completion final.

Recommended handoff:

```text
FIX: sanitize Codex delegate LINE final text so it never exposes path/internal terms, and repair `codex_task_final_callback_failed reason=codex_task_not_completed` after successful Codex result recording. Re-run live B/C before attempting Computer Use Calculator.
```
