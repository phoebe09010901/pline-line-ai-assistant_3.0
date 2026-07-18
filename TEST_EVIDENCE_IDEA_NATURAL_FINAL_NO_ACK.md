# TEST Evidence: IDEA NATURAL FINAL REPLY WITHOUT ACK Gate

Date: 2026-07-18
Thread: `PLine03｜TEST｜測試與驗收`
Scope: `_03` clean room only
Result: `IDEA NATURAL FINAL REPLY WITHOUT ACK PASS`

## Clean Room

- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Verified cwd: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Fixed Dropbox directory: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- LINE app target window: `菲比智能客服 測試_03`
- Old project, `_02`, old Dropbox data, old logs, old User ID, and old secret store were not read or used.
- No secrets, raw LINE User ID, full webhook payload, or private Dropbox content were recorded.
- Git was not executed in this TEST run.

## Readiness

- Worker health: HTTP 200.
- Worker reply mode: `no_visible_ack_background_n8n`.
- Durable evidence read path present: `/test/evidence`.
- Idea finalizer path present: `/test/idea-finalize`.
- Monitor health: `ready`.
- Monitor supported action: `save_idea_json`.
- `.gitignore` excludes local idea JSON/runtime artifacts.

## Live idea_create Gate

Messages sent with Computer Use to `菲比智能客服 測試_03`:

```text
記一下：[REDACTED_IDEA_CONTENT]
記一下：[REDACTED_IDEA_CONTENT]
記一下：[REDACTED_IDEA_CONTENT]
```

| Marker | Dropbox JSON | ACK | HTTP 200 | Final | Notes |
| --- | --- | --- | --- | --- | --- |
| `T2301-20260718092056` | `idea-20260718-092105-016e468ba6d0.json` | `line_visible_ack_skipped` | `webhook_http_200_returned` | `idea_json_final_push_completed` | clean |
| `T2302-20260718092156` | `idea-20260718-092204-b7107d1c1dc3.json` | `line_visible_ack_skipped` | `webhook_http_200_returned` | `idea_json_final_push_completed` | clean |
| `T2303-20260718092325` | `idea-20260718-092333-3cd6f7b5427f.json` | `line_visible_ack_skipped` | `webhook_http_200_returned` | `idea_json_final_push_completed` | transient `line_push_http_525`, then task-scoped retry completed |

All three runs also had:

- LINE event / Worker invocation: `1 / 1`
- `signature_pass`, `admin_pass`, `idempotency_pass`
- n8n background completed
- Intent/action: `idea_create` / `save_idea_json`
- Monitor claim and Dropbox JSON write
- JSON parse/schema/content/fingerprint checks: PASS
- Codex task: `0`

## User-Visible Reply Observation

- LINE desktop showed no user-visible fixed ACK text `已收到 _03 TEST 訊息，我會繼續處理。`.
- LINE desktop showed one short Traditional Chinese final reply per idea message.
- Observed final text was warm, short, and did not expose `_03`, `TEST`, n8n, Worker, task, JSON, or execution terms.
- LINE desktop did not provide a stable visible read-receipt signal for every message. This is recorded as a UI/OA setting observation only and is not used as webhook HTTP 200, final push, or Dropbox save evidence.

## Duplicate / Repeated Callback Test

- Method: repeated task-scoped finalizer callback for marker `T2303-20260718092325`.
- Result: `already_completed`.
- Repeated callback push result: `pushed=false`.
- Dropbox JSON count: `29 -> 29`.
- New Dropbox JSON files: `0`.
- Repeated formal LINE final count: `0`.
- `idea_json_final_push_completed` remained a single deterministic stage key.
- n8n background completed stage count remained `1`, so the repeated callback did not rerun AI.

## Failure Test

Safe local Worker mock covered monitor/finalizer failure without raw payload or secrets:

- Success message count: `0`.
- User-visible failure notice path: 1.
- The failure path did not pretend the idea had been saved.
- No raw User ID was recorded in evidence.

## AI Fallback Test

Safe local Worker mock covered missing/unsafe AI reply after successful JSON save:

- Fallback text: `已經幫妳記下來了 💡`
- LINE final: 1.
- ACK: 0.
- No internal terms exposed.

## Codex Regression

Live regression marker: `T2390-20260718092857`

- Routed as `codex_task`: 1.
- `codex_task_enqueued`: present.
- `codex_execution_completed`: present.
- `smoke_file_written`: present.
- `line_push_final_completed`: present.
- Dropbox idea JSON write: 0.
- Smoke file content: `Codex 已打通`.
- Idea path did not receive codex-task processing notification evidence.

## Dropbox Regression

- Gate-start Dropbox JSON count: `25`.
- Three live idea messages added three Gate JSON files.
- Local monitor regression tests added expected local selftest JSON files in the fixed Dropbox directory.
- Codex regression did not add Dropbox idea JSON.
- `.gitignore` protects idea JSON/temp/runtime artifacts from repository tracking.

## Raw User ID / Secret Scan

- JSON fields `actor_fingerprint` and `line_event_key` are irreversible 64-hex values.
- Raw LINE User ID count in saved JSON/evidence: `0`.
- Two-stage secret scan:
  - scanned files: `54`
  - placeholder/name-only assignments: `6`
  - effective secret hit_count: `0`
- Placeholder/name-only hits were in `.env.example` and FIX evidence only; values were not output.

## UI / OA Setting Observation

Phoebe observed that LINE desktop did not clearly show the small read-receipt marker and may require LINE Developers or LINE OA Manager settings. This is independent from:

- webhook HTTP 200 evidence
- `line_visible_ack_skipped`
- `idea_json_final_push_completed`
- Dropbox JSON save evidence

This observation is not treated as a hard blocker for this Gate because the Gate criteria are ACK=0, natural final=1, visible message count=1, webhook HTTP 200 retained, no LINE redelivery, and Dropbox JSON saved.

## Decision

```text
IDEA NATURAL FINAL REPLY WITHOUT ACK PASS
```

## Release / Follow-Up Handoff

Primary handoff: `PLine03｜RELEASE｜部署與收尾` for git status, secret scan, commit, and push to `v1/minimal-dual-path`.

Optional follow-up: if Phoebe wants the LINE desktop read-receipt display investigated, hand off to TEST/FIX to inspect `_03` LINE Developers / LINE OA Manager settings with Computer Use. Do not require Phoebe unless login, 2FA, CAPTCHA, QR scan, or person-only consent appears.
