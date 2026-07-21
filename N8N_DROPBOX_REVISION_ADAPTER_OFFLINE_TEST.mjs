import assert from 'node:assert/strict';
import {
  DROPBOX_REVISION_ADAPTER,
  assertAllowedDropboxRequest,
  buildConditionalUpdateRequest,
  buildDownloadRequest,
  buildGetMetadataRequest,
  buildGuardedArchiveMoveRequest,
  deriveMemoPath,
  httpHeaderSafeJson
} from './N8N_DROPBOX_REVISION_ADAPTER_BUILD.mjs';

const memoId = `memo-${'a'.repeat(64)}`;
const activePath = deriveMemoPath(memoId, 'active');
const archivePath = deriveMemoPath(memoId, 'archive');
const initialRev = 'abcdef1234567890abcde';
const staleRev = 'abcdef1234567890abcdf';

class MockDropbox {
  constructor() {
    this.files = new Map([[activePath, { rev: initialRev, content: '{"status":"active"}' }]]);
    this.revisionCounter = 1;
    this.overwrites = 0;
    this.moves = 0;
  }

  execute(request) {
    assertAllowedDropboxRequest(request);
    if (request.operation === 'get_metadata') {
      const file = this.files.get(request.body.path);
      return file ? { status: 200, rev: file.rev } : { status: 409 };
    }
    if (request.operation === 'download') {
      const arg = JSON.parse(request.headers['Dropbox-API-Arg']);
      const file = this.files.get(arg.path);
      return file ? { status: 200, content: file.content } : { status: 409 };
    }
    if (request.operation === 'conditional_update') {
      const arg = JSON.parse(request.headers['Dropbox-API-Arg']);
      const current = this.files.get(arg.path);
      if (!current || current.rev !== arg.mode.update) return { status: 409, overwritten: false };
      const rev = `abcdef1234567890abc${String(this.revisionCounter++).padStart(2, '0')}`;
      this.files.set(arg.path, { rev, content: request.body });
      this.overwrites += 1;
      return { status: 200, rev, overwritten: true };
    }
    if (request.operation === 'archive_move') {
      if (this.files.has(request.body.to_path)) return { status: 409, moved: false };
      const source = this.files.get(request.body.from_path);
      if (!source) return { status: 409, moved: false };
      this.files.set(request.body.to_path, source);
      this.files.delete(request.body.from_path);
      this.moves += 1;
      return { status: 200, moved: true };
    }
    throw new Error('unsupported_mock_operation');
  }
}

const updateStore = new MockDropbox();
const updateRequest = buildConditionalUpdateRequest({
  memoId,
  expectedRevision: initialRev,
  content: '{"status":"active","content":"updated"}'
});
const updateResult = updateStore.execute(updateRequest);
assert.equal(updateResult.status, 200);
assert.equal(updateStore.files.get(activePath).content, updateRequest.body);
console.log('PASS update(rev) matching revision performs one conditional write');

const mismatchStore = new MockDropbox();
const beforeMismatch = structuredClone(mismatchStore.files.get(activePath));
const mismatchResult = mismatchStore.execute(buildConditionalUpdateRequest({
  memoId,
  expectedRevision: staleRev,
  content: '{"status":"active","content":"must-not-write"}'
}));
assert.equal(mismatchResult.status, 409);
assert.equal(mismatchResult.overwritten, false);
assert.deepEqual(mismatchStore.files.get(activePath), beforeMismatch);
assert.equal(mismatchStore.overwrites, 0);
console.log('PASS revision mismatch is a safe 409 with zero overwrite');

assert.throws(
  () => buildConditionalUpdateRequest({ memoId, expectedRevision: '', content: '{}' }),
  /missing_or_invalid.*revision/
);
console.log('PASS missing revision is rejected before a request is built');

const headerArg = updateRequest.headers['Dropbox-API-Arg'];
assert.match(headerArg, /^[\x00-\x7f]+$/);
assert.match(headerArg, /\\u83f2/);
assert.equal(JSON.parse(headerArg).path, activePath);
assert.equal(JSON.parse(headerArg).mode.update, initialRev);
assert.equal(httpHeaderSafeJson({ path: activePath }).includes('菲'), false);
assert.throws(
  () => assertAllowedDropboxRequest({ ...updateRequest, headers: { ...updateRequest.headers, 'Dropbox-API-Arg': JSON.stringify(JSON.parse(headerArg)) } }),
  /dropbox_api_arg_not_http_header_safe/
);
console.log('PASS Unicode path is HTTP-header-safe JSON and round-trips without semantic drift');

assert.throws(() => deriveMemoPath('../memo-escape', 'active'), /invalid_memo_id/);
assert.throws(() => assertAllowedDropboxRequest({
  operation: 'get_metadata',
  method: 'POST',
  url: 'https://example.invalid/2/files/get_metadata',
  auth: { authentication: 'predefinedCredentialType', nodeCredentialType: 'dropboxOAuth2Api' },
  headers: { 'Content-Type': 'application/json' },
  body: { path: activePath }
}), /dropbox_endpoint_not_allowed/);
assert.throws(() => assertAllowedDropboxRequest({
  operation: 'archive_move',
  method: 'POST',
  url: 'https://api.dropboxapi.com/2/files/move_v2',
  auth: { authentication: 'predefinedCredentialType', nodeCredentialType: 'dropboxOAuth2Api' },
  headers: { 'Content-Type': 'application/json' },
  body: { from_path: archivePath, to_path: activePath, autorename: false },
  precondition: { checked_revision_match: true }
}), /noncanonical_archive_move_pair/);
console.log('PASS arbitrary URL and path traversal are rejected');

const collisionStore = new MockDropbox();
collisionStore.files.set(archivePath, { rev: 'rev-existing-archive', content: '{"status":"archived"}' });
const collisionMove = buildGuardedArchiveMoveRequest({
  memoId,
  conditionalUpdateRevision: initialRev,
  currentMetadataRevision: initialRev
});
const collisionResult = collisionStore.execute(collisionMove);
assert.equal(collisionResult.status, 409);
assert.equal(collisionResult.moved, false);
assert.equal(collisionStore.files.has(activePath), true);
assert.equal(collisionStore.files.get(archivePath).content, '{"status":"archived"}');
console.log('PASS archive collision returns 409 with zero overwrite and source retained');

const preMoveStore = new MockDropbox();
assert.throws(() => buildGuardedArchiveMoveRequest({
  memoId,
  conditionalUpdateRevision: 'rev-updated-001',
  currentMetadataRevision: 'rev-concurrent-002'
}), /pre_move_revision_mismatch/);
assert.equal(preMoveStore.moves, 0);
assert.equal(preMoveStore.files.has(activePath), true);
console.log('PASS pre-move metadata mismatch builds no move and performs zero move');

const requestFixtures = [
  buildGetMetadataRequest({ memoId }),
  buildDownloadRequest({ memoId }),
  updateRequest,
  collisionMove
];
const serializedFixtures = JSON.stringify(requestFixtures);
for (const forbidden of ['replyToken', 'raw User ID', 'finalize_token', 'Authorization', 'access_token', 'client_secret']) {
  assert.equal(serializedFixtures.includes(forbidden), false, `forbidden field leaked: ${forbidden}`);
}
assert.equal(DROPBOX_REVISION_ADAPTER.authentication, 'predefinedCredentialType');
assert.equal(DROPBOX_REVISION_ADAPTER.credential_type, 'dropboxOAuth2Api');
console.log('PASS adapter fixtures contain no token, callback credential, reply token, or raw user identity');

assert.equal(DROPBOX_REVISION_ADAPTER.delete_move_atomic, false);
assert.equal(DROPBOX_REVISION_ADAPTER.delete_move_race, 'metadata_to_move_toctou');
assert.equal(collisionMove.precondition.atomic_with_move, false);
console.log('PASS metadata-to-move race is explicitly retained as non-atomic');

console.log('RESULT 9/9 PASS');
