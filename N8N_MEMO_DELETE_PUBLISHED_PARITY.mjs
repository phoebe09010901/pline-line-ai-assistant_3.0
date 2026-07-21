import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';

const [beforePath, publishedPath, localPath] = process.argv.slice(2);
if (!beforePath || !publishedPath || !localPath) {
  throw new Error('usage: node N8N_MEMO_DELETE_PUBLISHED_PARITY.mjs before.json published.json local.json');
}

const before = JSON.parse(readFileSync(beforePath, 'utf8'));
const published = JSON.parse(readFileSync(publishedPath, 'utf8'));
const local = JSON.parse(readFileSync(localPath, 'utf8'));
const beforeNodes = new Map(before.nodes.map((node) => [node.name, node]));
const publishedNodes = new Map(published.nodes.map((node) => [node.name, node]));
const localNodes = new Map(local.nodes.map((node) => [node.name, node]));
const allowedChangedNodes = [
  'Memo Delete Archive Metadata Check'
].sort();

const withoutCredentials = (node) => {
  const copy = structuredClone(node);
  delete copy.credentials;
  return copy;
};
const credentialTypes = (node) => Object.keys(node.credentials || {}).sort();

let pass = 0;
function check(name, fn) {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
}

check('published workflow identity and topology counts are fixed', () => {
  assert.equal(published.id || published.workflow_id, 'kcMcBQos5cxsnWU1');
  assert.equal(published.nodes.length, 84);
  assert.equal(Object.keys(published.connections).length, 83);
  assert.equal(publishedNodes.size, 84);
});

check('node names and all connections remain identical to Published before', () => {
  assert.deepEqual([...publishedNodes.keys()].sort(), [...beforeNodes.keys()].sort());
  assert.deepEqual(published.connections, before.connections);
});

check('only Archive Metadata Check changed from Published before', () => {
  const changed = [];
  for (const [name, node] of beforeNodes) {
    if (!isDeepStrictEqual(withoutCredentials(node), withoutCredentials(publishedNodes.get(name)))) changed.push(name);
  }
  assert.deepEqual(changed.sort(), allowedChangedNodes);
});

check('all non-Delete published nodes and credential type references have zero drift', () => {
  for (const [name, node] of beforeNodes) {
    if (!allowedChangedNodes.includes(name)) assert.deepEqual(publishedNodes.get(name), node, name);
    assert.deepEqual(credentialTypes(publishedNodes.get(name)), credentialTypes(node), name);
  }
});

check('published unique-match parameters equal the validated local workflow', () => {
  for (const name of allowedChangedNodes) {
    assert.deepEqual(publishedNodes.get(name).parameters, localNodes.get(name).parameters, name);
    assert.equal(publishedNodes.get(name).type, localNodes.get(name).type, name);
  }
});

check('Dropbox OAuth and Header Auth reference types are preserved and redacted', () => {
  for (const name of [
    'Dropbox Delete Metadata', 'Dropbox Delete Conditional Archive State',
    'Dropbox Delete Pre Move Metadata', 'Dropbox Delete Collision Safe Move',
    'Dropbox Delete Archive Metadata'
  ]) assert.deepEqual(credentialTypes(publishedNodes.get(name)), ['dropboxOAuth2Api']);
  assert.deepEqual(credentialTypes(publishedNodes.get('Memo CRUD Finalizer Callback')), ['httpHeaderAuth']);
  for (const node of published.nodes) {
    for (const value of Object.values(node.credentials || {})) assert.deepEqual(value, { redacted: true });
  }
});

check('conditional archive update is header-safe update(rev) without overwrite', () => {
  const node = publishedNodes.get('Dropbox Delete Conditional Archive State');
  const header = node.parameters.headerParameters.parameters.find((entry) => entry.name === 'Dropbox-API-Arg').value;
  assert.match(header, /update:\$json\.revision/);
  assert.match(header, /String\.fromCharCode\(92\)/);
  assert.match(header, /autorename:false/);
  assert.match(header, /strict_conflict:true/);
  assert.doesNotMatch(header, /overwrite/);
});

check('native metadata and terminal verification contracts match local proof', () => {
  for (const name of ['Dropbox Delete Metadata', 'Dropbox Delete Pre Move Metadata', 'Dropbox Delete Archive Metadata']) {
    const node = publishedNodes.get(name);
    assert.equal(node.type, 'n8n-nodes-base.dropbox');
    assert.equal(node.parameters.resource, 'folder');
    assert.equal(node.parameters.operation, 'list');
    assert.equal(node.parameters.returnAll, true);
    assert.deepEqual(node.parameters.filters, {});
    assert.equal(node.alwaysOutputData, true);
    assert.equal(node.onError, 'continueRegularOutput');
  }
  assert.match(publishedNodes.get('Memo Delete Verify Readback').parameters.jsCode, /keys\.every/);
});

check('sanitized export excludes execution data and raw credential identifiers', () => {
  assert.deepEqual(published.pinData || {}, {});
  const serialized = JSON.stringify(published);
  for (const forbidden of ['"accessToken":', '"refreshToken":', '"clientSecret":', '"replyToken":', '"reply_token":', '"user_id":']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

assert.equal(pass, 9);
console.log(`RESULT ${pass}/9 PASS`);
