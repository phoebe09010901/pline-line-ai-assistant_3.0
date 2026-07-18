# TEST_PLAN

## Test Scope

Only verify the minimal dual-path TEST loop.

## Gate 1: n8n Minimal Path

Test sentence:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Required evidence per run:

- LINE event = 1
- Worker invocation = 1
- signature PASS
- admin PASS
- idempotency PASS
- n8n execution = 1
- AI Agent execution = 1
- intent = `idea_create`
- tool_called = `idea_create`
- saved record = 1
- LINE reply = 1
- Codex task = 0
- no duplicate
- no non-`_03` resource
- Dropbox idea JSON file written for the `save_idea_json` extension when that extension is under test
- success final text only after JSON `saved` or `duplicate`

Pass rule:

```text
N8N MINIMAL PATH PASS
```

Only after three consecutive successful runs.

## Gate 2: Codex Minimal Path

Test sentence:

```text
請 Codex 在 _03 專案建立測試檔案
```

Required evidence:

- LINE event = 1
- Worker invocation = 1
- n8n execution = 1
- intent = `codex_task`
- codex task = 1
- monitor claim = 1
- Codex execution = 1
- file exists
- content is correct
- LINE final = 1
- no duplicate
- no non-`_03` resource

Required file:

```text
/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt
```

Required content:

```text
Codex 已打通
```

## TEST-14 Live Gate Attempt

Date: 2026-07-18

Scope:

- Gate 1 already passed in TEST-13: `N8N MINIMAL PATH PASS`
- TEST-14 reran Gate 2 only after FIX-17 monitor poll support.

Pre-Gate:

- Monitor health: `ready`
- Monitor poll started before Gate 2:

```text
MONITOR_POLL_ITERATIONS=45 MONITOR_POLL_INTERVAL_MS=1000 node monitor/src/monitor.js poll
```

- Smoke file precheck mtime: `2026-07-18 05:58:36`
- Smoke file precheck epoch: `1784325516`
- Smoke file precheck content: `Codex 已打通`

Gate 2 message:

```text
請 Codex 在 _03 專案建立測試檔案 T1401-20260718060326
```

Gate 2 evidence:

- LINE event=1: yes
- Worker invocation=1: yes
- signature PASS: yes
- admin PASS: yes
- idempotency PASS: yes
- n8n execution/background completed=1: yes
- intent=`codex_task`: yes
- tool_called=`codex_task`: yes
- codex task=1: yes
- task_id_present=1: yes
- codex_task_enqueued=1: yes
- monitor claim=1: yes, `monitor_claimed`
- Codex execution=1: yes, `codex_execution_completed`
- smoke file written=1: yes, `smoke_file_written`
- LINE final=1: yes, `line_push_final_completed`
- no duplicate: yes, idempotency pass and single deterministic stage set
- no non-`_03` resource: yes, remote `_03` KV and `_03` LINE chat only

Smoke file postcheck:

- Path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt`
- mtime: `2026-07-18 06:03:46`
- epoch: `1784325826`
- updated after Gate 2 precheck: yes
- content: `Codex 已打通`

Result:

```text
CODEX MINIMAL PATH PASS
_03 MINIMAL DUAL-PATH PASS
```

Required next step:

```text
Hand off to PLine03｜RELEASE｜部署與收尾.
```

Pass rule:

```text
CODEX MINIMAL PATH PASS
```

One successful run is enough.

## Final Project Pass

Only when Gate 1 and Gate 2 both pass:

```text
_03 MINIMAL DUAL-PATH PASS
```

## Dropbox idea_create JSON Extension

Date: 2026-07-18

Required TEST precondition:

- Start the local monitor before sending the LINE idea message so Worker can observe `save_idea_json` completion inside the background wait window.

Monitor command:

```text
MONITOR_POLL_ITERATIONS=45 MONITOR_POLL_INTERVAL_MS=1000 node monitor/src/monitor.js poll
```

Required evidence:

- Worker `idea_json_save_enqueued`
- Monitor `monitor_claimed`
- Monitor `idea_json_saved`
- Monitor `idea_json_file_written`
- Worker `idea_json_saved`
- Worker `idea_json_final_push_completed`
- Dropbox file exists in the fixed `_03` directory
- JSON has exactly the allowed schema fields
- no raw LINE User ID, secret, token, signature, or full webhook payload in JSON or evidence
- duplicate same LINE event does not create a second JSON and does not send a second formal success reply

Final reply repair expectation:

- Worker no longer relies on a monitor timing window for idea final success.
- Monitor must call Worker `/test/idea-finalize` after `save_idea_json`.
- Worker finalizer must verify task-scoped `finalize_token` and use durable final state `idea_json:v1:final:<task_id>`.
- A saved non-duplicate idea must produce LINE final text `已幫妳記下這個想法 💡` and Worker evidence `idea_json_final_push_completed`.
- A timeout/failure must not send the success text.
- A duplicate or repeated callback must not send a second formal final push and may record `idea_json_final_push_suppressed` or already-completed/suppressed final state.

No-secret monitor selftest:

```text
node monitor/src/monitor.js idea-selftest --task_id=<safe-id> --request_id=<safe-request-id> --marker=<safe-marker>
```

## Current DOC Stage Verification

This DOC stage does not execute Gate 1 or Gate 2. It verifies only that the baseline files exist and that the described scope matches the minimal dual-path requirement.

## TEST-01 Readiness Result

Date: 2026-07-18

- Local Worker test: PASS (`worker skeleton tests PASS`)
- Local monitor test: PASS (`monitor skeleton tests PASS`)
- Local monitor health: ready
- Cloudflare config dry-run: PASS (`npx wrangler deploy --dry-run`)
- Cloudflare external resources: not created or modified in TEST-01
- n8n `N8N_SHARED_SECRET`: required but not verified/set by this TEST thread
- LINE Developers TEST webhook: required but not verified/set by this TEST thread
- Gate 1 live LINE test: BLOCKED before execution
- Gate 2 live LINE test: BLOCKED before execution

Blocking condition:

```text
Authorized TEST secrets, Cloudflare deployed bindings, n8n shared-secret setup, LINE Developers TEST webhook setup, and 菲比真人 LINE send are required before live Gate 1/Gate 2 can be executed.
```

## TEST-02 Live Gate Attempt

Date: 2026-07-18

Authorization text received:

```text
TEST live gate 已完成授權設定
```

Pre-Gate live readiness result:

- Cloudflare Worker `pline-v3-test-line-gateway`: FAIL, Worker not found in the currently logged-in Cloudflare account
- Cloudflare Worker deployments query: FAIL before Gate execution
- Cloudflare Worker versions query: FAIL before Gate execution
- Cloudflare Worker secrets query: FAIL before Gate execution
- KV live bindings in `worker/wrangler.toml`: not present; placeholders remain
- Local monitor health: ready
- Gate 1 live LINE messages: not executed
- Gate 2 live LINE message: not executed

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must create/deploy the _03 TEST Worker, bind _03 TEST KV namespaces, set required TEST secrets without exposing values, and return to TEST for live Gate execution.
```

## FIX-03 Cloudflare Readiness Result

Date: 2026-07-18

- Cloudflare account confirmed through Wrangler: `689b11645545394cce76cf14fdbadb4c`
- KV `pline-v3-test-runtime`: created, id `10cdfe018b3942b483faeaca6e517ae5`
- KV `pline-v3-test-idempotency`: created, id `1f857def085d466abed722e9222002e3`
- `worker/wrangler.toml`: live KV bindings added
- D1 `pline-v3-test-db`: not created; not required for first-stage TEST
- Required Worker secrets: blocked, not available from authorized local sources
- Wrangler deploy dry-run: PASS with live `_03` KV bindings
- Local Worker/monitor checks: PASS
- n8n workflow JSON parse: PASS
- Local monitor health: ready
- Worker deploy: blocked before deploy
- Gate 1 live LINE test: not executed
- Gate 2 live LINE test: not executed

Blocking condition:

```text
Required TEST secret values must be supplied or set through an authorized channel before Worker secret setup and deploy can continue.
```

## FIX-04 LINE Scope Guard Result

Date: 2026-07-18

- `_02` named LINE channel resources are not acceptable for `_03`.
- `_02` LINE secret/token values were visible before the correction, but were not set in Cloudflare/n8n and were not written to repo files.
- No `_03` LINE Official Account/channel was available in the visible account list.
- New `_03` LINE Official Account/channel creation is blocked at the terms/privacy agreement step that must be completed by 菲比.
- Gate 1 live LINE test: not executed
- Gate 2 live LINE test: not executed

Blocking condition:

```text
菲比 must create or switch to a non-_02 `_03` TEST LINE channel before `_03` LINE secrets and current-event admin ID capture can continue.
```

## FIX-06 Deploy Readiness Result

Date: 2026-07-18

- `_03` LINE channel: `菲比智能客服 測試_03`
- `_02` LINE resources: not used
- Cloudflare Worker: deployed
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- LINE webhook: configured to `/line/webhook`
- LINE Developers Verify: Success from FIX-05
- `LINE_TEST_ADMIN_USER_IDS`: configured from current `_03` bootstrap event; raw id not recorded
- Bootstrap KV key: deleted after secret setup
- Required Worker secrets: configured by name
- Worker `/health`: all required env fields true
- Wrangler tail/logs: readable
- n8n workflow `kcMcBQos5cxsnWU1`: shared-secret verification configured

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must execute Gate 1 three consecutive idea_create runs and Gate 2 codex_task run.
```

## TEST-03 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable, required env flags true
- Cloudflare deployments: Worker exists
- Cloudflare secret names: required names present
- LINE app target: `菲比智能客服 測試_03`
- Wrangler tail: readable

Gate 1 run 1 sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 run 1 observed:

- LINE event=1: yes
- Worker invocation=1: yes
- Worker version: `a49c1d70-4d68-46ff-b5fe-d537b0d0869f`
- Worker response: `502`
- LINE reply=1: no
- n8n execution=1: not proven
- AI Agent execution=1: not proven
- intent=`idea_create`: not proven
- tool_called=`idea_create`: not proven
- data record=1: not proven

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must repair the Worker-to-n8n/LINE reply path and provide enough no-secret evidence to prove n8n execution, AI Agent execution, tool call, and reply status before TEST retries Gate 1/Gate 2.
```

## FIX-07 Repair Result

Date: 2026-07-18

- Root cause: live Worker used n8n `webhook-test` URL.
- Repair: Worker now uses production n8n webhook URL.
- n8n workflow `kcMcBQos5cxsnWU1`: Published
- Worker version: `19c6ece9-5d6f-4b62-a4fd-060c22c26f12`
- Worker `/health`: production n8n webhook URL and required env flags true
- Worker no-secret stage logs: added
- Wrangler tail/logs: readable

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must rerun Gate 1 three consecutive idea_create runs and then Gate 2 using Computer Use to operate the LINE app.
```

## FIX-14 LINE Webhook Timeout Repair Result

Date: 2026-07-18

- TEST-10 failure: user-sent LINE app message had no visible ACK and no durable `evidence:v1` marker.
- LINE Developers Webhook errors showed `request_timeout` for the `_03` Worker webhook at `2026/07/18 06:06:36`.
- Root cause: foreground LINE webhook path awaited multiple `RUNTIME_KV` evidence writes before completing fast ACK / webhook response.
- Repair: foreground evidence persistence now uses `queueEvidenceStage(...)` with `ctx.waitUntil(...)`.
- Background n8n evidence remains durable in the background task.
- Unit coverage: webhook returns HTTP `200` even if `RUNTIME_KV.put(...)` never resolves.
- Worker version: `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`
- Worker `/health`: reachable, required env flags true, evidence block present.
- Route check: invalid-signature `POST /line/webhook` returns HTTP `401`.
- LINE Developers Verify after deploy: Success.
- Cloudflare tail: official Verify POST reached Worker version `8f460265-2d79-4ee4-bd3b-2a69cfb17d09` with HTTP `200`.

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must rerun Gate 1 three consecutive idea_create runs and then Gate 2 using Computer Use to operate the LINE app. If tail misses a run, TEST must query Worker durable evidence by T-code marker.
```

## TEST-11 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable
- Worker required env flags: true
- Worker evidence block: present with `RUNTIME_KV`, prefix `evidence:v1`, read path `/test/evidence`, and guard header `x-pline-v3-shared-secret`
- Worker line reply mode: `fast_ack_then_background_n8n`
- Worker codex task final mode: `background_push_final`
- FIX-14 Worker version: `8f460265-2d79-4ee4-bd3b-2a69cfb17d09`
- KV fallback namespace: `pline-v3-test-runtime` id `10cdfe018b3942b483faeaca6e517ae5`
- LINE app target: `菲比智能客服 測試_03`

Gate 1 run 1 sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 observed by sanitized tail:

- LINE event=1: yes
- Worker invocation=1: yes
- Worker response: HTTP `200`
- signature PASS: yes
- admin PASS: yes
- idempotency PASS: yes
- LINE reply=1: yes, `line_fast_reply_completed`
- n8n execution/background completed=1: yes
- intent=`idea_create`: yes
- tool_called=`idea_create`: yes
- data record=1: yes, `saved_record=1`
- Codex task=0: yes

Durable evidence readback:

- KV marker `evidence:v1:marker:T1101-20260718051847`: `Value not found`
- KV request stage prefix for the tail-observed request id: no stage keys found

Gate 2:

- Not executed because Gate 1 run 1 could not be marked PASS under the durable evidence requirement.

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must repair or explain why FIX-14 runtime completion does not persist `evidence:v1` marker/request stage records in `_03` RUNTIME_KV, then return to TEST.
```

## TEST-10 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable
- Worker required env flags: true
- Worker evidence block: present with `RUNTIME_KV`, prefix `evidence:v1`, read path `/test/evidence`, and guard header `x-pline-v3-shared-secret`
- Worker line reply mode: `fast_ack_then_background_n8n`
- Worker codex task final mode: `background_push_final`
- FIX-13 LINE delivery readiness: `Use webhook` enabled, redelivery enabled, error statistics aggregation enabled, endpoint active=true, LINE Developers Verify Success
- KV fallback namespace: `pline-v3-test-runtime` id `10cdfe018b3942b483faeaca6e517ae5`
- LINE app target: `菲比智能客服 測試_03`

Gate 1 run 1 sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 observed:

- LINE event=1: not proven
- Worker invocation=1: not proven
- signature PASS: not proven
- admin PASS: not proven
- idempotency PASS: not proven
- LINE reply=1: not observed for run 1
- n8n execution/background completed=1: not proven
- intent=`idea_create`: not proven
- tool_called=`idea_create`: not proven
- data record=1: not proven
- Codex task=0: not proven through runtime evidence
- KV marker `evidence:v1:marker:T1001-20260718050632`: `Value not found` across repeated readbacks

Gate 2:

- Not executed because Gate 1 run 1 failed and the required three consecutive evidenced successes cannot be met.

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must inspect why user-sent LINE messages in the confirmed `_03` LINE app chat still do not produce Worker durable evidence after FIX-13, despite LINE official Verify and endpoint active=true passing.
```

## FIX-13 LINE Delivery Repair Result

Date: 2026-07-18

- TEST-09 failure: valid Gate 1 candidates had no visible ACK, no Worker tail invocation, and no `evidence:v1` marker records.
- LINE channel inspected: `菲比智能客服 測試_03`
- Channel id: `2010748091`
- Bot basic id: `@967fvhek`
- Webhook URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`
- `Use webhook`: enabled before repair and remains enabled.
- Webhook endpoint API: HTTP `200`, active=true, expected URL.
- LINE Developers Verify: Success.
- Worker route check: synthetic invalid-signature `POST /line/webhook` returns HTTP `401`.
- Worker official Verify route result: LINE official POST reached Worker and returned HTTP `200` on version `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`.
- Repair:
  - `Webhook redelivery`: enabled.
  - `Error statistics aggregation`: enabled.
- Worker code/deploy/secrets: unchanged.

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must rerun Gate 1 three consecutive idea_create runs and then Gate 2 using Computer Use to operate the LINE app. If tail misses a run, TEST must query Worker durable evidence by T-code marker.
```

## TEST-09 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable
- Worker required env flags: true
- Worker evidence block: present with `RUNTIME_KV`, prefix `evidence:v1`, read path `/test/evidence`, and guard header `x-pline-v3-shared-secret`
- Worker line reply mode: `fast_ack_then_background_n8n`
- Worker codex task final mode: `background_push_final`
- KV fallback namespace: `pline-v3-test-runtime` id `10cdfe018b3942b483faeaca6e517ae5`
- LINE app target: `菲比智能客服 測試_03`
- Wrangler tail: opened for live observation

Pre-Gate note:

- A malformed marker probe `T0901-2026071801438302` was sent but not counted because the Worker marker pattern requires `Tdddd-YYYYMMDDHHMMSS`.

Valid Gate 1 candidates sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 observed:

- LINE event=1: not proven
- Worker invocation=1: not proven
- signature PASS: not proven
- admin PASS: not proven
- idempotency PASS: not proven
- LINE reply=1: not observed for valid candidates
- n8n execution/background completed=1: not proven
- intent=`idea_create`: not proven
- tool_called=`idea_create`: not proven
- data record=1: not proven
- Codex task=0: not proven through runtime evidence
- KV marker `evidence:v1:marker:T0901-20260718045141`: `Value not found`
- KV marker `evidence:v1:marker:T0901A-20260718045215`: `Value not found`
- Live tail during `T0901A-20260718045215`: no Worker log emitted during observation window

Gate 2:

- Not executed because Gate 1 did not reach three consecutive evidenced successes.

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must inspect why live LINE messages to `菲比智能客服 測試_03` did not invoke Worker `pline-v3-test-line-gateway` or produce `evidence:v1` marker records after FIX-12, then return to TEST.
```

## FIX-12 Observability Repair Result

Date: 2026-07-18

- Root cause: TEST-08 had one fully evidenced Gate 1 run, but later visible fast ACK replies could not be fully correlated through Cloudflare tail or n8n executions.
- Repair: Worker persists no-secret Gate evidence into existing `_03` `RUNTIME_KV`.
- Evidence prefix: `evidence:v1`
- Marker index: `evidence:v1:marker:<T-code>` -> `<request_id>`
- Stage prefix: `evidence:v1:request:<request_id>:stage:`
- HTTP readback:

```text
GET /test/evidence?marker=<T-code>
GET /test/evidence?request_id=<request_id>
Header: x-pline-v3-shared-secret
```

- Fallback readback:

```text
npx wrangler kv key get --namespace-id 10cdfe018b3942b483faeaca6e517ae5 "evidence:v1:marker:<T-code>"
npx wrangler kv key list --namespace-id 10cdfe018b3942b483faeaca6e517ae5 --prefix "evidence:v1:request:<request_id>:stage:"
```

- No-secret constraint: evidence excludes raw LINE User ID, token, channel secret, signature, shared secret, and full message text.
- Worker version: `f8bcc1f6-a7b5-4b0f-80ed-49b3f5f5215a`
- Worker `/health`: reachable, required env flags true, evidence block present.
- `/test/evidence` without shared-secret header: HTTP `401`.
- Local tests and Wrangler dry-run: PASS.

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must rerun Gate 1 three consecutive idea_create runs and then Gate 2 using Computer Use to operate the LINE app. If tail misses a run, TEST must query Worker evidence by T-code marker or request_id.
```

## TEST-08 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable, required env flags true
- Worker `/health` n8n URL: production `/webhook/pline-v3-test-ai-agent`
- Worker `/health` line reply mode: `fast_ack_then_background_n8n`
- Worker `/health` codex task final mode: `background_push_final`
- FIX-11 evidence: n8n workflow published as `FIX-11 continue on AI error`
- LINE app target: `菲比智能客服 測試_03`
- Wrangler tail: readable, but inconsistent for later LINE events
- n8n Executions panel: no saved executions available for per-run correlation

Gate 1 run 1 sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 run 1 observed:

- LINE event=1: yes
- Worker invocation=1: yes
- Worker version: `02b1fa59-4d4c-4119-8dc8-5699183d5456`
- signature PASS: yes
- admin PASS: yes
- idempotency PASS: yes
- fast ACK LINE reply: yes
- Worker response: `200`
- n8n background started: yes
- n8n background completed: yes
- intent=`idea_create`: yes
- status=`completed`: yes
- tool_called=`idea_create`: yes
- saved_record=1: yes

Gate 1 subsequent attempts sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
記一下：[REDACTED_IDEA_CONTENT]
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 subsequent attempts observed:

- LINE app displayed fast ACK replies.
- Cloudflare tail did not emit matching LINE/background events during observation windows.
- n8n saved executions were not available for correlation.
- These attempts cannot count as fully evidenced Gate 1 passes.

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must repair or strengthen live evidence observability so TEST can prove three consecutive Gate 1 runs and then Gate 2 without relying on unverified inference.
```

## FIX-11 Repair Result

Date: 2026-07-18

- Live n8n inspection target: workflow `kcMcBQos5cxsnWU1` only.
- TEST-07 failure inspected: execution `#551`, version `FIX-10 request_id contract`.
- Root cause: execution `#551` failed in sub-node `OpenAI Chat Model`; AI Agent `On Error: Stop Workflow` stopped the workflow before deterministic response contract completion.
- Repair: AI Agent `On Error` changed to `Continue`.
- n8n publish: version `FIX-11 continue on AI error`; UI status `Published`.
- Live verification: retried execution `#551` with currently saved workflow and produced execution `#552`.
- Retry result: `#552` succeeded; `Structured Output` success 1 item; `Respond to Webhook` success 1 item.
- Contract evidence observed without secrets/raw ids: request id preserved as `pline-v3-...`, `intent=idea_create`, `status=completed`, `tool_called=idea_create`, `saved_record=1`, `record=1`.
- Worker code: unchanged.
- Worker deploy: not required.
- Current Worker version: `02b1fa59-4d4c-4119-8dc8-5699183d5456`.
- Evidence: `FIX_EVIDENCE_FIX_11.md`.

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must rerun Gate 1 three consecutive idea_create runs and then Gate 2 using Computer Use to operate the LINE app.
```

## FIX-15 Durable Evidence Repair Result

Date: 2026-07-18

- TEST-11 runtime tail showed the LINE/n8n path completed, but durable `evidence:v1` marker and request stage records were missing.
- Repair: Worker now writes marker first, then summary, then deterministic request stage key.
- Request stage key format:

```text
evidence:v1:request:<request_id>:stage:<stage>
```

- Marker key format:

```text
evidence:v1:marker:<T-code>
```

- Protected readback remains:

```text
GET /test/evidence?marker=<T-code>
GET /test/evidence?request_id=<request_id>
```

- Worker deployed version: `5a41bd15-789f-43ce-9bd0-2365d9dcef21`.
- Local and deploy validation passed.

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must rerun Gate 1 three consecutive idea_create runs and then Gate 2. For each run, TEST should query durable evidence by marker if live tail misses any stage.
```

## TEST-07 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable, required env flags true
- Worker `/health` n8n URL: production `/webhook/pline-v3-test-ai-agent`
- Worker `/health` line reply mode: `fast_ack_then_background_n8n`
- Worker `/health` codex task final mode: `background_push_final`
- FIX-10 evidence: Worker version `02b1fa59-4d4c-4119-8dc8-5699183d5456` deployed and n8n workflow published as `FIX-10 request_id contract`
- LINE app target: `菲比智能客服 測試_03`
- Wrangler tail: readable after restart

Gate 1 first attempt sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 first attempt observed:

- LINE app fast ACK: yes
- Cloudflare tail event: not captured during observation window
- Result: not counted as fully evidenced Gate 1 pass

Gate 1 evidenced candidate sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 evidenced candidate observed:

- LINE event=1: yes
- Worker invocation=1: yes
- Worker version: `02b1fa59-4d4c-4119-8dc8-5699183d5456`
- signature PASS: yes
- admin PASS: yes
- idempotency PASS: yes
- fast ACK LINE reply: yes
- Worker response: `200`
- n8n background started: yes
- n8n background contract: failed
- failure stage: `n8n_background_contract_failed`
- failure reason: `request_id_mismatch`
- AI Agent execution=1: not proven
- intent=`idea_create`: not proven
- tool_called=`idea_create`: not proven
- data record=1: not proven

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must inspect the live n8n production response actually returned to Worker and eliminate the remaining request_id_mismatch before TEST retries Gate 1/Gate 2.
```

## TEST-06 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable, required env flags true
- Worker `/health` n8n URL: production `/webhook/pline-v3-test-ai-agent`
- Worker `/health` line reply mode: `fast_ack_then_background_n8n`
- Worker `/health` codex task final mode: `background_push_final`
- FIX-09 evidence: Worker version `97f20405-6ed9-4cfb-801d-218ae1f21c61` deployed
- LINE app target: `菲比智能客服 測試_03`
- Wrangler tail: readable

Gate 1 run 1 sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 run 1 observed:

- LINE event=1: yes
- Worker invocation=1: yes
- Worker version: `97f20405-6ed9-4cfb-801d-218ae1f21c61`
- signature PASS: yes
- admin PASS: yes
- idempotency PASS: yes
- fast ACK LINE reply: yes
- n8n background started: yes
- failure stage: `n8n_background_contract_failed`
- failure reason: `request_id_mismatch`
- n8n execution=1: background call started, but contract failed
- AI Agent execution=1: not proven
- intent=`idea_create`: not proven
- tool_called=`idea_create`: not proven
- data record=1: not proven

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must align the n8n production response contract so it preserves the Worker request_id and returns Gate evidence fields, then return to TEST for Gate 1/Gate 2.
```

## FIX-10 Repair Result

Date: 2026-07-18

- Root cause: n8n `Structured Output` trusted AI Agent `parsed.request_id` before falling back to `Normalize Input`, allowing a mismatched request id to override the Worker request id.
- n8n repair: workflow `kcMcBQos5cxsnWU1` now always uses `$('Normalize Input').first().json.request_id` as the response `request_id`.
- n8n evidence fields:
  - `idea_create`: `tool_called=idea_create`, `saved=true`, `saved_record=1`, `record=1`
  - `codex_task`: `tool_called=codex_task`, `codex_task=1`, `action=create_smoke_file`, fixed target path/content, and `task_id`
- n8n publish: version `FIX-10 request_id contract`; UI status `Published`
- Worker repair: contract validator and no-secret `n8n_background_completed` logs now include Gate evidence fields.
- Worker version: `02b1fa59-4d4c-4119-8dc8-5699183d5456`
- Worker `/health`: reachable, required env flags true, production n8n webhook URL, `line_reply_mode`, and `codex_task_final_mode` confirmed.
- Required secret names: present by name only.
- KV bindings: `_03` TEST `RUNTIME_KV` and `IDEMPOTENCY_KV` confirmed.
- Wrangler tail/logs: readable.

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must rerun Gate 1 three consecutive idea_create runs and then Gate 2 using Computer Use to operate the LINE app.
```

## TEST-04 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable, required env flags true
- Worker `/health` n8n URL: production `/webhook/pline-v3-test-ai-agent`
- FIX-07 evidence: n8n workflow published and Worker version `19c6ece9-5d6f-4b62-a4fd-060c22c26f12` deployed
- LINE app target: `菲比智能客服 測試_03`
- Wrangler tail: readable

Gate 1 run 1 sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 run 1 observed:

- LINE event=1: yes
- Worker invocation=1: yes
- Worker version: `19c6ece9-5d6f-4b62-a4fd-060c22c26f12`
- Worker invocation outcome: `canceled`
- Worker response status: not available
- LINE reply=1: no
- n8n execution=1: not proven
- AI Agent execution=1: not proven
- intent=`idea_create`: not proven
- tool_called=`idea_create`: not proven
- data record=1: not proven

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must repair the live Worker timeout/cancellation path, likely by preventing LINE webhook handling from waiting on slow n8n execution or by adding no-secret stage logs to identify the exact stalled step.
```

## FIX-08 Repair Result

Date: 2026-07-18

- Root cause: live LINE webhook synchronously waited for n8n/AI processing before LINE reply, and the Worker invocation was canceled before a response completed.
- Repair: Worker now uses `fast_ack_then_background_n8n`.
- LINE reply path: after signature/admin/idempotency pass, Worker sends a fast ACK through LINE Reply API.
- n8n path: production webhook processing runs in `ctx.waitUntil(...)` with no-secret background stage logs.
- Path B final path: `codex_task` sends a background LINE Push API final reply after n8n contract validation.
- Worker version: `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`
- Worker `/health`: reachable, required env flags true, production n8n webhook URL, `line_reply_mode`, and `codex_task_final_mode` confirmed.
- Required secret names: present by name only.
- KV bindings: `_03` TEST `RUNTIME_KV` and `IDEMPOTENCY_KV` confirmed.
- Wrangler tail/logs: readable.
- n8n production webhook path: registered for POST.

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must rerun Gate 1 three consecutive idea_create runs and then Gate 2 using Computer Use to operate the LINE app. TEST should verify both the fast LINE reply and the background n8n completion evidence.
```

## TEST-05 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable, required env flags true
- Worker `/health` n8n URL: production `/webhook/pline-v3-test-ai-agent`
- Worker `/health` line reply mode: `fast_ack_then_background_n8n`
- Worker `/health` codex task final mode: `background_push_final`
- FIX-08 evidence: Worker version `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48` deployed
- LINE app target: `菲比智能客服 測試_03`
- Wrangler tail: readable

Gate 1 run 1 sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 run 1 observed:

- LINE event=1: yes
- Worker invocation=1: yes
- Worker version: `cf29a8be-55d6-4462-8edb-ae1a1a3ffa48`
- signature PASS: yes
- admin PASS: yes
- idempotency PASS: yes
- fast ACK LINE reply: failed
- failure stage: `line_fast_reply_failed`
- failure reason: `line_reply_http_401`
- Worker response: `502`
- LINE reply=1: no
- n8n execution=1: no; background n8n did not start after fast reply failure
- AI Agent execution=1: no
- intent=`idea_create`: not proven
- tool_called=`idea_create`: not proven
- data record=1: not proven

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must repair the _03 LINE Reply API authorization/channel token path causing line_reply_http_401, then return to TEST for Gate 1/Gate 2.
```

## FIX-09 Repair Result

Date: 2026-07-18

- Root cause: Worker Reply API code path was correct, but deployed `LINE_CHANNEL_ACCESS_TOKEN` was invalid, stale, or not the current `_03` Messaging API token.
- Channel confirmation: LINE Developers channel `菲比智能客服 測試_03`, channel id `2010748091`, not `_02`.
- Token validation: current `_03` Messaging API token returned HTTP `200` from LINE API `/v2/bot/info`.
- Secret repair: Cloudflare Worker secret `LINE_CHANNEL_ACCESS_TOKEN` updated by name only; token value not recorded.
- Code hardening: Worker trims access token secret value and avoids accidental `Bearer Bearer ...` authorization headers.
- Worker unit coverage: LINE Reply API endpoint, authorization header, content type, and JSON body verified.
- Worker version: `97f20405-6ed9-4cfb-801d-218ae1f21c61`
- Worker `/health`: reachable, required env flags true, production n8n webhook URL, `line_reply_mode`, and `codex_task_final_mode` confirmed.
- Required secret names: present by name only.
- KV bindings: `_03` TEST `RUNTIME_KV` and `IDEMPOTENCY_KV` confirmed.
- Wrangler tail/logs: readable.

Gate result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
TEST must rerun Gate 1 three consecutive idea_create runs and then Gate 2 using Computer Use to operate the LINE app.
```

## Latest Handoff After FIX-15

Date: 2026-07-18

- Latest deployed Worker version: `5a41bd15-789f-43ce-9bd0-2365d9dcef21`.
- Durable evidence repair is documented in `FIX_EVIDENCE_FIX_15.md`.
- Gate PASS is still not marked by FIX.
- TEST should rerun Gate 1 three consecutive idea_create runs and Gate 2.
- If live tail misses any run, query durable evidence by marker:

```text
GET /test/evidence?marker=<T-code>
```

## Latest Handoff After FIX-16

Date: 2026-07-18

- Latest deployed Worker version: `8a23d5c0-e014-4cbd-b594-9f7814eeb6c1`.
- Durable evidence repair/readback is documented in `FIX_EVIDENCE_FIX_16.md`.
- TEST-12 marker `T1201-20260718053133` was found in remote KV and via protected HTTP readback.
- Gate PASS is still not marked by FIX.
- TEST should rerun Gate 1 three consecutive idea_create runs and Gate 2.
- If using Wrangler KV fallback, always use `--remote`:

```text
npx wrangler kv key get 'evidence:v1:marker:<T-code>' --namespace-id 10cdfe018b3942b483faeaca6e517ae5 --remote
npx wrangler kv key list --namespace-id 10cdfe018b3942b483faeaca6e517ae5 --prefix 'evidence:v1:request:<request_id>:stage:' --remote
```

## TEST-12 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable
- Worker required env flags: true
- Worker evidence block: present with `RUNTIME_KV`, prefix `evidence:v1`, read path `/test/evidence`, and guard header `x-pline-v3-shared-secret`
- Worker line reply mode: `fast_ack_then_background_n8n`
- Worker codex task final mode: `background_push_final`
- FIX-15 Worker version: `5a41bd15-789f-43ce-9bd0-2365d9dcef21`
- FIX-15 source/config evidence: marker-first persistence and deterministic request stage keys
- KV fallback namespace: `pline-v3-test-runtime` id `10cdfe018b3942b483faeaca6e517ae5`
- LINE app target: `菲比智能客服 測試_03`

Gate 1 run 1 sent:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Gate 1 observed:

- LINE reply=1: yes, visible fast ACK in LINE app
- Durable marker evidence: not present
- KV marker `evidence:v1:marker:T1201-20260718053133`: `Value not found`
- KV marker prefix `evidence:v1:marker:T1201`: empty
- KV request stage prefix `evidence:v1:request:`: no matching stage records found
- LINE event=1: not proven by durable evidence
- Worker invocation=1: not proven by durable evidence
- signature PASS: not proven by durable evidence
- admin PASS: not proven by durable evidence
- idempotency PASS: not proven by durable evidence
- n8n execution/background completed=1: not proven by durable evidence
- intent=`idea_create`: not proven by durable evidence
- tool_called=`idea_create`: not proven by durable evidence
- data record=1: not proven by durable evidence
- Codex task=0: not proven by durable evidence

Gate 2:

- Not executed because Gate 1 run 1 could not be marked PASS under the durable evidence requirement.

Result:

```text
N8N MINIMAL PATH PASS: not marked
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must inspect why the deployed FIX-15 Worker can produce a visible LINE fast ACK while `_03` RUNTIME_KV still has no `evidence:v1` marker or deterministic request stage records for the Gate marker.
```

## TEST-13 Live Gate Attempt

Date: 2026-07-18

Authorization:

```text
菲比授權 Codex 使用 Computer Use 操控已登入 LINE app，不再要求菲比手動傳 Gate 訊息。
```

Pre-Gate live readiness:

- Worker `/health`: reachable
- Worker required env flags: true
- Worker evidence block: present with `RUNTIME_KV`, prefix `evidence:v1`, read path `/test/evidence`, and selfcheck path `/test/evidence/selfcheck`
- Worker health reports `runtime_kv_bound=true`, `idempotency_kv_bound=true`, and `selfcheck_secret_configured=true`
- FIX-16 Worker version: `8a23d5c0-e014-4cbd-b594-9f7814eeb6c1`
- Remote KV fallback confirmed with `--remote`
- LINE app target: `菲比智能客服 測試_03`

Gate 1:

```text
N8N MINIMAL PATH PASS
```

Successful runs:

- `T1301-20260718054524`: remote marker/stage evidence PASS; `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, `codex_task=0`
- `T1302-20260718054632`: remote marker/stage evidence PASS; `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, `codex_task=0`
- `T1303-20260718054707`: remote marker/stage evidence PASS; `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, `codex_task=0`

Gate 2:

Message:

```text
請 Codex 在 _03 專案建立測試檔案 T1304-20260718054759
```

Passed evidence:

- LINE event / Worker foreground stages: proven by remote marker/stage evidence
- n8n execution/background completed: proven
- intent=`codex_task`: yes
- tool_called=`codex_task`: yes
- codex task=1: yes
- action=`create_smoke_file`: yes
- task_id_present=true: yes
- LINE final=1: yes, `line_push_final_completed`

Missing evidence:

- monitor claim=1: not proven
- Codex execution=1: not proven
- live smoke-file creation: not proven
- `codex-smoke.txt` existed before Gate 2 and still had unchanged mtime `2026-07-18 03:39:02`, so it is not counted as live Gate 2 creation evidence.

Result:

```text
CODEX MINIMAL PATH PASS: not marked
_03 MINIMAL DUAL-PATH PASS: not marked
```

Required next step:

```text
FIX must add or connect `_03` TEST monitor claim / Codex execution evidence for `codex_task`, so Gate 2 can prove monitor claim=1, Codex execution=1, and live smoke-file creation instead of relying on a preexisting local file.
```

## Latest Handoff After FIX-17

Date: 2026-07-18

- Gate 1 is already PASS from TEST-13:

```text
N8N MINIMAL PATH PASS
```

- Latest deployed Worker version: `8fedf73f-c983-43af-832b-96e9f0e957c9`.
- Monitor now claims `codex_task:v1:task:<task_id>` from `_03` remote KV.
- TEST should rerun Gate 2 only.
- Before Gate 2 send, start or confirm monitor poll:

```text
node monitor/src/monitor.js poll
```

- Gate 2 durable evidence should include:
  - `codex_task_enqueued`
  - `monitor_claimed`
  - `codex_execution_completed`
  - `smoke_file_written`
  - `line_push_final_completed`
- Smoke file evidence must show mtime newer than Gate 2 precheck and content exactly:

```text
Codex 已打通
```

## RELEASE-01 Completion

Date: 2026-07-18

Final TEST result:

```text
N8N MINIMAL PATH PASS
CODEX MINIMAL PATH PASS
_03 MINIMAL DUAL-PATH PASS
PLine03 _03 TEST PROJECT COMPLETE
```

Closeout readbacks:

- Worker `/health`: reachable; required env flags true; `runtime_kv_bound=true`; `idempotency_kv_bound=true`; latest 100% deployment version `8fedf73f-c983-43af-832b-96e9f0e957c9`.
- n8n workflow `kcMcBQos5cxsnWU1`: local no-secret draft records `published=true`; production webhook route returned HTTP `200` to a no-secret RELEASE probe.
- LINE TEST webhook target: `https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook`; invalid-signature route readback returned HTTP `401`.
- Monitor: health `ready`; Gate 2 remote evidence includes `monitor_claimed`, `codex_execution_completed`, `smoke_file_written`, and `line_push_final_completed`.
- `codex-smoke.txt`: mtime `2026-07-18 06:03:46 CST`; content `Codex 已打通`.
- Evidence: `RELEASE_EVIDENCE_RELEASE_01.md`.

No further TEST Gate message is required for RELEASE-01.

## Dropbox Idea JSON Gate Attempt

Date: 2026-07-18

- Formal test messages:
  - `T1801-20260718080448`
  - `T1802-20260718080635`
  - `T1803-20260718080827`
- Dropbox JSON written for each formal attempt:
  - `idea-20260718-080456-e4722723e9e6.json`
  - `idea-20260718-080643-44455ed5b925.json`
  - `idea-20260718-080836-f137480285ba.json`
- JSON parse/schema/fingerprint checks: PASS
- Duplicate reprocess: PASS, JSON count stayed `8 -> 8`, result `duplicate`
- Missing Gate evidence: `idea_json_final_push_completed`

Result:

```text
DROPBOX IDEA JSON PATH PASS: not marked
```

Required next step:

```text
FIX must ensure the formal LINE success final is emitted and persisted exactly once after JSON save/duplicate.
```

## Dropbox Idea JSON Gate Rerun After Final Reply Fix

Date: 2026-07-18

Scope:

- `_03` project only.
- Fixed Dropbox directory only: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- No Git execution.
- No secret/raw User ID/full payload recorded.

Continuous markers:

- `T1901-20260718082215`
- `T1902-20260718082305`
- `T1903-20260718082309`

Dropbox JSON files:

- `idea-20260718-082302-d255b4b825ef.json`
- `idea-20260718-082310-f4ec851098fd.json`
- `idea-20260718-082314-c72fb7e8e6e2.json`

Evidence:

- LINE event / Worker invocation evidence: present by marker readback.
- `signature_pass`, `admin_pass`, `idempotency_pass`: present.
- n8n background start and `idea_create` / `save_idea_json` evidence: present.
- Monitor claim and Dropbox JSON write: present.
- JSON parse/schema/content/fingerprint checks: PASS.
- Codex task: 0.
- Duplicate deterministic reprocess marker `T2099-20260718082930`: PASS, JSON count stayed `13 -> 13`.
- Missing Gate evidence: `idea_json_final_push_completed`.

Result:

```text
DROPBOX IDEA JSON PATH PASS: not marked
DROPBOX IDEA JSON PATH PARTIAL
```

Required next step:

```text
FIX must ensure the formal LINE success final is emitted and persisted exactly once after JSON save completion evidence.
```

## Dropbox Idea JSON Gate PASS After Durable Finalizer

Date: 2026-07-18

Scope:

- `_03` project only.
- Fixed Dropbox directory only: `/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03`
- No Git execution.
- No secret/raw User ID/full payload recorded.

Continuous markers:

- `T2201-20260718084633`
- `T2202-20260718084802`
- `T2203-20260718084935`

Dropbox JSON files:

- `idea-20260718-084641-1847198916c4.json`
- `idea-20260718-084810-24eb8fc7c5c5.json`
- `idea-20260718-084944-8a308a7a67f5.json`

Evidence:

- LINE event / Worker invocation evidence: present by marker readback.
- `signature_pass`, `admin_pass`, `idempotency_pass`: present.
- n8n background completed and `idea_create` / `save_idea_json` evidence: present.
- Monitor claim and Dropbox JSON write: present.
- JSON parse/schema/content/fingerprint checks: PASS.
- Formal LINE final success evidence `idea_json_final_push_completed`: PASS for all three runs.
- Codex task: 0.
- Repeated finalizer callback for `T2203-20260718084935`: PASS, result `already_completed`, `pushed=false`, JSON count stayed `20 -> 20`.
- Evidence file: `TEST_EVIDENCE_DROPBOX_IDEA_JSON.md`.

Result:

```text
DROPBOX IDEA JSON PATH PASS
```

Required next step:

```text
RELEASE must run git status, secret scan, commit, and push to v1/minimal-dual-path.
```

## IDEA NATURAL FINAL REPLY WITHOUT ACK Gate

Date: 2026-07-18

Preconditions:

- Worker version is at least `dbda345b-a3b4-41ca-bc8b-a12c8547179c`.
- `/health` reports `line_reply_mode=no_visible_ack_background_n8n`.
- Dropbox idea JSON path is already PASS.
- Monitor finalizer path `/test/idea-finalize` remains ready.

Expected live behavior for each idea_create event:

- LINE app shows no first processing ACK.
- Worker returns HTTP `200` to the webhook.
- Durable evidence includes `line_visible_ack_skipped`.
- Durable evidence includes `webhook_http_200_returned`.
- Durable evidence must not count `line_fast_reply_completed` for idea_create.
- Monitor writes one Dropbox idea JSON file after `save_idea_json`.
- Worker sends exactly one natural final LINE message after JSON save.
- Durable evidence includes `idea_json_final_push_completed`.
- Final text must not expose internal words such as `_03`, `TEST`, n8n, Worker, task, JSON, execution, or webhook.

Duplicate/repeated callback expectation:

- No new Dropbox JSON file.
- No second LINE final.
- Durable evidence records suppression or already-completed behavior.

Failure expectation:

- If save fails, Worker must not send saved-success text.
- Failure final should truthfully say the save did not complete.

## Codex Task Minimal Closed Loop Gate

Date: 2026-07-18

Preconditions:

- Worker version is at least `3f0f167c-71b1-4e89-aa1c-6f559507ed46`.
- `/health` reports `codex_task_final_mode=monitor_callback_exactly_once`.
- `/health` reports `codex_finalizer.path=/test/codex-finalize`.
- Monitor health reports `ready`.
- Monitor smoke path is `/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt`.
- Monitor smoke content is `Codex 任務測試成功`.

Expected live behavior:

- A natural-language LINE command is classified by n8n as `codex_task`.
- Worker creates one structured queued task with the same `task_id` throughout lifecycle.
- Worker sends one processing notice only after enqueue succeeds.
- Monitor claims the queued task.
- Monitor writes and reads back the fixed smoke file.
- Monitor writes `codex_task:v1:result:<task_id>`.
- Worker receives `/test/codex-finalize` callback and sends one natural completed final.

Required result record:

```json
{
  "task_id": "<same task id>",
  "status": "completed",
  "summary": "<completed summary>",
  "tests": "PASS",
  "changed_files": ["runtime/codex-task-smoke/codex_task_smoke_test.txt"],
  "commit": null,
  "error": null
}
```

Required evidence stages:

- `codex_task_enqueued`
- `codex_task_processing_notice_completed`
- `monitor_claimed`
- `codex_execution_completed`
- `smoke_file_written`
- `codex_task_result_recorded`
- `codex_task_final_callback_completed`
- `codex_task_final_push_completed`

Failure expectations:

- Failed task must write failed result and must not report completed.
- Failed final text must be truthful and must not claim success.

Duplicate/replay expectations:

- Same task must not be re-executed.
- Same task must not create a second final push.
- Evidence should show suppression or already-completed behavior.

Regression expectations:

- idea_create natural final without visible ACK remains PASS.
- Dropbox idea JSON schema/save/duplicate remains PASS.

## Codex Task created_at Schema Recheck

Date: 2026-07-18

Gate rerun must confirm:

- `codex_task:v1:task:<task_id>` has `created_at` when queued.
- The same task record keeps `created_at` after claimed/running.
- The same task record keeps `created_at` after completed.
- Failed codex_task records keep `created_at`.
- `codex_task:v1:result:<task_id>` includes `created_at`.
- Completed result still has:
  - `status=completed`
  - `tests=PASS`
  - `commit=null`
  - `error=null`
- Failed result must not claim completed.

No behavior should change for:

- Smoke file path/content.
- LINE processing notice/final text.
- Finalizer exactly-once.
- Duplicate/replay suppression.
- idea_create natural final.
- Dropbox idea JSON schema/save/duplicate.

### TEST Result 2026-07-18

Live markers:

- `T2301-20260718092056`
- `T2302-20260718092156`
- `T2303-20260718092325`

Evidence summary:

- `line_visible_ack_skipped`: PASS for all three.
- `webhook_http_200_returned`: PASS for all three.
- n8n background completed: PASS for all three.
- Dropbox JSON parse/schema/content/fingerprint: PASS for all three.
- `idea_json_final_push_completed`: PASS for all three after retry on the third.
- Repeated finalizer callback: PASS, `already_completed`, `pushed=false`.
- Failure and AI fallback mocks: PASS.
- Codex regression marker `T2390-20260718092857`: PASS.
- Effective secret scan hit_count: `0`.
- LINE desktop read-receipt display: UI/OA setting observation only.

```text
IDEA NATURAL FINAL REPLY WITHOUT ACK PASS
```

Evidence: `TEST_EVIDENCE_IDEA_NATURAL_FINAL_NO_ACK.md`.

## Codex Task Minimal Closed Loop Gate Result

Date: 2026-07-18

- Live marker: `T2401-20260718113100`.
- Task ID: `pline-v3-codex-1784345467797`.
- Classification: `codex_task`.
- Monitor claim / execution / smoke file write: PASS.
- Runtime smoke content: `Codex 任務測試成功`.
- Result record: `status=completed`, `tests=PASS`, `commit=null`, `error=null`.
- LINE natural processing and final: PASS.
- Repeated callback: PASS, no duplicate final.
- Failure, idea_create, Dropbox, and natural reply regressions: PASS.
- Secret scan effective hit_count: `0`.
- Blocking failure: completed task record missing required `created_at`.

```text
Gate result: FAILED
```

Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

## Codex Task Minimal Closed Loop Gate Rerun Result

Date: 2026-07-18

- Live marker: `T2501-20260718114510`.
- Task ID: `pline-v3-codex-1784346318391`.
- Classification: `codex_task`.
- Monitor claim / execution / smoke file write: PASS.
- Runtime smoke content: `Codex 任務測試成功`.
- Completed task record includes `created_at`: PASS.
- Result record includes `created_at`, `status=completed`, `tests=PASS`, `commit=null`, `error=null`: PASS.
- LINE natural processing and final: PASS.
- Repeated callback: PASS, no duplicate final.
- Failure, idea_create, Dropbox, and natural reply regressions: PASS.
- Secret scan effective hit_count: `0`.

```text
Gate result: PASS
```

Evidence: `TEST_EVIDENCE_CODEX_TASK_MINIMAL_CLOSED_LOOP.md`.

## Codex Task created_at Schema FIX Handoff

Date: 2026-07-18

- FIX repaired monitor lifecycle schema preservation.
- Rerun live Codex Task Gate and confirm:
  - completed `codex_task:v1:task:<task_id>` includes `created_at`
  - `codex_task:v1:result:<task_id>` includes matching `created_at`
  - same `task_id` is preserved through lifecycle
  - smoke file, natural LINE processing/final, repeated callback, failed path, idea_create, and Dropbox regressions remain PASS

Evidence for FIX readiness: `FIX_EVIDENCE_CODEX_TASK_CREATED_AT_SCHEMA.md`.

## Codex Task AI Replies Gate: N8N Prerequisite

Date: 2026-07-18

FIX phase-1 trace found the Gate cannot be truthfully passed by Worker/monitor alone.

Before TEST can run the AI reply Gate, N8N must provide a phase-aware codex_task AI reply contract:

- input `intent=codex_task`
- input `phase=processing|completed|failed`
- input sanitized original user instruction
- input task summary
- input public project name
- input actual result for completed/failed phase
- input actual status
- output `reply_text`
- output `reply_source=ai_generated|fallback`

TEST Gate must later verify:

- processing does not claim completion
- completed reflects actual result
- failed does not pretend success
- normal cases primarily show `reply_source=ai_generated`
- forced fallback shows `reply_source=fallback`
- user-visible text contains no task id, local absolute path, branch, commit hash, n8n, Worker, JSON, execution, stack trace, internal node names, secrets, or tokens
- A/B/C/D codex_task variants are covered after N8N and FIX wiring

Evidence for phase-1 trace: `FIX_EVIDENCE_CODEX_TASK_AI_REPLIES.md`.

## Live Regression Diagnostic: 1153 / Codex Pending / LINE Read

Date: 2026-07-18

No new LINE message was sent for this diagnostic. TEST used existing no-secret remote KV evidence, monitor health, Worker health, and fixed Dropbox directory readback.

1153 idea_create result:

- Worker invocation: PASS
- signature/admin/idempotency: PASS
- webhook HTTP `200`: PASS
- visible ACK skipped: PASS, by current reply mode
- n8n completion: PASS
- `intent=idea_create`: PASS
- `tool_called=idea_create`: PASS
- `save_idea_json` enqueue: PASS
- monitor claim: FAIL, missing
- Dropbox JSON attribution: FAIL, missing
- final push: FAIL, missing

Codex pending result:

- Worker invocation: PASS
- signature/admin/idempotency: PASS
- webhook HTTP `200`: PASS
- n8n completion: PASS
- `intent=codex_task`: PASS
- processing notice: PASS
- remote task enqueue: PASS
- monitor claim/result/finalizer: FAIL, missing
- capability validation: FAIL, browser/Computer Use request was not yet enabled in this Gate but was accepted as fixed smoke action `create_smoke_file`.

LINE read observation:

- LINE desktop `已讀` is not a backend Gate signal.
- Keep it separate from webhook HTTP `200`, final push, and Dropbox persistence.
- Investigate `_03` LINE Developers / LINE OA Manager read-receipt or chat-mode settings separately if needed.

Required next step:

```text
FIX: make live monitor processing durable/always-on or add Worker-side timeout/failure final for unclaimed tasks; mark capabilities that are not enabled in this Gate as `capability_not_yet_enabled` instead of leaving them processing or converting them into smoke success.
```

Evidence: `TEST_EVIDENCE_LIVE_REGRESSION_1153_CODEX_PENDING_READ.md`.

## Live Pending Monitor / Capability Boundary Regression

Date: 2026-07-18

TEST should verify after Worker version `493e4b8a-91da-479e-81e0-229fd1eb72c7`:

- Existing request `pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R` has `monitor_claimed`, `idea_json_file_written`, `idea_json_final_callback_completed`, and `idea_json_final_push_completed`.
- Existing request `pline-v3-01KXSP35BTPS6GH5VM25JF9BJV` has `codex_task_capability_not_enabled`, failed result `error=capability_not_yet_enabled`, and final failure/capability notice evidence.
- Browser/Computer Use capability is not permanently rejected; it is simply not enabled in this Gate.
- New not-yet-enabled codex_task capabilities must not enqueue `create_smoke_file`, must not send a processing notice, and must not remain queued/pending.
- Fixed smoke codex_task must still execute and final exactly-once.
- idea_create, Dropbox JSON, duplicate, idempotency, admin allowlist, webhook HTTP `200`, and invalid-signature `401` regressions remain PASS.

Evidence for FIX readiness: `FIX_EVIDENCE_LIVE_REGRESSION_PENDING_CAPABILITY.md`.

## Worker N8N URL Attribution Regression

Date: 2026-07-18

FIX result after Worker version `d50b4501-2244-4a31-9951-f7289ca06f09`:

- Live `/health` must show n8n route type `production` and path `/webhook/pline-v3-test-ai-agent`.
- `n8n_background_started` evidence must include no-secret host/path/route/path fingerprint.
- Worker accepts `worker_request_id` and `canonicalRequestId` as canonical request id fields.
- Worker unwraps common n8n wrappers before contract validation.
- Live marker `T2606-20260718134903` still failed because n8n production returned an empty response object.

Blocked TEST condition:

- Do not rerun idea_create Gate as PASS until N8N repairs production Respond-to-Webhook output to include canonical request id, intent, reply text, status, and tool evidence.

Evidence: `FIX_EVIDENCE_WORKER_N8N_URL_ATTRIBUTION.md`.

## Computer Use open_browser_page Gate

Date: 2026-07-18

Current status: blocked before implementation.

TEST must not run this Gate until a real Codex/Computer Use bridge is available to `_03` monitor or controller.

Required future acceptance:

- LINE request is classified as codex_task with capability `open_browser_page`.
- The execution is performed by an explicitly authorized Codex/Computer Use bridge, not shell `open`.
- First Gate URL allowlist is only `about:blank` or `https://example.com/`.
- Duplicate/retry does not open extra pages or send duplicate finals.
- User-visible messages contain no internal terms.
- Existing idea_create, Dropbox JSON, n8n hardening, Codex smoke, idempotency, admin allowlist, and webhook HTTP 200 regressions remain PASS.

Blocked reason: `monitor_unable_to_call_codex_computer_use_tools`.

Evidence: `FIX_EVIDENCE_COMPUTER_USE_OPEN_BROWSER_PAGE.md`.

### TEST Recovery Readback Result

Date: 2026-07-18

FIX handoff version:

```text
493e4b8a-91da-479e-81e0-229fd1eb72c7
```

1153 idea request:

- Request id: `pline-v3-01KXSNQFMVYQTAK12PGGCPZQ4R`
- Task id: `idea-8748409c3efdcc4f5363d2eb`
- Task status: `completed`
- `monitor_claimed`: PASS
- `idea_json_file_written`: PASS
- `idea_json_final_push_completed`: PASS
- `idea_json_final_callback_completed`: PASS
- Dropbox JSON: `idea-20260718-115346-8748409c3efd.json`
- JSON parse/schema/content/raw-ID checks: PASS

Open-webpage Codex request:

- Request id: `pline-v3-01KXSP35BTPS6GH5VM25JF9BJV`
- Task id: `pline-v3-codex-1784347208503`
- Task status: `failed`
- Reason: `capability_not_yet_enabled`
- Result changed files: `0`
- Final state: `failure_notice_completed`
- Arbitrary Computer Use/browser action: not executed
- Smoke-file success for this request: absent

Minimal regression:

- Worker tests: PASS
- Monitor tests: PASS
- idea_create / Dropbox / Codex smoke / duplicate / idempotency / capability guard: PASS through existing focused tests

LINE read observation:

- `已讀` remains a separate LINE desktop / LINE Developers / LINE OA Manager setting observation and is not a backend blocker.

Supplemental 12:53 idea case:

- Request id: `pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF`
- Worker invocation: PASS
- signature/admin/idempotency: PASS
- webhook HTTP `200`: PASS
- n8n started: PASS
- n8n completed: FAIL
- Failure stage: `n8n_background_contract_failed`
- Failure reason: `request_id_mismatch`
- `save_idea_json` enqueue: absent
- monitor claim: absent
- Dropbox JSON for the water reminder: absent
- final push: absent
- Root cause classification: not the same as the original `1153` monitor-pending case; this fails before monitor can recover it.

```text
LIVE REGRESSION RECOVERY PARTIAL
```

Evidence: `TEST_EVIDENCE_LIVE_REGRESSION_RECOVERY.md`.

Required next step:

```text
N8N/FIX repairs the live idea_create request_id_mismatch recurrence, then FIX opens next Gate: Computer Use minimal enablement, only allowing open_browser_page.
```

## N8N request_id Recurrence Repair Live Verification

Date: 2026-07-18

Live message:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Result:

- Marker: `T2601-20260718131959`
- Request id: `pline-v3-01KXSTP8HJ3AF374NNY5W6KV86`
- Worker invocation: PASS
- signature/admin/idempotency: PASS
- webhook HTTP `200`: PASS
- visible ACK skipped: PASS
- n8n started: PASS
- n8n completed: FAIL
- Failure stage: `n8n_background_contract_failed`
- Failure reason: `request_id_mismatch`
- `intent=idea_create`: absent
- `tool_called=idea_create`: absent
- `save_idea_json` enqueue: absent
- monitor claim: absent
- Dropbox JSON: absent
- natural final reply: absent

Minimal regression:

- Worker tests: PASS
- Monitor tests: PASS
- Codex capability guard: covered and PASS
- idea_create / Dropbox / duplicate / idempotency: covered by focused local tests

```text
N8N REQUEST_ID RECURRENCE REPAIR LIVE VERIFY FAILED
```

Evidence: `TEST_EVIDENCE_N8N_REQUEST_ID_RECURRENCE_REPAIR.md`.

Required next step:

```text
N8N/FIX inspects live production execution for pline-v3-01KXSTP8HJ3AF374NNY5W6KV86 and repairs the production response contract before the Computer Use minimal Gate opens.
```

## N8N Respond Nonempty Live idea_create Verification

Date: 2026-07-18

Live message:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Result:

- Marker: `T2701-20260718140429`
- Request id: `pline-v3-01KXSX7E4SRVM7CVZ3ST40GA6X`
- Worker invocation: PASS
- signature/admin/idempotency: PASS
- webhook HTTP `200`: PASS
- visible ACK skipped: PASS
- n8n started: PASS
- n8n completed: PASS
- `request_id_mismatch`: absent
- `intent=idea_create`: PASS
- `tool_called=idea_create`: PASS
- `saved_record=1`: PASS
- `save_idea_json` enqueue: PASS
- monitor claim: PASS
- Dropbox JSON: `idea-20260718-140449-c49d33a39125.json`
- Dropbox parse/schema/content/raw-ID checks: PASS
- natural final durable evidence: PASS, `idea_json_final_push_completed`
- LINE UI observation: accessibility changed but did not expose readable bot final text; durable final evidence is primary

Minimal regression:

- Worker tests: PASS
- Monitor tests: PASS
- Codex capability guard: covered and PASS
- idea_create / Dropbox / duplicate / idempotency: covered by focused local tests

```text
N8N RESPOND NONEMPTY LIVE IDEA_CREATE PASS
```

Evidence: `TEST_EVIDENCE_N8N_RESPOND_NONEMPTY_LIVE_IDEA.md`.

Required next step:

```text
FIX/N8N hardens n8n-side shared-secret enforcement for the production webhook, then TEST can continue toward the Computer Use minimal Gate.
```

## n8n Shared-Secret Hardening TEST

Date: 2026-07-18

Direct no-header barrier:

- Production n8n webhook direct probe without `x-pline-v3-shared-secret`: executed
- HTTP status: `200`
- Body: empty/non-JSON
- Normal `idea_create` contract: absent
- `intent=idea_create`: absent
- `tool_called=idea_create`: absent
- `saved_record`: absent
- Result: PASS

Worker/header live idea_create:

- Live message: `記一下：[REDACTED_IDEA_CONTENT]`
- Marker: `T2801-20260718141551`
- Request id: `pline-v3-01KXSXWXAE94G82MCZEYQABCJ7`
- Worker invocation: PASS
- signature/admin/idempotency: PASS
- webhook HTTP `200`: PASS
- visible ACK skipped: PASS
- n8n completed: PASS
- `request_id_mismatch`: absent
- `intent=idea_create`: PASS
- `tool_called=idea_create`: PASS
- `saved_record=1`: PASS
- `save_idea_json` enqueue: PASS
- monitor claim: PASS
- Dropbox JSON: `idea-20260718-141633-a223c8a90177.json`
- Dropbox parse/schema/content/raw-ID checks: PASS
- natural final durable evidence: PASS, `idea_json_final_push_completed`

Minimal regression:

- Worker tests: PASS
- Monitor tests: PASS
- Codex capability guard: covered and PASS
- idea_create / Dropbox / duplicate / idempotency: covered by focused local tests

Residual risk:

- n8n variable creation is disabled, so full shared-secret value comparison remains pending.
- Current no-header barrier and Worker/header live path both pass.

```text
N8N SHARED-SECRET HARDENING TEST PASS
```

Evidence: `TEST_EVIDENCE_N8N_SHARED_SECRET_HARDENING.md`.

Required next step:

```text
FIX opens next Gate: Computer Use minimal enablement, only allowing open_browser_page.
```

## Live Regression 1503cc No Reply

Date: 2026-07-18

Field report:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Diagnosis result:

- Request id: `pline-v3-01KXT0JM1YHRN0W22P7C147AJW`
- Marker: absent
- Worker invocation: PASS
- signature/admin/idempotency: PASS
- webhook HTTP `200`: PASS
- visible ACK skipped: PASS
- n8n started: PASS
- n8n completed: PASS
- `request_id_mismatch`: absent
- `intent=idea_create`: PASS
- `tool_called=idea_create`: PASS
- `saved_record=1`: PASS
- `save_idea_json` enqueue: PASS
- Task id: `idea-82487259686e7b01ced7621a`
- Task status: `pending`
- monitor claim: FAIL, absent
- Dropbox JSON: FAIL, absent
- final push: FAIL, absent

Root-cause class:

- Same as original `1153` pending-monitor case.
- Not the T2601 / 12:53 `request_id_mismatch` class.
- T2701/T2801 passed when TEST had monitor poll running before live message.

LINE read observation:

- Some earlier appshot messages showed gray `已讀`.
- Latest 15:03 message did not stably show `已讀`.
- Read-state remains a LINE desktop/OA setting observation only.

```text
LIVE REGRESSION 1503CC NO REPLY FAILED
```

Evidence: `TEST_EVIDENCE_LIVE_REGRESSION_1503CC_NO_REPLY.md`.

Required next step:

```text
FIX provides durable always-on monitor/queue processing or Worker-side timeout/failure final for pending save_idea_json tasks.
```

## Durable Monitor Runner Live Gate

Date: 2026-07-18

Preconditions:

- launchd runner `com.pline.v3.test.codex-monitor`: running
- heartbeat before live message: `ready`
- manual `monitor poll/claim-task/drain`: not run
- baseline idea pending count: `1`, stale completed pending key existed

Live message:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Result:

- T-code: `T2901-20260718152036`
- Request id: `pline-v3-01KXT1KRBW5MSP8WDT9QR2A3Y4`
- Worker invocation: PASS
- signature/admin/idempotency: PASS
- webhook HTTP `200`: PASS
- visible ACK skipped: PASS
- n8n started/completed: PASS
- `request_id_mismatch`: absent
- `intent=idea_create`: PASS
- `tool_called=idea_create`: PASS
- `saved_record=1`: PASS
- pending index created: PASS
- pending index removed: FAIL
- Task id: `idea-4a47aede9a419394a2967bd0`
- Task status: `pending`
- monitor claim by launchd runner: FAIL, absent
- Dropbox JSON: FAIL, absent
- final push: FAIL, absent
- heartbeat after wait: `error`
- remaining idea pending count: `2`

1503 recovery:

- File: `idea-20260718-150321-82487259686e.json`
- Exact file count: `1`
- Parse/schema/raw-ID checks: PASS
- Duplicate recovery file: absent

Minimal regression:

- Worker tests: PASS
- Monitor tests: PASS
- Codex capability guard: covered and PASS

```text
DURABLE MONITOR RUNNER LIVE IDEA_CREATE FAILED
```

Evidence: `TEST_EVIDENCE_DURABLE_MONITOR_RUNNER_LIVE.md`.

Required next step:

```text
FIX repairs stale completed pending-key cleanup and runner error handling so one bad pending key does not block later tasks.
```

## Durable Monitor Runner Second Live Gate

Date: 2026-07-18

Preconditions:

- launchd runner `com.pline.v3.test.codex-monitor`: running
- heartbeat before live message: `ready`
- manual `monitor poll/claim-task/drain`: not run
- baseline idea pending count: `0`
- baseline codex pending count: `0`

Live message:

```text
記一下：[REDACTED_IDEA_CONTENT]
```

Result:

- T-code: `T2902-20260718153255`
- Request id: `pline-v3-01KXT29N4CBP3J3AVDVKSDKZ91`
- Worker invocation: PASS
- signature/admin/idempotency: PASS
- webhook HTTP `200`: PASS
- visible ACK skipped: PASS
- n8n started/completed: PASS
- `request_id_mismatch`: absent
- `intent=idea_create`: PASS
- `tool_called=idea_create`: PASS
- `saved_record=1`: PASS
- pending index created: PASS
- pending index removed: PASS
- Task id: `idea-ef60f64a6f511ce02c065eaa`
- Task status: `completed`
- monitor claim by launchd runner: PASS
- Dropbox JSON: `idea-20260718-153325-ef60f64a6f51.json`
- Dropbox parse/schema/content/raw-ID checks: PASS
- final push: PASS
- heartbeat after completion: `ready`
- remaining idea pending count: `0`
- remaining codex pending count: `0`

Duplicate checks:

- 1503 recovery file exact count: `1`
- T2901 recovery file exact count: `1`
- T2902 file exact count: `1`

Minimal regression:

- Worker tests: PASS
- Monitor tests: PASS
- Codex capability guard: covered and PASS
- Unsafe Computer Use open-webpage: not run

```text
DURABLE MONITOR RUNNER SECOND LIVE IDEA_CREATE PASS
```

Evidence: `TEST_EVIDENCE_DURABLE_MONITOR_RUNNER_SECOND_LIVE.md`.

Required next step:

```text
RELEASE performs git status, secret scan, commit, and push if controller is ready to close this TEST scope.
```

## N8N Live Production Path Follow-Up

Date: 2026-07-18

N8N follow-up checked only workflow `kcMcBQos5cxsnWU1`:

- UI status: active/published.
- Production webhook path: `/webhook/pline-v3-test-ai-agent`.
- Current `Structured Output`: preserves canonical request id with `canonicalRequestId` / `worker_request_id`.
- Current `Structured Output`: does not use `parsed.request_id`.
- Current `Respond to Webhook`: JSON response body expression `{{ $json }}`.
- Local draft harness for T2601 request id: PASS.
- Workflow execution attribution: not confirmed, because the target workflow `Executions` tab showed `No executions found`.

TEST/FIX must not mark live PASS from synthetic evidence alone. Before Computer Use minimal Gate, rerun a fresh T260x idea_create only after confirming live Worker `N8N_WEBHOOK_URL` targets `/webhook/pline-v3-test-ai-agent` and execution attribution is visible or otherwise auditable.

## N8N Respond-to-Webhook Nonempty Production Repair

Date: 2026-07-18

N8N repaired workflow `kcMcBQos5cxsnWU1`:

- Published version: `N8N normalize env and respond nonempty repair`.
- `Normalize Input`: no direct `$env.N8N_SHARED_SECRET` access; guarded `$vars.N8N_SHARED_SECRET` lookup only.
- `Respond to Webhook`: `First Incoming Item`.
- Removed custom `Response Body` expression `{{ $json }}`.
- Local draft JSON parses.
- Local first-incoming-item harness: PASS.
- Production no-secret probe: HTTP `200`, nonempty JSON, request id preserved, `intent=idea_create`, `tool_called=idea_create`, `status=completed`, `saved_record=1`.

TEST must rerun a fresh live T260x idea_create through LINE/Worker. Required result:

- no `request_id_mismatch`
- `n8n_background_completed`
- `save_idea_json` enqueue
- monitor claim
- Dropbox JSON creation
- natural final reply

Do not open Computer Use minimal Gate until this live idea_create regression passes.

## N8N Shared-Secret Header Hardening

Date: 2026-07-18

N8N updated workflow `kcMcBQos5cxsnWU1`:

- Published version: `N8N shared-secret header hardening`.
- `Normalize Input`: rejects missing `x-pline-v3-shared-secret`.
- `Normalize Input`: compares against `$vars.N8N_SHARED_SECRET` when available.
- `Normalize Input`: still avoids `$env.N8N_SHARED_SECRET`.
- `Respond to Webhook`: remains `First Incoming Item`.
- Local guard tests: PASS.
- Production direct no-header probe: did not return normal idea_create contract.
- Production synthetic header-present probe: nonempty response, request id preserved, `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`.
- Full value equality is pending because n8n `N8N_SHARED_SECRET` variable is not present and variable creation is disabled in the current n8n UI/plan.

TEST/FIX must rerun:

- direct no-secret n8n probe rejected / no normal idea_create contract
- live Worker LINE idea_create still PASS

Computer Use minimal Gate remains paused until hardening verification passes.

## N8N Request ID Recurrence Repair

- Target workflow: `kcMcBQos5cxsnWU1`
- Published n8n version: `N8N request_id recurrence repair`
- Repair: `Normalize Input` now preserves Worker original request id as `worker_request_id`; `Structured Output` uses only the Normalize canonical id and ignores AI-produced `request_id`.
- No-secret synthetic verification: an intentionally wrong AI `request_id` was ignored; output preserved `pline-v3-01KXSS4ZKDTPE9N9C9BDB1HAMF`, `intent=idea_create`, `tool_called=idea_create`, and `saved_record=1`.
- Evidence: `N8N_EVIDENCE_REQUEST_ID_CONTRACT_RECURRENCE.md`.

TEST must rerun a new safe idea_create marker before opening the Computer Use minimal-open-page Gate. Required evidence:

- Worker received/signature/admin/idempotency/webhook HTTP `200`
- n8n completed without `request_id_mismatch`
- output request id exactly equals Worker request id
- `intent=idea_create`
- `tool_called=idea_create`
- `saved_record=1` or equivalent idea contract evidence
- `save_idea_json` enqueued
- monitor claim
- Dropbox JSON creation
- natural final reply
## Durable Monitor Queue Runner Regression

For live idea_create tests, TEST no longer needs to manually start `monitor poll` before sending LINE.

Required evidence for the next live idea_create:

- Worker receives event and returns webhook HTTP 200.
- n8n completes as `intent=idea_create` and `tool_called=idea_create`.
- Worker creates `idea_json:v1:pending:<task_id>`.
- launchd monitor runner claims the task.
- Dropbox JSON is written once in the fixed `_03` Dropbox directory.
- JSON parse/schema/no raw User ID checks pass.
- Monitor callback reaches Worker finalizer.
- `idea_json_final_push_completed` is present exactly once.
- Pending queue prefix is empty after completion.

Regression checks:

- duplicate/retry does not create a second Dropbox JSON or second final.
- failed JSON write does not send success text.
- codex_task `capability_not_yet_enabled` guard remains intact.
- invalid LINE signature remains `401`.

Additional cleanup regression:

- A stale completed pending key must not block a later active pending task.
- Pending delete failure is warning-only.
- Missing or unreadable task records are warning-only and do not abort drain.
- Active idea task still completes and clears its pending index.
## LINE Mark As Read Gate

Live validation:

- Send one unique idea_create LINE message.
- Confirm Worker durable stages include `line_mark_as_read_completed`.
- If LINE desktop exposes it, confirm the user sees read state near the sent message.
- Confirm no fixed visible ACK is sent.
- Confirm final reply still arrives once after Dropbox JSON save.
- Confirm Dropbox JSON parse/schema/no raw User ID checks remain PASS.

Regression:

- No read token records `line_mark_as_read_skipped_no_token` and continues.
- Mark-as-read API failure records `line_mark_as_read_failed` but does not block webhook HTTP 200 or background processing.
- Admin failure must not call mark-as-read.
- Duplicate event must not repeat final reply.

Current `_03` TEST mode:

- OA Chat off is the primary read receipt mechanism.
- Worker mark-as-read API is disabled by default.
- Expected stage in current mode: `line_mark_as_read_skipped_disabled`.
- If `LINE_MARK_AS_READ_ENABLED === "true"` is explicitly set for future Chat-on mode, then TEST may require `line_mark_as_read_completed`.

### TEST Result: 2026-07-18 T3001

Result: `LINE MARK AS READ LIVE PARTIAL`

- T-code: `T3001-20260718155646`
- Request id: `pline-v3-01KXT3NXEQXYVE5Y52R97GQNFV`
- LINE UI: screenshot showed grey `已讀` near the latest sent message.
- Durable Mark As Read API stage: `line_mark_as_read_failed`.
- Required API stage `line_mark_as_read_completed`: not met.
- Webhook: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `webhook_http_200_returned` all present.
- Fixed ACK: absent; `line_visible_ack_skipped` present.
- idea_create regression: PASS.
- Dropbox regression: PASS; JSON parse/schema/no raw User ID checks PASS.
- Final push: PASS; `idea_json_final_push_completed` and callback completed.
- Pending queue after completion: `idea=0`, `codex=0`.
- Evidence: `TEST_EVIDENCE_LINE_MARK_AS_READ_LIVE.md`.

Next: FIX diagnoses live Mark As Read API failure. UI read observation alone is not sufficient to mark the Worker Mark As Read API path PASS.

### TEST Result: 2026-07-18 T3002

Result: `LINE READ CHAT OFF AUTO-READ T3002 PASS`

- T-code: `T3002-20260718160604`
- Request id: `pline-v3-01KXT46DF26Q4N9C4GS1B6PC58`
- Worker health: `line_mark_as_read.enabled=false`, mode `disabled_chat_off_auto_read`.
- LINE UI: follow-up screenshot showed grey `已讀` beside the latest sent message.
- Durable disabled stage: `line_mark_as_read_skipped_disabled`.
- Durable failed stage for this request: absent.
- Webhook: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `webhook_http_200_returned` all present.
- Fixed ACK: absent; `line_visible_ack_skipped` present.
- idea_create regression: PASS.
- Dropbox regression: PASS; JSON parse/schema/no raw User ID checks PASS.
- Final push: PASS; `idea_json_final_push_completed` and callback completed.
- Pending queue after completion: `idea=0`, `codex=0`.
- Evidence: `TEST_EVIDENCE_LINE_READ_CHAT_OFF_T3002.md`.

Next: RELEASE can perform git status, secret scan, commit, and push.

## Codex Default Delegation Gate

Current result: `BLOCKED_FOR_DEFAULT_DELEGATION`.

Do not run a live default-delegation Gate yet. FIX investigation found that the durable monitor does not create Codex threads or turns; it only runs the fixed local smoke-file action and checks that `CODEX_BIN` is executable.

Before TEST can validate default delegation, a separate implementation Gate must provide:

- A formal Codex host/API or CLI contract usable by the launchd monitor.
- Strict sandbox and approval policy.
- No-secret streamed event/result parsing.
- Exactly-once task result/finalizer behavior.
- Proof that original LINE instructions are passed only through the approved schema.

Evidence: `FIX_EVIDENCE_CODEX_DEFAULT_DELEGATION_INVESTIGATION.md`.

## LINE to Codex Gateway Connection Retest

FIX deployed Worker version `fc7ed508-ab6d-4ca8-8f97-33086fc3c2eb`.

TEST should rerun a fresh LINE command that clearly asks Codex to create a file in the approved `_03` runtime folder.

Expected durable path:

- Worker ingress/signature/admin/idempotency PASS.
- If n8n returns `codex_delegate`, normal `codex_task_enqueued` path is used.
- If n8n still returns `unsupported_intent` for explicit Codex text, Worker must record `codex_delegate_fallback_from_unsupported_intent` and still enqueue `codex_delegate`.
- Monitor claim occurs.
- Gateway observes Codex `thread.started` and `turn.started`.
- Processing LINE notice is sent only after Codex turn starts.
- Codex creates the requested runtime file.
- Final LINE reply is sent only after actual completion.
- Repeated same LINE event does not re-execute.

Computer Use Calculator is not expected to PASS until the Codex host is approved to use Calculator. Evidence: `FIX_EVIDENCE_LINE_CODEX_GATEWAY_CONNECTION.md`.

Implementation result: `PASS`.

Required regression for this Gate:

- `node --check monitor/src/codex_gateway.js`
- `node --check monitor/src/monitor.js`
- `node --test monitor/test/monitor.test.mjs`
- `node --check worker/src/index.js`
- `node --test worker/test/worker.test.mjs`
- secret/private scan effective_hit_count=0
- `.gitignore` sanity for runtime/logs/Dropbox JSON/Wrangler local state/secrets

Codex delegated task acceptance:

- Worker accepts legacy n8n `codex_task` as an alias.
- Worker stores new task action as `codex_delegate`.
- Worker stores the full `original_user_text`.
- Worker does not send a processing LINE notice at enqueue time.
- Worker returns truthful not-enabled final for `google_calendar_direct` while that direct flow is unimplemented.
- Monitor Gateway submits the original text to `codex exec --json`.
- Monitor sends processing callback only after observing Codex `turn.started`.
- Monitor parses Codex JSONL events and records result metadata.
- Completed delegated tasks do not rerun on repeated claim.

Approval bridge acceptance:

- High-risk text becomes `awaiting_approval`.
- LINE finalizer sends a natural confirmation request with a one-time code.
- Reply `確認 OK-XXXXXX` marks the same task `approved`.
- Approved task is requeued through the same pending index.

Capability manifest acceptance:

- Available capabilities and unavailable host surfaces must both be reported.
- Browser and Computer Use unavailability must not block Shell/file/Git/network/Codex execution.

Evidence: `TEST_EVIDENCE_CODEX_DEFAULT_DELEGATION_GATE.md`.

## N8N idea_create Natural Reply Regression

Synthetic n8n validation:

- Send four public idea examples through the production n8n webhook with a header-present no-secret probe.
- Verify `request_id` is preserved.
- Verify `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, and `saved_status=saved`.
- Verify `reply_source=ai_generated`.
- Verify reply text is Traditional Chinese, 1-2 sentences, content-aware, not identical across all samples, and does not contain internal terms.
- Verify saved replies do not contain apology/failure language such as `抱歉`, `發生問題`, `稍後再試`, or `失敗`.

Live TEST handoff:

- Send fresh LINE idea_create markers such as `T3101` and `T3102`.
- Confirm LINE final text is no longer repeatedly `已記下這個想法。`.
- Confirm Dropbox JSON parse/schema and `idea_json_final_push_completed` still pass.
- Keep this as TEST validation only; synthetic n8n PASS is not live LINE PASS.

### TEST Result: 2026-07-18 T3101/T3102

Result: `IDEA CREATE AI NATURAL FINAL LIVE PASS`

- T3101: `T3101-20260718163705`, request `pline-v3-01KXT5Z8WG55H64Q7XJX4WGEE4`.
- T3102: `T3102-20260718163706`, request `pline-v3-01KXT5ZB1057E1PK8A4M8YM36E`.
- LINE UI: both sent messages showed grey `已讀`.
- User-visible final replies: `2`.
- Fixed fallback sentence `已記下這個想法。`: absent.
- Final reply equality: not identical.
- Final reply content: short, Traditional Chinese, content-aware, and no internal terms.
- Durable `reply_source` / `reply_text`: not exposed in Worker evidence; LINE screenshot was used for text validation.
- Durable stages: Worker received, signature/admin/idempotency, webhook HTTP 200, n8n background completed, `intent=idea_create`, `tool_called=idea_create`, `saved_record=1`, monitor claim, Dropbox JSON write, final push/callback completed.
- Mark/read mode: `line_mark_as_read_skipped_disabled` present; `line_mark_as_read_failed` absent.
- Dropbox regression: PASS; JSON parse/schema/no raw User ID checks PASS for both files.
- Pending queue after completion: `idea=0`, `codex=0`.
- Evidence: `TEST_EVIDENCE_IDEA_CREATE_AI_NATURAL_FINAL_LIVE.md`.

Next: RELEASE can perform git status, secret scan, commit, and push.
