import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) throw new Error('usage: node N8N_MEMO_DELETE_STATIC_VALIDATE.mjs before.json after.json');

const before = JSON.parse(readFileSync(beforePath, 'utf8'));
const after = JSON.parse(readFileSync(afterPath, 'utf8'));
const beforeNodes = new Map(before.nodes.map((node) => [node.name, node]));
const afterNodes = new Map(after.nodes.map((node) => [node.name, node]));
const allowedChangedNodes = [
  'Memo Delete Archive Metadata Check'
].sort();

let pass = 0;
function check(name, fn) {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
}

check('workflow identity node count and connection-source count stay fixed', () => {
  assert.equal(after.workflow_id, 'kcMcBQos5cxsnWU1');
  assert.equal(before.nodes.length, 84);
  assert.equal(after.nodes.length, 84);
  assert.equal(Object.keys(before.connections).length, 83);
  assert.equal(Object.keys(after.connections).length, 83);
});

check('node names remain unique and all connection targets exist', () => {
  assert.equal(beforeNodes.size, before.nodes.length);
  assert.equal(afterNodes.size, after.nodes.length);
  for (const [source, groups] of Object.entries(after.connections)) {
    assert.ok(afterNodes.has(source), source);
    for (const outputs of Object.values(groups)) {
      for (const branch of outputs) for (const edge of branch) assert.ok(afterNodes.has(edge.node), edge.node);
    }
  }
});

check('connections are byte-for-byte equivalent', () => {
  assert.deepEqual(after.connections, before.connections);
});

check('only the authorized Archive Metadata Check node changed', () => {
  const changed = [];
  for (const [name, node] of beforeNodes) {
    if (JSON.stringify(node) !== JSON.stringify(afterNodes.get(name))) changed.push(name);
  }
  assert.deepEqual(changed.sort(), allowedChangedNodes);
});

check('Create Search Modify AI and callback nodes have zero drift', () => {
  for (const [name, node] of beforeNodes) {
    if (allowedChangedNodes.includes(name)) continue;
    assert.deepEqual(afterNodes.get(name), node, name);
  }
});

check('Delete metadata stages are native read-only first-level lists', () => {
  for (const name of ['Dropbox Delete Metadata', 'Dropbox Delete Pre Move Metadata', 'Dropbox Delete Archive Metadata']) {
    const node = afterNodes.get(name);
    assert.equal(node.type, 'n8n-nodes-base.dropbox');
    assert.equal(node.parameters.authentication, 'oAuth2');
    assert.equal(node.parameters.resource, 'folder');
    assert.equal(node.parameters.operation, 'list');
    assert.equal(node.parameters.returnAll, true);
    assert.deepEqual(node.parameters.filters, {});
    assert.equal(node.alwaysOutputData, true);
  }
});

check('archive-state write keeps update revision and never falls back to overwrite', () => {
  const node = afterNodes.get('Dropbox Delete Conditional Archive State');
  const header = node.parameters.headerParameters.parameters.find((entry) => entry.name === 'Dropbox-API-Arg').value;
  assert.match(header, /mode:\{ '\.tag':'update', update:\$json\.revision \}/);
  assert.match(header, /autorename:false/);
  assert.match(header, /strict_conflict:true/);
  assert.match(header, /String\.fromCharCode\(92\)/);
  assert.doesNotMatch(header, /overwrite/);
});

check('move is exact create-safe archive move and permanent delete is absent', () => {
  const move = afterNodes.get('Dropbox Delete Collision Safe Move');
  const body = move.parameters.body;
  assert.equal(move.parameters.url, 'https://api.dropboxapi.com/2/files/move_v2');
  assert.match(body, /from_path/);
  assert.match(body, /to_path/);
  assert.match(body, /autorename:false/);
  const deleteNodes = after.nodes.filter((node) => node.name.includes('Delete'));
  assert.equal(deleteNodes.some((node) => String(node.parameters.url || '').includes('/files/delete')), false);
  assert.equal(deleteNodes.some((node) => String(node.parameters.operation || '').toLowerCase() === 'delete'), false);
});

check('terminal success still requires active absence archive revision and exact readback', () => {
  const absence = afterNodes.get('Memo Delete Active Absence Check').parameters.jsCode;
  const archiveMetadata = afterNodes.get('Memo Delete Archive Metadata Check').parameters.jsCode;
  const verify = afterNodes.get('Memo Delete Verify Readback').parameters.jsCode;
  assert.match(absence, /statusCode\|\|0\)\s*===\s*409/);
  assert.match(archiveMetadata, /matches\.length === 1/);
  assert.match(archiveMetadata, /\^\[0-9a-f\]\{9,255\}\$/);
  assert.match(archiveMetadata, /archivePath === '\/菲比工作總倉庫\/99_ARCHIVE_封存\/' \+ memoId \+ '\.json'/);
  assert.doesNotMatch(archiveMetadata, /archiveRevision === request\.updated_revision/);
  assert.match(verify, /Object\.keys\(memo\).*keys\.slice\(\)/s);
  assert.match(verify, /'status'.*'archived_at'/s);
  assert.match(verify, /keys\.every\(\(key\) => memo\[key\] === expected\[key\]\)/);
});

check('Delete nodes contain no delivery or credential material', () => {
  const direct = JSON.stringify(after.nodes.filter((node) => node.name.includes('Delete')));
  for (const forbidden of ['replyToken', 'reply_token', 'user_id', 'finalize_token', 'access_token', 'client_secret']) {
    assert.equal(direct.includes(forbidden), false, forbidden);
  }
});

check('credential contract types stay bounded and sanitized local export has no identifiers', () => {
  for (const name of ['Dropbox Delete Metadata', 'Dropbox Delete Pre Move Metadata', 'Dropbox Delete Archive Metadata']) {
    assert.deepEqual(Object.keys(afterNodes.get(name).credentials || {}), []);
  }
  for (const name of ['Dropbox Delete Conditional Archive State', 'Dropbox Delete Collision Safe Move']) {
    const node = afterNodes.get(name);
    assert.equal(node.parameters.authentication, 'predefinedCredentialType');
    assert.equal(node.parameters.nodeCredentialType, 'dropboxOAuth2Api');
    assert.deepEqual(Object.keys(node.credentials || {}), []);
  }
  const callback = afterNodes.get('Memo CRUD Finalizer Callback');
  assert.equal(callback.parameters.authentication, 'genericCredentialType');
  assert.equal(callback.parameters.genericAuthType, 'httpHeaderAuth');
  assert.deepEqual(Object.keys(callback.credentials || {}), []);
});

assert.equal(pass, 11);
console.log(`RESULT ${pass}/11 PASS`);
