# FIX Evidence: LINE to Codex Gateway Connection

Date: 2026-07-18
Branch: `gate/codex-default-delegation`
Scope: `_03` clean room only.

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- CWD verified: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project access: prohibited
- No secrets, raw LINE User ID, or full webhook payload were written.

## Live Failure Attribution

20:31 local LINE command:

- Request id: `pline-v3-01KXTKBMRG5QGQ3MW64GVNGZM2`
- Worker webhook ingress: received
- Signature/admin/idempotency: passed
- HTTP 200: returned
- n8n started: yes
- Route/task result: `n8n_background_contract_failed`
- Failure reason: `unsupported_intent`
- Task created: no
- Monitor claim: no
- Gateway called: no
- Codex process/thread/turn: no
- Category: n8n contract route gap before Codex task creation

20:43 local LINE command:

- Request id: `pline-v3-01KXTM25ZP6JYFZN6V39PEHNX8`
- Worker webhook ingress: received
- Signature/admin/idempotency: passed
- HTTP 200: returned
- n8n started: yes
- Route/task result: `n8n_background_contract_failed`
- Failure reason: `unsupported_intent`
- Failure notice: `n8n_background_contract_failure_notice_completed`
- Task created: no
- Monitor claim: no
- Gateway called: no
- Codex process/thread/turn: no
- Category: n8n contract route gap before Codex task creation

## Repair

Worker repair:

- If n8n returns `unsupported_intent` but the original LINE text clearly contains Codex delegation wording, Worker now records `codex_delegate_fallback_from_unsupported_intent`.
- Worker then creates the same durable `codex_delegate` task record used by the normal n8n contract path.
- The original LINE text is preserved as `original_user_text`.
- The task id is derived from the LINE event id so the same event does not create duplicate Codex executions.
- Non-Codex unsupported messages still receive the existing natural failure notice and are not delegated.

Deployed Worker:

- Worker: `pline-v3-test-line-gateway`
- URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Version ID: `fc7ed508-ab6d-4ca8-8f97-33086fc3c2eb`

Monitor:

- LaunchAgent `com.pline.v3.test.codex-monitor` reloaded.
- Heartbeat after reload: `ready`
- Pending queues after verification: `codex_task:v1:pending:* = 0`, `idea_json:v1:pending:* = 0`

## Selected Codex Interface

Selected interface: official `codex exec --json`.

Evidence:

- Local CLI version: `codex-cli 0.142.5`
- Direct CLI probe created `runtime/codex-gateway/codex_gateway_probe.txt`
- Observed Codex JSONL events included `thread.started`, `turn.started`, command/file events, and `turn.completed`.

## Gate Verification

Safe create-file task:

- Task id: `gate-delegate-create-file-exact-20260718-2056`
- Result file: `runtime/codex-gateway/gate-delegate-create-file-exact-20260718-2056.json`
- Codex received: yes
- Codex execution: yes
- Thread id present: yes
- Output file: `runtime/codex-default-delegation/codex_delegate_real_file.txt`
- File content byte-exact: `真正 Codex 執行成功`
- No smoke-file substitution: verified by task/result path

Safe read-file task:

- Task id: `gate-delegate-read-file-20260718-2058`
- Result file: `runtime/codex-gateway/gate-delegate-read-file-20260718-2058.json`
- Codex received: yes
- Codex execution: yes
- Thread id present: yes
- Codex summary included the real file content: `真正 Codex 執行成功`
- Changed files: none

Computer Use Calculator task:

- Task id: `gate-delegate-computer-use-calculator-20260718-2100`
- Result file: `runtime/codex-gateway/gate-delegate-computer-use-calculator-20260718-2100.json`
- Codex received: yes
- Codex execution: yes
- Thread id present: yes
- Shell `open`, `osascript`, and AppleScript were explicitly forbidden in the prompt.
- Result: blocked by host approval, reported as `Computer Use was not approved to use Calculator`.
- Required external action: approve Calculator use for Codex Computer Use if this capability should pass live.

## Regression

- `node --check worker/src/index.js`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node --check monitor/src/codex_gateway.js`: PASS
- `npm --prefix worker test`: PASS
- `npm --prefix monitor test`: PASS
- Worker `/health`: reachable
- Invalid LINE signature route: HTTP `401`
- Pending queues: empty

## Result

Gate result: `PARTIAL_BLOCKED_ON_COMPUTER_USE_APPROVAL`

The LINE to Codex Gateway path is implemented for `codex_delegate` and deployed. The two recent live failures stopped before task creation because n8n returned `unsupported_intent`; Worker now bridges that exact Codex-text gap into durable `codex_delegate` task creation. Ordinary Codex file/read work is proven through real `codex exec --json` threads and turns. Computer Use for Calculator reached Codex but is blocked by host approval.
