# FIX Evidence: Computer Use `open_browser_page` Feasibility

Date: 2026-07-18

Scope:

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Worker: `pline-v3-test-line-gateway`
- Monitor: `pline-v3-test-codex-monitor`
- No old project, `_02`, old Dropbox, old secret store, old logs, old User ID, raw User ID, secrets, or full webhook payload were used or recorded.

Gate Goal

- Requested capability: `open_browser_page`
- Allowed target in first version: `about:blank` or `https://example.com/`
- Required execution mode: true Codex/Computer Use operation, not shell `open`.

Feasibility Result

- Current `_03` monitor is a normal local Node.js process.
- Current monitor supported actions are:
  - `create_smoke_file`
  - `save_idea_json`
- Current live Worker `/health` also reports only:
  - `create_smoke_file`
  - `save_idea_json`
- The monitor can use local JavaScript, fixed file writes, Wrangler KV, and HTTP callbacks.
- The monitor cannot directly call this Codex thread's MCP tools, `node_repl`, or Computer Use skill.
- The current thread can attempt UI actions while it is active, but that capability is not callable by the background monitor after a LINE event.

Decision

- `open_browser_page` was not added.
- No shell `open`, arbitrary command, AppleScript browser automation, or fake browser-open implementation was added.
- No Worker/n8n/monitor claim was made that Computer Use is enabled.
- This is a concrete blocker for this Gate, not a permanent product decision about Computer Use.

Minimum Viable Bridge Needed

To pass this Gate later, one of these must be explicitly provided:

1. A trusted local bridge that lets the `_03` monitor call a Codex-owned Computer Use executor for a fixed action `open_browser_page`.
2. A controller-thread claim/finalize protocol where the existing PLine03 controller explicitly claims `open_browser_page` tasks and performs Computer Use, with durable exactly-once task/final state.
3. A purpose-built installed tool/API exposed to the monitor that can perform only `open_browser_page` with a strict URL allowlist.

Required Safety Boundary For Future Implementation

- Accept only action `open_browser_page`.
- Allow only `about:blank` or `https://example.com/` in the first Gate.
- Do not read sensitive page content.
- Do not log in, fill forms, submit data, accept permissions, download, upload, or change settings.
- Do not execute arbitrary shell commands or accept arbitrary local paths.
- Preserve idea_create, Dropbox JSON, n8n hardening, Codex smoke, idempotency, admin allowlist, and webhook HTTP 200 behavior.

Verification Performed

- `pwd`: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- `node monitor/src/monitor.js health`: ready; supported actions remain `create_smoke_file`, `save_idea_json`.
- live Worker `/health`: required env true; supported monitor actions remain `create_smoke_file`, `save_idea_json`.
- `node --check worker/src/index.js`: PASS
- `node --check monitor/src/monitor.js`: PASS

Blocked Reason

`monitor_unable_to_call_codex_computer_use_tools`

No live LINE Gate was run because implementing it with shell/browser automation would not satisfy the required Codex Computer Use execution mode.
