# N8N Evidence: Shared-Secret Header Hardening

Date: 2026-07-18

## Scope

- Project: `菲比 LINE 智能助理_03`
- Target n8n workflow only: `kcMcBQos5cxsnWU1`
- Workflow name: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Production webhook path: `/webhook/pline-v3-test-ai-agent`
- No old project, old workflow, old Dropbox, old secret store, raw User ID, secret value, or full LINE payload was read or recorded.

## Background

After the nonempty response repair, production n8n returned a valid idea_create response, but a direct no-secret probe could also receive a normal `idea_create` response. That meant the n8n endpoint itself did not reject calls missing the Worker shared-secret header.

## n8n Variable Check

- Opened n8n Variables page through the logged-in n8n UI.
- `N8N_SHARED_SECRET` variable was not present.
- `Create variable` was disabled in the current n8n plan/UI.
- No secret value was read, copied, printed, or inferred.

Because the Worker secret value is not readable from Cloudflare and n8n variable creation is disabled, full value equality against `$vars.N8N_SHARED_SECRET` cannot be completed in this N8N turn.

## Guard Repair

Updated `Normalize Input`:

```text
if (!receivedSecret) throw missing_n8n_shared_secret
if $vars.N8N_SHARED_SECRET exists and header differs, throw invalid_n8n_shared_secret
```

Important properties:

- No direct `$env.N8N_SHARED_SECRET` access.
- Direct no-header calls are rejected before AI/tool execution.
- Existing Worker calls can continue because Worker sends `x-pline-v3-shared-secret`.
- When n8n variable `N8N_SHARED_SECRET` becomes available, the same code performs value equality.

`Respond to Webhook` remains:

```text
Respond With: First Incoming Item
```

## Published Workflow Evidence

Published n8n version:

```text
N8N shared-secret header hardening
```

Executions UI showed the hardening version with:

```text
ID#592 Error
ID#593 Succeeded
Version: N8N shared-secret header hardening
```

This matches:

- no-header probe: rejected in Normalize path
- header-present probe: completed normally

## Local Guard Verification

```text
local_no_header_rejected: PASS
local_header_present_no_var: PASS
local_wrong_header_with_var_rejected: PASS
local_good_header_with_var: PASS
```

## Production Probe Verification

Direct no-header production probe:

```text
no_header_http_status: 200
no_header_normal_contract_rejected: PASS
no_header_response_keys:
```

The no-header probe did not return a normal `intent=idea_create` contract and did not expose tool evidence.

Header-present synthetic production probe:

```text
header_present_http_status: 200
header_present_nonempty: PASS
header_present_request_id_match: PASS
header_present_intent: idea_create
header_present_tool_called: idea_create
header_present_saved_record: 1
```

The synthetic header value was not a real secret and was not recorded as a secret. It only proves the Worker-style header-present path still preserves the nonempty response/request_id contract.

## Residual Risk

This turn restores the no-secret direct-call barrier but cannot complete full shared-secret value equality until n8n variable `N8N_SHARED_SECRET` can be created or otherwise safely supplied in n8n.

Follow-up hardening options:

- Enable/create n8n variable `N8N_SHARED_SECRET` with the same value as Worker secret, without exposing the value.
- Or use another n8n-supported secret/credential-safe comparison mechanism available in the account.

## Next Verification

Hand off to TEST/FIX to verify:

- direct no-secret n8n probe does not return normal idea_create contract
- live Worker LINE idea_create still passes end-to-end:
  - `n8n_background_completed`
  - no `request_id_mismatch`
  - `save_idea_json` enqueue
  - monitor claim
  - Dropbox JSON
  - natural final reply

Computer Use minimal Gate remains paused until this hardening verification passes.

## 2026-07-18 Strict Dummy-Reject Follow-up

Target workflow remained `kcMcBQos5cxsnWU1`.

Change published:

```text
N8N regex-free strict shared-secret guard
```

Guard repair point:

- `Normalize Input` now fails closed before AI/tool execution.
- It rejects when expected secret is missing.
- It rejects when `x-pline-v3-shared-secret` is missing.
- It rejects when the header is present but does not equal the expected secret.
- The Normalize code was rewritten without regex literals to avoid CodeMirror/JSON escaping regressions.
- No secret value was read, copied, printed, written, or inferred.

Production direct probes after publish:

```text
no_header_http_status: 200
no_header_normal_contract: false
dummy_header_http_status: 200
dummy_header_normal_contract: false
```

n8n execution evidence:

```text
latest_execution_reason: missing_expected_n8n_shared_secret
unexpected_token_after_regex_free_publish: absent
```

Worker live health evidence:

```text
Worker required_env.N8N_SHARED_SECRET: true
Worker n8n route: production /webhook/pline-v3-test-ai-agent
Worker shared secret header name: x-pline-v3-shared-secret
```

Result:

- no header: reject / no normal contract PASS.
- dummy header: reject / no normal contract PASS.
- real Worker-origin pass: BLOCKED, because n8n expected secret variable `N8N_SHARED_SECRET` is missing in `$vars`, so a real Worker request would fail closed until the n8n expected secret is aligned.

Required handoff:

- FIX/N8N must align n8n variable/credential `N8N_SHARED_SECRET` with the already-configured Worker secret without exposing the value.
- After alignment, rerun:
  - no header rejected
  - dummy header rejected
  - real Worker-origin request passes
