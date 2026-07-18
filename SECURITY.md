# SECURITY

## Security Boundary

This project is TEST-only until a later explicit release gate.

Do not publish, activate, or connect production services from this DOC baseline.

## Secret Handling

Secrets must not be committed.

Allowed sources for future secret setup:

- current LINE Developers page
- authorized secure secret store
- explicit account-owner authorization flow

Never place real values in `.env.example`.

## Environment Isolation

All future resources must be dedicated to `_03`:

- Worker: `pline-v3-test-line-gateway`
- KV runtime namespace: `pline-v3-test-runtime`
- KV idempotency namespace: `pline-v3-test-idempotency`
- Optional D1 database: `pline-v3-test-db`
- n8n workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- local monitor: `pline-v3-test-codex-monitor`

## Local Monitor Guardrails

The monitor must not execute arbitrary shell commands, arbitrary file writes, arbitrary paths, or user-supplied code.

Allowed fixed actions:

```text
create_smoke_file
save_idea_json
```

The only target for `create_smoke_file` is:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt
```

The only content is:

```text
Codex 已打通
```

The only target directory for `save_idea_json` is:

```text
/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03
```

`save_idea_json` accepts only validated schema fields, generates the file name internally, rejects user-provided directories, writes a same-directory temp file, reparses it, then renames it to the final JSON file. It must not store raw LINE User ID, channel secrets, access tokens, shared secrets, signatures, or full webhook payloads.

## idea_create Final Reply Guard

The formal idea success LINE final is sent by Worker only after monitor completion callback.

- Monitor calls only the fixed Worker endpoint `/test/idea-finalize`.
- The callback uses a task-scoped `finalize_token`; no global secret value is written to the repo.
- Worker stores LINE push target only as encrypted `line_user_ref`, not raw LINE User ID.
- Worker writes durable final state under `idea_json:v1:final:<task_id>` before/after push to prevent repeated final replies.
- Duplicate and failed tasks must not send the success text.

TEST evidence confirmed JSON schema and irreversible fingerprint behavior for `_03` Dropbox files. `DROPBOX IDEA JSON PATH PASS` remains unmarked until the formal LINE final success reply is proven after save/duplicate.

Latest TEST rerun after Worker version `3ba57849-b02c-4b6e-a066-8da95575563c` confirmed three additional `_03` Dropbox JSON files use exactly the allowed 9-field schema and irreversible fingerprint fields. Duplicate reprocess added no file. No raw LINE User ID, secret, signature, or full webhook payload was recorded. Formal LINE final success evidence is still missing, so the path remains `DROPBOX IDEA JSON PATH PARTIAL`. Evidence: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

Latest accepted TEST rerun after Worker version `cbadc5a1-4e07-44b2-853d-335c5486b11b` confirmed three additional `_03` Dropbox JSON files use exactly the allowed 9-field schema and irreversible fingerprint fields. Durable `idea_json_final_push_completed` evidence existed for each run. Repeated finalizer callback returned `already_completed`, `pushed=false`, and added no file or second final push. No raw LINE User ID, secret, signature, finalize token, line user reference, or full webhook payload was recorded. The path is marked `DROPBOX IDEA JSON PATH PASS`. Evidence: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

## idea_create Natural Final Reply Guard

The normal `idea_create` path must not send a user-visible processing ACK before Dropbox JSON save completes.

- Worker still returns HTTP `200` to LINE webhook delivery.
- Durable evidence records `line_visible_ack_skipped` and `webhook_http_200_returned`.
- Success final is allowed only after monitor callback proves `save_idea_json` completed.
- n8n natural `reply_text` may be used only after Worker sanitizes it for length and internal implementation words.
- If the n8n final text is missing or unsafe, fallback `已經幫妳記下來了 💡` is allowed only after save success.
- If save fails, Worker must not send success text and must use a truthful failure final.
- Duplicate/repeated finalizer callbacks must not send another final.
- Secret values, raw LINE User ID, encrypted line user reference, finalize token, signatures, and full webhook payload must never be written to repo, durable evidence, or final reports.

## Codex Task Minimal Closed Loop Guard

The `codex_task` path remains restricted to a single fixed action:

```text
create_smoke_file
```

Allowed output path:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt
```

Allowed output content:

```text
Codex 任務測試成功
```

Security requirements:

- No arbitrary shell command, arbitrary path, arbitrary filename, deletion, or project source modification is allowed.
- Worker stores live LINE push target only as encrypted `line_user_ref`; raw LINE User ID is not stored.
- Worker stores task-scoped `finalize_token`; token values must not be written to repo, durable evidence, or final reports.
- Monitor writes a result record only after file write/readback succeeds.
- Monitor must preserve the original task `created_at` when rewriting queued, claimed, completed, and failed records.
- Codex result records must include `created_at` for traceability without storing raw LINE User ID or secrets.
- Worker sends completed final only after monitor callback and task status `completed`.
- Failed execution must not send completed final.
- Repeated callback must not send another final.

## CODEX_BIN Requirement

Future monitor implementation must:

1. Check `CODEX_BIN`.
2. If unset, resolve the executable from the current environment.
3. Verify that the executable exists and is runnable at startup.
4. Report the resolved value in health output.
5. Fail health before task execution if the executable is missing.

## Out-of-Scope Features

Do not add Google Calendar, accounting, email, attachments, multiple agents, FORMAL mode, real-time wake, WebSocket, complex queueing, complex state machines, compatibility layers, or broad regex/if/else routing in the first version.

## TEST Result: Natural Final Without Visible ACK

Live `_03` evidence confirmed normal `idea_create` skips visible fixed ACK, retains webhook HTTP 200, saves Dropbox JSON, and sends one natural final after save. Failure and AI fallback behavior passed safe local mocks. Repeated finalizer callback produced no duplicate final. Two-stage secret scan effective hit_count was `0`. LINE desktop read-receipt display remains a separate UI/OA setting observation. Result: `IDEA NATURAL FINAL REPLY WITHOUT ACK PASS`. Evidence: `TEST_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.

## TEST Result: Codex Task Minimal Closed Loop

Live `_03` Codex Task Gate kept execution inside `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke`, wrote only the fixed smoke file content, and did not expose secrets, raw User ID, task ids, stack traces, or local paths in LINE-visible content. Effective secret scan hit_count was `0`. Gate failed because completed task records must retain `created_at`. Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

After Worker version `ca9001fa-cf03-43f7-9911-33f6301dd668`, TEST rerun confirmed the same safe execution boundary and LINE-visible content guard while completed task/result records retained `created_at`. Effective secret scan hit_count remained `0`. Gate result: PASS. Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.
