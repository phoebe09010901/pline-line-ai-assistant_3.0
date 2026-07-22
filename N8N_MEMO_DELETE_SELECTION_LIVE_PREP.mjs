import fs from 'node:fs';
import path from 'node:path';

const [currentPath, localPath, publishedPath, backupDir, importPath] = process.argv.slice(2);
if (![currentPath, localPath, publishedPath, backupDir, importPath].every(Boolean)) {
  throw new Error('usage: node N8N_MEMO_DELETE_SELECTION_LIVE_PREP.mjs <current> <local> <published> <backup-dir> <import-path>');
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const current = readJson(currentPath);
const local = readJson(localPath);
const published = readJson(publishedPath);

const assertWorkflowShape = (workflow, label) => {
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length !== 137) {
    throw new Error(`${label}: expected 137 nodes`);
  }
  if (Object.keys(workflow.connections || {}).length !== 136) {
    throw new Error(`${label}: expected 136 connection sources`);
  }
};

assertWorkflowShape(current, 'current');
assertWorkflowShape(local, 'local');
assertWorkflowShape(published, 'published');

const nodeNames = (workflow) => workflow.nodes.map((node) => node.name).sort();
if (JSON.stringify(nodeNames(current)) !== JSON.stringify(nodeNames(local))) {
  throw new Error('current/local node-name set mismatch');
}

const sanitize = (value) => {
  const copy = structuredClone(value);
  for (const node of copy.nodes || []) {
    if (!node.credentials) continue;
    node.credentials = Object.fromEntries(
      Object.keys(node.credentials).map((type) => [type, { redacted: true }]),
    );
  }
  delete copy.usedCredentials;
  delete copy.sharedWithProjects;
  delete copy.homeProject;
  return copy;
};

const normalizeNode = (node) => {
  const copy = structuredClone(node);
  delete copy.id;
  delete copy.position;
  delete copy.credentials;
  return copy;
};

const changedNodes = (left, right) => {
  const rightByName = new Map(right.nodes.map((node) => [node.name, node]));
  return left.nodes
    .filter((node) => JSON.stringify(normalizeNode(node)) !== JSON.stringify(normalizeNode(rightByName.get(node.name))))
    .map((node) => node.name)
    .sort();
};

const currentByName = new Map(current.nodes.map((node) => [node.name, node]));
const importWorkflow = structuredClone(current);
importWorkflow.nodes = local.nodes.map((localNode) => {
  const liveNode = currentByName.get(localNode.name);
  const merged = structuredClone(localNode);
  merged.id = liveNode.id;
  merged.position = liveNode.position;
  if (liveNode.credentials) merged.credentials = structuredClone(liveNode.credentials);
  else delete merged.credentials;
  if (!merged.webhookId && liveNode.webhookId) merged.webhookId = liveNode.webhookId;
  return merged;
});
importWorkflow.connections = structuredClone(local.connections);
for (const key of [
  'workflow_version_name',
  'memo_search_selection_batch_archive_contract',
  'memo_search_full_snapshot_page_contract',
]) {
  if (Object.hasOwn(local, key)) importWorkflow[key] = structuredClone(local[key]);
  else delete importWorkflow[key];
}
delete importWorkflow.versionId;
delete importWorkflow.pinData;

const credentialNodeCount = current.nodes.filter((node) => node.credentials).length;
const importCredentialNodeCount = importWorkflow.nodes.filter((node) => node.credentials).length;
if (credentialNodeCount !== 31 || importCredentialNodeCount !== credentialNodeCount) {
  throw new Error('credential reference coverage mismatch');
}

fs.mkdirSync(backupDir, { recursive: true });
const currentVersion = String(current.versionId || 'unknown').slice(0, 8);
const publishedVersion = String(published.versionId || published.activeVersionId || 'unknown').slice(0, 8);
fs.writeFileSync(
  path.join(backupDir, `CURRENT_DRAFT_${currentVersion}_SANITIZED.json`),
  `${JSON.stringify(sanitize(current), null, 2)}\n`,
);
fs.writeFileSync(
  path.join(backupDir, `PUBLISHED_${publishedVersion}_SANITIZED.json`),
  `${JSON.stringify(sanitize(published), null, 2)}\n`,
);
fs.writeFileSync(
  path.join(backupDir, 'LOCAL_TESTED_GATE_WORKFLOW.json'),
  `${JSON.stringify(sanitize(local), null, 2)}\n`,
);
fs.writeFileSync(importPath, `${JSON.stringify(importWorkflow, null, 2)}\n`, { mode: 0o600 });

const summary = {
  workflow_id: current.id,
  workflow_name: current.name,
  current_version: current.versionId,
  published_version: published.versionId || published.activeVersionId,
  node_count: current.nodes.length,
  connection_source_count: Object.keys(current.connections || {}).length,
  credential_node_count: credentialNodeCount,
  current_vs_published_changed_nodes: changedNodes(current, published),
  current_vs_local_changed_nodes: changedNodes(current, local),
  connection_current_vs_published_changed:
    JSON.stringify(current.connections || {}) !== JSON.stringify(published.connections || {}),
  connection_current_vs_local_changed:
    JSON.stringify(current.connections || {}) !== JSON.stringify(local.connections || {}),
  import_candidate_uses_local_contract: true,
  import_candidate_preserves_live_credential_references: true,
};
fs.writeFileSync(path.join(backupDir, 'PREP_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary));
