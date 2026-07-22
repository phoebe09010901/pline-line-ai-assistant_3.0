import fs from 'node:fs';
import path from 'node:path';

const [currentPath, localPath, calendarCredentialSourcePath, backupDir, importPath] = process.argv.slice(2);
if (![currentPath, localPath, calendarCredentialSourcePath, backupDir, importPath].every(Boolean)) {
  throw new Error('usage: node N8N_CALENDAR_CREATE_LIVE_PREP.mjs <current> <local> <calendar-credential-source> <backup-dir> <import-path>');
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const current = readJson(currentPath);
const local = readJson(localPath);
const credentialSource = readJson(calendarCredentialSourcePath);

const currentShape = `${current.nodes?.length}/${Object.keys(current.connections || {}).length}`;
if (!['137/136', '144/143'].includes(currentShape)) {
  throw new Error('current workflow must match the Memo checkpoint or current Calendar Gate Published shape');
}
if (local.nodes?.length !== 144 || Object.keys(local.connections || {}).length !== 143) {
  throw new Error('local Calendar Create workflow must contain exactly 144 nodes and 143 connection sources');
}

const localNames = new Set(local.nodes.map((node) => node.name));
for (const node of current.nodes) {
  if (!localNames.has(node.name)) throw new Error(`local workflow lost existing node: ${node.name}`);
}

const credentialNode = credentialSource.nodes.find((node) => node.type === 'n8n-nodes-base.googleCalendar');
const calendarCredential = credentialNode?.credentials?.googleCalendarOAuth2Api;
if (!calendarCredential?.id || !calendarCredential?.name) {
  throw new Error('connected Google Calendar credential reference is unavailable');
}

const currentByName = new Map(current.nodes.map((node) => [node.name, node]));
const importWorkflow = structuredClone(current);
importWorkflow.nodes = local.nodes.map((localNode) => {
  const merged = structuredClone(localNode);
  const liveNode = currentByName.get(localNode.name);
  if (liveNode) {
    merged.id = liveNode.id;
    merged.position = liveNode.position;
    if (liveNode.credentials) merged.credentials = structuredClone(liveNode.credentials);
    else delete merged.credentials;
    if (!merged.webhookId && liveNode.webhookId) merged.webhookId = liveNode.webhookId;
  } else if (merged.type === 'n8n-nodes-base.googleCalendar') {
    merged.credentials = { googleCalendarOAuth2Api: structuredClone(calendarCredential) };
  }
  return merged;
});
importWorkflow.connections = structuredClone(local.connections);
importWorkflow.calendar_create_gate_contract = structuredClone(local.calendar_create_gate_contract);
importWorkflow.workflow_version_name = local.workflow_version_name;
delete importWorkflow.versionId;
delete importWorkflow.activeVersionId;
delete importWorkflow.pinData;

const calendarNodes = importWorkflow.nodes.filter((node) => node.type === 'n8n-nodes-base.googleCalendar');
if (calendarNodes.length !== 3 || calendarNodes.some((node) => !node.credentials?.googleCalendarOAuth2Api)) {
  throw new Error('Calendar credential reference was not applied to all three Calendar nodes');
}
if (calendarNodes.some((node) => node.parameters?.calendar?.value !== 'primary')) {
  throw new Error('authorized_test must map only to the credential primary Calendar backend');
}

const sanitize = (workflow) => {
  const copy = structuredClone(workflow);
  for (const node of copy.nodes || []) {
    if (!node.credentials) continue;
    node.credentials = Object.fromEntries(Object.keys(node.credentials).map((type) => [type, { redacted: true }]));
  }
  delete copy.usedCredentials;
  delete copy.sharedWithProjects;
  delete copy.homeProject;
  return copy;
};

fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'CURRENT_PUBLISHED_SANITIZED.json'), `${JSON.stringify(sanitize(current), null, 2)}\n`);
fs.writeFileSync(path.join(backupDir, 'LOCAL_TESTED_CALENDAR_GATE_SANITIZED.json'), `${JSON.stringify(sanitize(local), null, 2)}\n`);
fs.writeFileSync(path.join(backupDir, 'IMPORT_CANDIDATE_SANITIZED.json'), `${JSON.stringify(sanitize(importWorkflow), null, 2)}\n`);
fs.writeFileSync(importPath, `${JSON.stringify(importWorkflow, null, 2)}\n`, { mode: 0o600 });

const summary = {
  workflow_id: current.id,
  workflow_name: current.name,
  published_version: current.versionId || current.activeVersionId || null,
  before_nodes: current.nodes.length,
  after_nodes: importWorkflow.nodes.length,
  after_connection_sources: Object.keys(importWorkflow.connections).length,
  new_node_count: importWorkflow.nodes.length - current.nodes.length,
  calendar_node_count: calendarNodes.length,
  calendar_alias: 'authorized_test',
  calendar_backend: 'primary',
  alias_mapping: 'authorized_test_to_credential_primary',
  existing_credential_references_preserved: true,
  calendar_credential_reference_present: true,
  secrets_exported: false,
};
fs.writeFileSync(path.join(backupDir, 'PREP_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary));
