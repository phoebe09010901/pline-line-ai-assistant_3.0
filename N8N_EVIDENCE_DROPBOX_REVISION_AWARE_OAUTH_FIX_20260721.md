# Gate Evidence: Dropbox Revision-Aware Existing OAuth Capability Minimal Fix

- Gate scope: local adapter capability only.
- Existing credential compatibility: confirmed by type metadata only; no credential name, ID, or value was read or exported.
- HTTP Request authentication: existing OAuth through Predefined Credential Type.
- New credential: not required and not created.
- OAuth or credential policy change: not required and not performed.
- Worker: unchanged and not deployed.
- n8n workflow: unchanged, not Executed, and not Published.
- Dropbox: no live read, write, update, move, or delete operation performed.
- Monitor: remained stopped and unloaded.

The adapter limits requests to four official Dropbox endpoints and derives paths only from a validated full Memo ID. Conditional modify uses `update(rev)`. Archive/delete uses a conditional archived-state update, then a same-revision metadata guard, then collision-safe `move_v2` with `autorename=false`.

Important limitation: Dropbox `move_v2` does not accept a source revision. The final metadata check and move have a bounded but real TOCTOU window, so this design is revision-aware but the move is not atomic. A future workflow implementation must retain this limitation and must not represent the operation as an atomic conditional move.

## Validation results

- Revision adapter offline mocks: 8/8 PASS.
- Existing Memo Create cloud-writer regression: 16/16 PASS.
- Applicable Worker checkpoint, Memo, Reply-first, bounded ACK, and exactly-once regression: 49/49 PASS.
- JavaScript syntax checks: PASS.
- Git whitespace validation: PASS.
- Sensitive-value pattern scan: PASS.
- Worker source SHA-256 remained `ec39433b9fd7d4945a0f43efeb3d8b95d04786226202f7856ff99172f1392052`.
- Local workflow SHA-256 remained `7da73a7fe53de7f7124ff7de839426967136c1f63774ec87667c6b037bf8691b`.
- Backup: `backups/dropbox-revision-aware-oauth-fix-20260721-075529`.
