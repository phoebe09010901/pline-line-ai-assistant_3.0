# Dropbox OAuth HTTP Request Usage Policy Authorization

## Authorized change

- Target: the single existing Dropbox OAuth credential already referenced by the active workflow.
- Policy before: `None` — block all HTTP Request and GraphQL node usage.
- Policy after: `Specific Domains`.
- Allowed domains: `api.dropboxapi.com`, `content.dropboxapi.com`.
- Policy was saved at the credential layer without changing workflow nodes, connections, routes, functional parameters, or credential references.
- No new credential was created. No OAuth login, consent, MFA, or CAPTCHA was requested.
- No Dropbox credential value, access token, refresh token, identifier, or secret was copied, stored, or added to repository evidence.

## Parity and release decision

- Workflow: `kcMcBQos5cxsnWU1`.
- Published version remained `fad98dad-d5a4-4013-9b18-2eb88b1f6899`.
- Published topology remained 84 nodes / 83 connection sources.
- The existing 18 Dropbox node references and two Header Auth finalizer references remain associated with the unchanged Published version.
- Credential policy is saved independently from workflow content. No draft change was produced, so no unnecessary Publish was performed.
- Worker was unchanged and not deployed.
- No workflow execution, LINE message, Dropbox file operation, Memo Delete, KV operation, or Monitor start was performed.

## Security note

When the existing browser tab was claimed, a non-target credential dialog was already open. It was closed immediately. No displayed value was copied, used, retained in repository evidence, or reproduced in this report. The target Dropbox credential value fields were not inspected.

## Validation results

- Policy/metadata diagnostic: 8/8 PASS.
- Memo CRUD offline regression: 31/31 PASS.
- Revision adapter offline regression: 8/8 PASS.
- Memo Create cloud-writer regression: 16/16 PASS.
- Applicable Worker test runner: 49/49 PASS, including Reply-first internal 14/14 PASS.
- Dropbox reference contract: 18/18 nodes retained; all eight predefined-credential HTTP Request nodes use only the two allowlisted Dropbox hosts.
- Header Auth finalizer reference contract: 2/2 retained.
- Syntax, topology, whitespace, diff, and sensitive-value scan: PASS.
- Worker and workflow source hashes remained unchanged.
- Backup: `backups/memo-modify-dropbox-policy-20260721-090748`.
