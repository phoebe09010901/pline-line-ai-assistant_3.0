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

The first monitor must not execute arbitrary shell commands, arbitrary file writes, arbitrary paths, or user-supplied code.

The only first action is:

```text
create_smoke_file
```

The only target is:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt
```

The only content is:

```text
Codex 已打通
```

## CODEX_BIN Requirement

Future monitor implementation must:

1. Check `CODEX_BIN`.
2. If unset, resolve the executable from the current environment.
3. Verify that the executable exists and is runnable at startup.
4. Report the resolved value in health output.
5. Fail health before task execution if the executable is missing.

## Out-of-Scope Features

Do not add Google Calendar, accounting, email, attachments, multiple agents, FORMAL mode, real-time wake, WebSocket, complex queueing, complex state machines, compatibility layers, or broad regex/if/else routing in the first version.
