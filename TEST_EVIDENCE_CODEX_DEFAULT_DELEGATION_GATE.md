# Codex Default Delegation Gate Evidence

Date: 2026-07-18
Branch: `gate/codex-default-delegation`
Scope: `_03` clean room only.

## Interface Selection

Selected interface: `codex exec --json`.

Rationale:

- Official Codex non-interactive documentation supports JSONL automation events for `codex exec --json`, including thread, turn, item, tool, and error events.
- Official Codex App Server documentation describes a richer JSON-RPC app-server protocol for custom clients, approvals, and streamed events. It is available locally but marked experimental in the installed CLI help, so this Gate uses the stable non-interactive CLI adapter for the launchd monitor first pass.
- Official Codex SDK documentation describes a Python SDK controlling the local app-server over JSON-RPC. It remains a future richer adapter candidate, not the selected first-pass launchd adapter.
- Official Codex MCP Server documentation confirms a Codex MCP server can expose `codex` and `codex-reply` tools to MCP clients. It is available locally but not required for the monitor's direct delegation path.

Local version:

- `codex-cli 0.142.5`
- `codex exec --json`: available
- `codex app-server`: available, experimental local command
- `codex mcp-server`: available

Official docs consulted:

- https://developers.openai.com/codex/non-interactive-mode
- https://developers.openai.com/codex/app-server
- https://developers.openai.com/codex/codex-sdk
- https://developers.openai.com/codex/mcp-server

## Implemented

- Added `monitor/src/codex_gateway.js`.
- Added `CodexGateway` with `submit_task`, `get_status`, `stream_events`, `approve`, `cancel`, `get_result`, and `list_capabilities`.
- Added `CodexExecHostAdapter` using `codex --ask-for-approval never -c model_reasoning_effort="low" exec --json`.
- The adapter uses `spawn` and closes stdin explicitly, avoiding `execFile` hanging on "Reading additional input from stdin".
- Worker now enqueues `codex_delegate` tasks and preserves `original_user_text`.
- Legacy n8n `codex_task` is normalized as an alias, but new queued task action is `codex_delegate`.
- Top-level Worker contract is now limited to `idea_create`, `google_calendar_direct`, and `codex_delegate`.
- Local n8n workflow artifact is aligned to the same route set and no longer emits the fixed smoke `create_smoke_file` action for delegated work.
- `google_calendar_direct` returns a truthful not-enabled final in this Gate and is not delegated to Codex.
- Codex processing LINE notice is deferred until monitor/Gateway observes `turn.started`; enqueue alone records `codex_task_waiting_for_monitor`.
- Worker no longer blocks Browser/Computer Use style natural language as `capability_not_yet_enabled`; capability availability is reported in the manifest instead.
- Added approval bridge:
  - monitor detects high-risk text and stores task as `awaiting_approval`;
  - monitor writes an approval lookup key;
  - Worker finalizer sends a natural LINE confirmation message with a code;
  - a LINE reply `確認 OK-XXXXXX` marks the same task `approved` and requeues it.

## Live Evidence

Direct CLI smoke:

- Command type: `codex exec --json`
- Observed events: `thread.started`, `turn.started`, `command_execution`, `turn.completed`
- Runtime file: `runtime/codex-gateway-live/manual-codex-cli-pass.txt`
- Readback: `Codex Gateway live PASS`

Gateway live task:

- Interface: `CodexGateway` -> `CodexExecHostAdapter` -> `codex exec --json`
- Result: PASS
- `codex_received`: true
- `codex_execution`: true
- `thread_id_present`: true
- `turn.started`: true
- `turn_id_present`: false in observed `codex-cli 0.142.5` JSONL because the event does not expose a separate turn id.
- `tool_event_count`: 8
- Result file: `runtime/codex-gateway/live-delegate-1784369581077.json`
- Runtime output file: `runtime/codex-gateway-live/live-delegate-1784369581077.txt`
- Runtime output readback: `Codex Gateway live PASS`

Post-fix live probe:

- Interface: `monitor.runTask` -> `CodexGateway` -> `CodexExecHostAdapter`
- Prompt: no file modification; exact reply probe
- Result: PASS
- `thread_id_present`: true
- `turn.started` callback count: 1
- `codex_received`: true
- `codex_execution`: true
- Result file: `runtime/codex-gateway/gateway-runtask-probe-20260718.json`
- Changed files: `[]`

Live n8n update:

- Workflow: `kcMcBQos5cxsnWU1`
- UI state after publish: `Published`
- Codex tool node visible name: `codex_delegate`
- Legacy visible tool node: `codex_task` absent
- Duplicate imported nodes: absent
- AI Agent prompt now limits normal routes to `idea_create`, `google_calendar_direct`, and `codex_delegate`.
- `google_calendar_direct` remains a truthful not-enabled direct response and does not enqueue Codex.

Worker deploy after Gateway/n8n alignment:

- Worker: `pline-v3-test-line-gateway`
- URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Version ID: `f9160c1d-87f1-491f-8bca-cde47fc5f058`
- `/health` supported intents: `idea_create`, `google_calendar_direct`, `codex_delegate`
- `/health` selected interface: `codex_exec_json`
- `/health` line read mode: `disabled_chat_off_auto_read`

Delegated Codex execution probes after live n8n publish:

- `codex-delegate-real-smoke-20260718-2030`: Codex received the task, observed `turn.started`, carried thread id into the processing callback, created `runtime/codex-gateway/codex_delegate_real_smoke_20260718_2030.txt`, and readback was exactly `CODEX_DELEGATE_REAL_SMOKE_OK`. The requested full monitor test returned `CHECK` inside the Codex sandbox because that test path touches the fixed Dropbox directory outside the delegated workspace sandbox.
- `codex-delegate-real-smoke-20260718-2035`: Codex received the task, observed `turn.started`, ran `node --check monitor/src/codex_gateway.js` with `PASS`, and ran `git status --short`. Its created file included a trailing newline, so it was not used as byte-exact file evidence.
- `codex-delegate-real-smoke-20260718-2040`: Codex emitted `turn.started` with thread id but did not complete before the adapter result; no file was created. This remains recorded as a timeout/incomplete probe, not a pass.
- Prompt repair after the first delegated smoke: `createCodexPrompt()` now sends `<task_instruction>` separately from `<original_user_text>` and explicitly forbids rewriting delegated tasks into legacy `create_smoke_file`/monitor smoke unless the instruction asks for it.

## Capability Manifest

Available:

- Shell
- File read/write
- Git
- Network
- Codex CLI
- Codex exec JSONL
- Codex app-server command
- Codex MCP server command
- Approval bridge

Unavailable or not exposed through the launchd adapter:

- Browser: requires Codex host/app tool surface; not exposed to launchd `codex_exec` adapter.
- Computer Use: requires macOS app permission and host tool surface; not exposed to launchd `codex_exec` adapter.
- Controller skills: not directly listable by the launchd monitor.
- Controller plugins/apps: not directly callable by the launchd monitor.

## Regression

Local regression:

- `node --check monitor/src/codex_gateway.js`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node --test monitor/test/monitor.test.mjs`: PASS
- `node --check worker/src/index.js`: PASS
- `node --test worker/test/worker.test.mjs`: PASS

Covered by tests:

- General natural language preserved as `original_user_text`.
- Legacy `codex_task` alias becomes `codex_delegate`.
- Fixed smoke action remains available for legacy monitor regression only.
- Worker enqueue does not push a codex processing LINE message.
- Monitor processing callback is emitted once before completed final callback.
- Calendar direct route returns a not-enabled final and does not enqueue Codex.
- Exactly-once monitor claim does not rerun completed delegated tasks.
- Safe mock approval flow sends confirmation, accepts matching code, and requeues the same task.
- idea_create regression remains covered.
- Dropbox JSON/runtime data remain ignored.
- webhook/signature/admin/idempotency evidence regression remains covered by Worker tests.

## Result

Gate result: `PARTIAL`.

Implementation, Worker regression, monitor regression, Codex CLI availability, Gateway JSONL parsing, n8n production publish, and delegated Codex file/shell/test/git probes are verified. A fresh LINE-origin end-to-end `codex_delegate` acceptance message has not yet been sent in this final verification window, so LINE visible processing/final delivery for the newly published `codex_delegate` route remains pending.

Browser and Computer Use are listed as unavailable host surfaces for this launchd adapter with concrete reasons; this does not block ordinary Codex file/shell/test/git delegation.
