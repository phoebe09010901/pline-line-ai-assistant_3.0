import fs from 'node:fs';

const inputPath = process.argv[2] || 'N8N_WORKFLOW_PLINE_V3_CALENDAR_UPDATE_LUNA_IMPORT.json';
const outputPath = process.argv[3] || 'N8N_WORKFLOW_PLINE_V3_CALENDAR_DELETE_LUNA_IMPORT.json';
const workflow = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const names = [
  'Calendar Delete Route',
  'Calendar Delete Read Existing',
  'Calendar Delete Inspect Existing',
  'Calendar Delete Needed Route',
  'Calendar Delete Event',
  'Calendar Delete Terminal Readback',
  'Calendar Delete Verify Absence',
];

const frozenOpenAi = workflow.nodes.find((node) => node.name === 'OpenAI Chat Model');
if (!frozenOpenAi) throw new Error('missing frozen OpenAI Chat Model');
const frozenOpenAiJson = JSON.stringify(frozenOpenAi);
const frozenModel = frozenOpenAi.parameters?.model?.value || frozenOpenAi.parameters?.model;
if (frozenModel !== 'gpt-5.6-luna' || Number(frozenOpenAi.parameters?.options?.temperature) !== 0.1) {
  throw new Error('refusing to overwrite frozen OpenAI gpt-5.6-luna temperature 0.1 core');
}
if (!frozenOpenAi.credentials || Object.keys(frozenOpenAi.credentials).length === 0) {
  throw new Error('missing frozen OpenAI credential reference');
}

const currentNormalizeTargets = workflow.connections['Normalize Input']?.main?.[0];
const currentDeleteFalseTargets = workflow.connections['Calendar Delete Route']?.main?.[1];
const priorNormalizeTargets = currentNormalizeTargets?.[0]?.node === 'Calendar Delete Route'
  ? currentDeleteFalseTargets
  : currentNormalizeTargets;
if (!Array.isArray(priorNormalizeTargets) || priorNormalizeTargets.length !== 1 || priorNormalizeTargets[0]?.node !== 'Calendar Update Route') {
  throw new Error('unexpected Luna Update published baseline topology');
}

workflow.nodes = workflow.nodes.filter((node) => !names.includes(node.name));
for (const name of names) delete workflow.connections[name];
const normalize = workflow.nodes.find((node) => node.name === 'Normalize Input');
if (!normalize) throw new Error('missing Normalize Input');
const normalizeCode = `if (rawIntent === 'calendar_delete') {
  return [{ json: {
    intent: 'calendar_delete',
    request_id: String(body.request_id || ''),
    safe_event_hash: String(body.safe_event_hash || '').trim().toLowerCase(),
    calendar_alias: String(body.calendar_alias || ''),
    timezone: String(body.timezone || ''),
    event_reference: String(body.event_reference || '').trim(),
    readback_only: body.readback_only === true,
    original_title: String(body.original_title || '').trim(),
    original_location: String(body.original_location || '').trim(),
    original_all_day: body.original_all_day === true,
    original_start: String(body.original_start || '').trim(),
    original_end: String(body.original_end || '').trim(),
    allowed_intents: ['calendar_delete']
  } }];
}
`;
if (!normalize.parameters.jsCode.includes("if (rawIntent === 'calendar_delete')")) {
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
    "if (rawIntent === 'calendar_update') {",
    `${normalizeCode}\nif (rawIntent === 'calendar_update') {`,
  );
}

const credentialSource = workflow.nodes.find((node) =>
  ['Calendar Update Event', 'Calendar Search Events', 'Calendar Read Existing'].includes(node.name)
  && node.credentials?.googleCalendarOAuth2Api
);
if (!credentialSource) throw new Error('missing bound Google Calendar credential reference');
const credential = JSON.parse(JSON.stringify(credentialSource.credentials));
const calendar = { __rl: true, value: 'primary', mode: 'list', cachedResultName: 'primary' };
const timezone = { __rl: true, value: 'Asia/Taipei', mode: 'id' };

const routeNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'pline-v3-calendar-delete-route-condition',
        leftValue: '={{ $json.intent }}',
        rightValue: 'calendar_delete',
        operator: { type: 'string', operation: 'equals' },
      }],
      combinator: 'and',
    },
    options: {},
  },
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [-17644, 6100],
  id: 'pline-v3-calendar-delete-route',
  name: 'Calendar Delete Route',
};

const readNode = {
  parameters: {
    operation: 'get',
    calendar,
    eventId: "={{ $('Normalize Input').first().json.event_reference }}",
    options: { timeZone: timezone },
  },
  type: 'n8n-nodes-base.googleCalendar',
  typeVersion: 1.3,
  position: [-17344, 6100],
  id: 'pline-v3-calendar-delete-read-existing',
  name: 'Calendar Delete Read Existing',
  credentials: credential,
  onError: 'continueRegularOutput',
};

const inspectCode = `const input = $('Normalize Input').first().json;
const event = $json || {};
const message = String(event.error?.message || event.errorMessage || event.message || event.error || '');
const statusCode = Number(event.statusCode || event.status || event.code || event.error?.statusCode || event.error?.code || 0);
const notFound = statusCode === 404 || /(?:404|not found)/i.test(message);
const cancelledTombstone = String(event.status || '').trim().toLowerCase() === 'cancelled';
const exists = Boolean(event.id) && !notFound && !cancelledTombstone;
const allDay = Boolean(event.start?.date && !event.start?.dateTime);
const current = {
  title: String(event.summary || ''),
  location: String(event.location || ''),
  all_day: allDay,
  start: allDay ? String(event.start?.date || '') : String(event.start?.dateTime || ''),
  end: allDay ? String(event.end?.date || '') : String(event.end?.dateTime || '')
};
const originalMatches = exists
  && current.title === input.original_title
  && current.location === input.original_location
  && current.all_day === input.original_all_day
  && current.start === input.original_start
  && current.end === input.original_end;
return [{ json: {
  ...input,
  existing_ok: exists,
  original_matches: originalMatches,
  precheck_state: exists ? (originalMatches ? 'matched' : 'changed') : 'missing',
  safe_to_delete: exists && !input.readback_only && originalMatches
} }];`;
const inspectNode = {
  parameters: { jsCode: inspectCode },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-17044, 6100],
  id: 'pline-v3-calendar-delete-inspect-existing',
  name: 'Calendar Delete Inspect Existing',
};

const neededRoute = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'pline-v3-calendar-delete-needed-condition',
        leftValue: '={{ $json.safe_to_delete }}',
        rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  },
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [-16744, 6100],
  id: 'pline-v3-calendar-delete-needed-route',
  name: 'Calendar Delete Needed Route',
};

const deleteNode = {
  parameters: {
    operation: 'delete',
    calendar,
    eventId: '={{ $json.event_reference }}',
    options: { sendUpdates: 'none' },
  },
  type: 'n8n-nodes-base.googleCalendar',
  typeVersion: 1.3,
  position: [-16444, 6000],
  id: 'pline-v3-calendar-delete-event',
  name: 'Calendar Delete Event',
  credentials: credential,
  onError: 'continueRegularOutput',
  alwaysOutputData: true,
};

const readbackNode = {
  parameters: {
    operation: 'get',
    calendar,
    eventId: "={{ $('Normalize Input').first().json.event_reference }}",
    options: { timeZone: timezone },
  },
  type: 'n8n-nodes-base.googleCalendar',
  typeVersion: 1.3,
  position: [-16144, 6100],
  id: 'pline-v3-calendar-delete-terminal-readback',
  name: 'Calendar Delete Terminal Readback',
  credentials: credential,
  onError: 'continueRegularOutput',
  alwaysOutputData: true,
};

const verifyCode = `const input = $('Normalize Input').first().json;
const inspected = $('Calendar Delete Inspect Existing').first().json || {};
const event = $json || {};
const message = String(event.error?.message || event.errorMessage || event.message || event.error || '');
const statusCode = Number(event.statusCode || event.status || event.code || event.error?.statusCode || event.error?.code || 0);
const cancelledTombstone = String(event.status || '').trim().toLowerCase() === 'cancelled';
const absent = cancelledTombstone || statusCode === 404 || /(?:404|not found)/i.test(message);
const eligibleAbsence = inspected.safe_to_delete === true || inspected.readback_only === true;
const completed = absent && eligibleAbsence;
let reason = '';
if (!completed) {
  if (absent && !eligibleAbsence) reason = 'calendar_delete_candidate_missing_or_changed';
  else if (event.id && !cancelledTombstone) reason = 'calendar_delete_readback_still_exists';
  else reason = 'calendar_delete_readback_unverified';
}
return [{ json: {
  request_id: input.request_id,
  intent: 'calendar_delete',
  status: completed ? 'completed' : 'failed',
  reason,
  readback_verified: completed,
  exists: absent ? false : true
} }];`;
const verifyNode = {
  parameters: { jsCode: verifyCode },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-15844, 6100],
  id: 'pline-v3-calendar-delete-verify-absence',
  name: 'Calendar Delete Verify Absence',
};

workflow.nodes.push(routeNode, readNode, inspectNode, neededRoute, deleteNode, readbackNode, verifyNode);
workflow.connections['Normalize Input'] = { main: [[{ node: 'Calendar Delete Route', type: 'main', index: 0 }]] };
workflow.connections['Calendar Delete Route'] = {
  main: [
    [{ node: 'Calendar Delete Read Existing', type: 'main', index: 0 }],
    priorNormalizeTargets,
  ],
};
workflow.connections['Calendar Delete Read Existing'] = { main: [[{ node: 'Calendar Delete Inspect Existing', type: 'main', index: 0 }]] };
workflow.connections['Calendar Delete Inspect Existing'] = { main: [[{ node: 'Calendar Delete Needed Route', type: 'main', index: 0 }]] };
workflow.connections['Calendar Delete Needed Route'] = {
  main: [
    [{ node: 'Calendar Delete Event', type: 'main', index: 0 }],
    [{ node: 'Calendar Delete Terminal Readback', type: 'main', index: 0 }],
  ],
};
workflow.connections['Calendar Delete Event'] = { main: [[{ node: 'Calendar Delete Terminal Readback', type: 'main', index: 0 }]] };
workflow.connections['Calendar Delete Terminal Readback'] = { main: [[{ node: 'Calendar Delete Verify Absence', type: 'main', index: 0 }]] };
workflow.connections['Calendar Delete Verify Absence'] = { main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]] };

workflow.calendar_delete_gate_contract = {
  gate: 'CALENDAR_DELETE_GATE',
  calendar_alias: 'authorized_test',
  calendar_backend: 'primary',
  timezone: 'Asia/Taipei',
  actor_pending_ttl_seconds: 600,
  confirmation_required: true,
  unbounded_delete_allowed: false,
  original_candidate_match_required: true,
  terminal_absence_readback_required: true,
  terminal_absence_states: ['404', 'not_found', 'cancelled_tombstone'],
  candidate_missing_or_changed_fail_closed: true,
  successful_absence_requires_delete_attempt_or_readback_only: true,
  create_nodes_changed: false,
  search_nodes_changed: false,
  update_nodes_changed: false,
  memo_nodes_changed: false,
  openai_core_model_status: 'preserved_gpt-5.6-luna',
  retry_evidence_limitation: 'formal_same_webhook_live_replay_not_executed',
};
workflow.workflow_version_name = 'Calendar Delete Cancelled Tombstone Readback Fix';
if (JSON.stringify(workflow.nodes.find((node) => node.name === 'OpenAI Chat Model')) !== frozenOpenAiJson) {
  throw new Error('frozen OpenAI Chat Model changed during Delete merge');
}
fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  nodes: workflow.nodes.length,
  connection_sources: Object.keys(workflow.connections).length,
  calendar_delete_nodes: names.length,
  openai_core_model_status: 'preserved_gpt-5.6-luna',
}));
