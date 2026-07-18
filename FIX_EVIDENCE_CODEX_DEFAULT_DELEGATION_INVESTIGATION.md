# FIX Evidence: Codex Default Delegation Investigation

Date: 2026-07-18 17:44:27 CST

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- CWD verified by `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project access: prohibited
- Scope: `_03` repository only
- No secrets, raw LINE User ID, or full webhook payload were read or written.
- No runtime implementation was changed in this investigation.

## Probe Summary

- Host: `Phoebes-Mac-mini.local`
- User: `phoebe`
- OS: Darwin arm64
- Codex CLI: `codex-cli 0.142.5`
- LaunchAgent: `com.pline.v3.test.codex-monitor`
- LaunchAgent state: running
- LaunchAgent program: `/opt/homebrew/bin/node`
- LaunchAgent working directory: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- LaunchAgent command: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/monitor/src/monitor.js runner`

## Current Executor Trace

The durable monitor currently executes `codex_task` through local fixed-action code, not through a Codex turn.

Relevant locations:

- `monitor/src/monitor.js`
  - Lines 14-18 define fixed smoke constants: project, project path, smoke file path/content, and `FIXED_ACTION = "create_smoke_file"`.
  - Lines 36-63 resolve `CODEX_BIN` and only check whether an executable exists.
  - Lines 95-142 implement `runTask`.
  - Lines 122-140 create the smoke directory, write the fixed smoke file, read it back, and return `codex_execution: true`.
  - Lines 284-323 write completion evidence/result and call the Worker finalizer.
- `worker/src/index.js`
  - Lines 22-28 define fixed `codex_task` action/path/content/instruction.
  - Lines 672-689 enqueue the fixed task record.
  - Lines 950-963 gate non-smoke capabilities as `capability_not_yet_enabled`.
  - Lines 2013-2031 sanitize completed task records back to the same fixed smoke contract.
- `monitor/com.pline.v3.test.codex-monitor.plist`
  - Starts the monitor as a Node launchd runner.
  - Provides `CODEX_BIN=/Users/phoebe/.local/bin/codex`.

`CODEX_BIN` is therefore a health prerequisite today. It is not used to spawn Codex for task execution.

## Fifteen-Point Investigation

1. Durable monitor execution: launchd runs `node monitor/src/monitor.js runner`, which drains `_03` KV pending indexes, claims tasks, calls local `runTask`, writes result/evidence, and calls Worker finalizer endpoints.
2. Fixed local script: yes. The current `create_smoke_file` path is local Node.js filesystem code.
3. True Codex call: no. Current task execution does not call Codex CLI, SDK, App Server, desktop host, MCP tools, or ChatGPT-Codex tools.
4. Current mechanism: local Node.js runner plus Wrangler KV access. Codex CLI is present only as an executable health check.
5. Original LINE instruction to Codex: no. The LINE instruction is not passed to a Codex turn.
6. Fixed smoke replacement: yes. Worker stores `CODEX_TASK_INSTRUCTION = "Create or overwrite the fixed smoke file with the fixed smoke content."`, fixed project/path/action/content.
7. Codex thread creation: no evidence. The monitor does not call thread creation or `codex exec`.
8. Codex turn start: no evidence. No turn is started by the monitor.
9. Sandbox mode: current interactive Codex thread is configured by the host with unrestricted filesystem access and approval policy `never`; the durable monitor itself has no Codex sandbox policy because it is a Node launchd process.
10. Approval policy: current interactive thread has `never`; durable monitor has no approval request/response channel.
11. Codex host machine: current thread and monitor run on Phoebe's Mac mini.
12. Host read access: the monitor can read/write explicit `_03` paths through Node.js filesystem APIs. This does not prove a delegated Codex agent can access the same working directory.
13. Shell/Git/network: current interactive thread has shell and network available, while user instructions prohibit Git commit/push for this Gate. The monitor uses Node.js and `npx wrangler` for KV operations; it does not expose arbitrary shell or Git task execution.
14. Completion/failure/approval events: completion/failure currently come from KV task records and Worker finalizer callbacks. There are no streamed Codex turn events and no approval events.
15. Plugins/Apps/Skills/MCP listing: the current Codex desktop conversation can see tools, plugins, and skills through the model/tool surface. The launchd monitor cannot list or call those tools; no MCP/App Server client is implemented in `_03`.

## Codex CLI and Gateway Surface

CLI help showed:

- `codex exec`: non-interactive Codex execution exists as a CLI command and can emit JSON events.
- `codex mcp-server`: Codex can run as an MCP server.
- `codex app-server`: experimental app-server tooling exists.
- `codex remote-control`: experimental remote-control daemon management exists.
- `codex mcp`: can manage external MCP servers.

This is not yet a usable `_03` CodexGateway, because the repository has no implemented client, no selected protocol, no authentication/permission model, no durable event parser, no approval bridge, and no proof that launchd monitor may dispatch into the same desktop tool/plugin/skill surface as this controller thread.

## Gateway Feasibility Matrix

| Capability | Current `_03` status | Feasibility conclusion |
| --- | --- | --- |
| `app/list` | No `_03` client or protocol | Blocked |
| `skills/list` | Visible to this controller thread only | Blocked for monitor |
| `thread/start` | No monitor API/client | Blocked |
| `thread/resume` | No monitor API/client | Blocked |
| `turn/start` | No monitor API/client | Blocked |
| `turn/steer` | No monitor API/client | Blocked |
| Streamed items / turn events | `codex exec --json` exists, but `_03` does not use it and has no event contract | Not accepted for default delegation yet |
| Approval request / response | No durable approval bridge | Blocked |
| Codex App Server / SDK / CLI official support | CLI exposes experimental app-server/remote-control and non-interactive exec, but no `_03` integration exists | Needs a separate design Gate |
| Desktop surface dispatch from durable monitor | No available callable bridge from launchd monitor to controller tools | Blocked |

## Conclusion

Status: `BLOCKED_FOR_DEFAULT_DELEGATION`

The current `_03` codex_task executor is a safe fixed smoke runner. It does not create Codex threads, does not start Codex turns, does not pass original LINE instructions to Codex, and cannot access the current controller thread's Apps, Plugins, Skills, MCP tools, Computer Use, Browser, or approval surface.

Default delegation should not proceed until a formal, auditable host/API is selected and authorized. A safe next implementation Gate must first define one of these:

1. A supported Codex CLI `exec --json` contract with strict sandbox/approval settings, output schema, event parsing, timeout, no-secret logging, and exactly-once finalization.
2. A supported Codex App Server / remote-control protocol with authentication, thread/turn lifecycle, streamed events, and approval bridge.
3. A controller-owned handoff protocol where a human-visible Codex task claims work and writes a no-secret result record.

Until one of those is approved, `_03` must keep `codex_task` limited to the already-safe fixed smoke capability or mark wider capabilities as `capability_not_yet_enabled`.
