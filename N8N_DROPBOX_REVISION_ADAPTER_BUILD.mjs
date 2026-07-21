const MEMO_ID_PATTERN = /^memo-[a-f0-9]{64}$/;
const REVISION_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/;

export const DROPBOX_REVISION_ADAPTER = Object.freeze({
  authentication: 'predefinedCredentialType',
  credential_type: 'dropboxOAuth2Api',
  active_directory: '/菲比工作總倉庫/00_INBOX_臨時丟進來',
  archive_directory: '/菲比工作總倉庫/99_ARCHIVE_封存',
  api_host: 'https://api.dropboxapi.com',
  content_host: 'https://content.dropboxapi.com',
  allowed_endpoints: Object.freeze([
    '/2/files/get_metadata',
    '/2/files/upload',
    '/2/files/download',
    '/2/files/move_v2'
  ]),
  delete_move_atomic: false,
  delete_move_race: 'metadata_to_move_toctou'
});

const endpointUrl = Object.freeze({
  get_metadata: `${DROPBOX_REVISION_ADAPTER.api_host}/2/files/get_metadata`,
  upload: `${DROPBOX_REVISION_ADAPTER.content_host}/2/files/upload`,
  download: `${DROPBOX_REVISION_ADAPTER.content_host}/2/files/download`,
  move_v2: `${DROPBOX_REVISION_ADAPTER.api_host}/2/files/move_v2`
});

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function assertMemoId(memoId) {
  const value = String(memoId || '');
  if (!MEMO_ID_PATTERN.test(value)) reject('invalid_memo_id');
  return value;
}

export function assertRevision(revision) {
  const value = String(revision || '');
  if (!REVISION_PATTERN.test(value)) reject('missing_or_invalid_revision');
  return value;
}

export function httpHeaderSafeJson(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

function assertDropboxFileRevision(revision) {
  const value = String(revision || '');
  if (!/^[0-9a-f]{9,255}$/.test(value)) reject('missing_or_invalid_dropbox_file_revision');
  return value;
}

export function deriveMemoPath(memoId, location = 'active') {
  const safeMemoId = assertMemoId(memoId);
  const directory = location === 'active'
    ? DROPBOX_REVISION_ADAPTER.active_directory
    : location === 'archive'
      ? DROPBOX_REVISION_ADAPTER.archive_directory
      : reject('invalid_memo_location');
  return `${directory}/${safeMemoId}.json`;
}

function predefinedOAuth() {
  return {
    authentication: DROPBOX_REVISION_ADAPTER.authentication,
    nodeCredentialType: DROPBOX_REVISION_ADAPTER.credential_type
  };
}

export function buildGetMetadataRequest({ memoId, location = 'active' }) {
  return assertAllowedDropboxRequest({
    operation: 'get_metadata',
    method: 'POST',
    url: endpointUrl.get_metadata,
    auth: predefinedOAuth(),
    headers: { 'Content-Type': 'application/json' },
    body: { path: deriveMemoPath(memoId, location), include_deleted: false }
  });
}

export function buildDownloadRequest({ memoId, location = 'active' }) {
  const dropboxApiArg = { path: deriveMemoPath(memoId, location) };
  return assertAllowedDropboxRequest({
    operation: 'download',
    method: 'POST',
    url: endpointUrl.download,
    auth: predefinedOAuth(),
    headers: { 'Dropbox-API-Arg': JSON.stringify(dropboxApiArg) },
    body: null
  });
}

export function buildConditionalUpdateRequest({ memoId, expectedRevision, content }) {
  const safeRevision = assertDropboxFileRevision(expectedRevision);
  if (typeof content !== 'string' || content.length === 0) reject('missing_update_content');
  const dropboxApiArg = {
    path: deriveMemoPath(memoId, 'active'),
    mode: { '.tag': 'update', update: safeRevision },
    autorename: false,
    mute: false,
    strict_conflict: true
  };
  return assertAllowedDropboxRequest({
    operation: 'conditional_update',
    method: 'POST',
    url: endpointUrl.upload,
    auth: predefinedOAuth(),
    headers: {
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': httpHeaderSafeJson(dropboxApiArg)
    },
    body: content
  });
}

export function buildGuardedArchiveMoveRequest({ memoId, conditionalUpdateRevision, currentMetadataRevision }) {
  const updateRevision = assertRevision(conditionalUpdateRevision);
  const metadataRevision = assertRevision(currentMetadataRevision);
  if (updateRevision !== metadataRevision) reject('pre_move_revision_mismatch');
  return assertAllowedDropboxRequest({
    operation: 'archive_move',
    method: 'POST',
    url: endpointUrl.move_v2,
    auth: predefinedOAuth(),
    headers: { 'Content-Type': 'application/json' },
    body: {
      from_path: deriveMemoPath(memoId, 'active'),
      to_path: deriveMemoPath(memoId, 'archive'),
      autorename: false,
      allow_ownership_transfer: false
    },
    precondition: {
      checked_revision_match: true,
      source_revision: metadataRevision,
      atomic_with_move: false
    }
  });
}

function assertExactMemoPath(path) {
  if (typeof path !== 'string') reject('invalid_dropbox_path');
  const directories = [
    DROPBOX_REVISION_ADAPTER.active_directory,
    DROPBOX_REVISION_ADAPTER.archive_directory
  ];
  const directory = directories.find((candidate) => path.startsWith(`${candidate}/`));
  if (!directory) reject('dropbox_path_outside_allowlist');
  const filename = path.slice(directory.length + 1);
  if (!filename.endsWith('.json')) reject('invalid_dropbox_filename');
  const memoId = filename.slice(0, -'.json'.length);
  if (deriveMemoPath(memoId, directory === directories[0] ? 'active' : 'archive') !== path) {
    reject('noncanonical_dropbox_path');
  }
}

export function assertAllowedDropboxRequest(request) {
  if (!request || request.method !== 'POST') reject('invalid_http_method');
  const allowedUrls = new Set(Object.values(endpointUrl));
  if (!allowedUrls.has(request.url)) reject('dropbox_endpoint_not_allowed');
  if (request.auth?.authentication !== 'predefinedCredentialType'
    || request.auth?.nodeCredentialType !== 'dropboxOAuth2Api') {
    reject('invalid_dropbox_auth_contract');
  }
  const headerNames = Object.keys(request.headers || {}).map((name) => name.toLowerCase());
  if (headerNames.includes('authorization')) reject('inline_authorization_forbidden');

  if (request.operation === 'get_metadata') {
    if (request.url !== endpointUrl.get_metadata) reject('operation_endpoint_mismatch');
    assertExactMemoPath(request.body?.path);
  } else if (request.operation === 'download') {
    if (request.url !== endpointUrl.download) reject('operation_endpoint_mismatch');
    const apiArg = JSON.parse(request.headers?.['Dropbox-API-Arg'] || '{}');
    assertExactMemoPath(apiArg.path);
  } else if (request.operation === 'conditional_update') {
    if (request.url !== endpointUrl.upload) reject('operation_endpoint_mismatch');
    const apiArgHeader = request.headers?.['Dropbox-API-Arg'] || '';
    if (!/^[\x00-\x7f]*$/.test(apiArgHeader)) reject('dropbox_api_arg_not_http_header_safe');
    const apiArg = JSON.parse(apiArgHeader || '{}');
    assertExactMemoPath(apiArg.path);
    if (!apiArg.path.startsWith(`${DROPBOX_REVISION_ADAPTER.active_directory}/`)) {
      reject('conditional_update_requires_active_path');
    }
    assertDropboxFileRevision(apiArg.mode?.update);
    if (apiArg.mode?.['.tag'] !== 'update' || apiArg.autorename !== false || apiArg.strict_conflict !== true) {
      reject('unsafe_update_mode');
    }
  } else if (request.operation === 'archive_move') {
    if (request.url !== endpointUrl.move_v2) reject('operation_endpoint_mismatch');
    assertExactMemoPath(request.body?.from_path);
    assertExactMemoPath(request.body?.to_path);
    const sourcePrefix = `${DROPBOX_REVISION_ADAPTER.active_directory}/`;
    const targetPrefix = `${DROPBOX_REVISION_ADAPTER.archive_directory}/`;
    if (!request.body.from_path.startsWith(sourcePrefix)
      || !request.body.to_path.startsWith(targetPrefix)
      || request.body.from_path.slice(sourcePrefix.length) !== request.body.to_path.slice(targetPrefix.length)) {
      reject('noncanonical_archive_move_pair');
    }
    if (request.body?.autorename !== false || request.precondition?.checked_revision_match !== true) {
      reject('unsafe_archive_move');
    }
  } else {
    reject('dropbox_operation_not_allowed');
  }
  return request;
}
