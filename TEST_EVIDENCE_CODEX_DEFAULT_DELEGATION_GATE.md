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
- Legacy n8n `codex_task` remains accepted as an alias, but new queued task action is `codex_delegate`.
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
- `tool_event_count`: 8
- Result file: `runtime/codex-gateway/live-delegate-1784369581077.json`
- Runtime output file: `runtime/codex-gateway-live/live-delegate-1784369581077.txt`
- Runtime output readback: `Codex Gateway live PASS`

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
- Exactly-once monitor claim does not rerun completed delegated tasks.
- Safe mock approval flow sends confirmation, accepts matching code, and requeues the same task.
- idea_create regression remains covered.
- Dropbox JSON/runtime data remain ignored.
- webhook/signature/admin/idempotency evidence regression remains covered by Worker tests.

## Result

Gate result: `PASS`.

CodexGateway and the CLI adapter are implemented and verified. Browser and Computer Use are listed as unavailable host surfaces for this launchd adapter with concrete reasons; other available capabilities remain online.
