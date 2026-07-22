import fs from 'node:fs';

const workflowPath = process.argv[2] || 'N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

const names = [
  'Calendar Create Route',
  'Calendar Read Existing',
  'Calendar Existing Decision',
  'Calendar Create Needed Route',
  'Calendar Create Event',
  'Calendar Terminal Readback',
  'Calendar Verify Readback',
];
const removalNames = [...names, 'Calendar Follow-up Continuity Contract'];
const currentNormalizeTargets = workflow.connections['Normalize Input']?.main?.[0];
const routedMemoTargets = workflow.connections['Calendar Create Route']?.main?.[1];
const priorNormalizeTargets = currentNormalizeTargets?.[0]?.node === 'Calendar Create Route'
  ? (routedMemoTargets?.[0]?.node === 'Calendar Create Route'
      ? [{ node: 'Memo Search Page Route', type: 'main', index: 0 }]
      : routedMemoTargets)
  : currentNormalizeTargets;
workflow.nodes = workflow.nodes.filter((node) => !removalNames.includes(node.name));
for (const name of removalNames) delete workflow.connections[name];

const normalize = workflow.nodes.find((node) => node.name === 'Normalize Input');
if (!normalize) throw new Error('missing Normalize Input');
const calendarNormalize = `if (rawIntent === 'calendar_create') {
  return [{ json: {
    intent: 'calendar_create',
    request_id: String(body.request_id || ''),
    safe_event_hash: String(body.safe_event_hash || '').trim().toLowerCase(),
    calendar_alias: String(body.calendar_alias || ''),
    timezone: String(body.timezone || ''),
    event_reference: String(body.event_reference || '').trim().toLowerCase(),
    title: String(body.title || '').trim(),
    location: String(body.location || '').trim(),
    all_day: body.all_day === true,
    date: String(body.date || '').trim(),
    start: String(body.start || '').trim(),
    end: String(body.end || '').trim(),
    readback_only: body.readback_only === true,
    allowed_intents: ['calendar_create']
  } }];
}
`;
if (!normalize.parameters.jsCode.includes("if (rawIntent === 'calendar_create')")) {
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
    "if (rawIntent === 'memo_search_page') {",
    `${calendarNormalize}\nif (rawIntent === 'memo_search_page') {`,
  );
}

const calendar = {
  __rl: true,
  value: 'primary',
  mode: 'list',
  cachedResultName: 'primary',
};
const credential = { googleCalendarOAuth2Api: { redacted: true } };
const timezone = { __rl: true, value: 'Asia/Taipei', mode: 'id' };

const routeNode = (name, id, leftValue, rightValue, type = 'string', position = [0, 0]) => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: `${id}-condition`,
        leftValue,
        rightValue,
        operator: { type, operation: 'equals' },
      }],
      combinator: 'and',
    },
    options: {},
  },
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position,
  id,
  name,
});

const verifyCode = `const input = $('Normalize Input').first().json;
const event = $json || {};
function sameInstant(actual, expected) {
  return Number.isFinite(Date.parse(actual || '')) && Date.parse(actual) === Date.parse(expected || '');
}
let verified = Boolean(event.id) && event.id === input.event_reference && event.summary === input.title && String(event.location || '') === String(input.location || '');
if (input.all_day) {
  verified = verified && event.start?.date === input.date && event.end?.date === String(input.end || '').slice(0, 10);
} else {
  verified = verified && sameInstant(event.start?.dateTime, input.start) && sameInstant(event.end?.dateTime, input.end);
}
return [{ json: {
  request_id: input.request_id,
  intent: 'calendar_create',
  status: verified ? 'completed' : 'failed',
  reason: verified ? '' : 'calendar_readback_mismatch',
  readback_verified: verified,
  duplicate: false,
  title: input.title,
  location: input.location,
  all_day: input.all_day,
  start: input.start,
  end: input.end
} }];`;

const existingDecisionCode = `const input = $('Normalize Input').first().json;
const event = $json || {};
function sameInstant(actual, expected) {
  return Number.isFinite(Date.parse(actual || '')) && Date.parse(actual) === Date.parse(expected || '');
}
if (event.id) {
  let verified = event.id === input.event_reference && event.summary === input.title && String(event.location || '') === String(input.location || '');
  if (input.all_day) {
    verified = verified && event.start?.date === input.date && event.end?.date === String(input.end || '').slice(0, 10);
  } else {
    verified = verified && sameInstant(event.start?.dateTime, input.start) && sameInstant(event.end?.dateTime, input.end);
  }
  return [{ json: {
    request_id: input.request_id,
    intent: 'calendar_create',
    status: verified ? 'completed' : 'failed',
    reason: verified ? '' : 'calendar_existing_mismatch',
    readback_verified: verified,
    duplicate: verified,
    should_create: false,
    title: input.title,
    location: input.location,
    all_day: input.all_day,
    start: input.start,
    end: input.end
  } }];
}
if (input.readback_only) {
  return [{ json: {
    request_id: input.request_id,
    intent: 'calendar_create',
    status: 'failed',
    reason: 'calendar_event_not_found',
    readback_verified: false,
    duplicate: false,
    should_create: false,
    title: input.title,
    location: input.location,
    all_day: input.all_day,
    start: input.start,
    end: input.end
  } }];
}
return [{ json: { ...input, should_create: true } }];`;

const nodes = [
  routeNode('Calendar Create Route', 'pline-v3-calendar-create-route', '={{ $json.intent }}', 'calendar_create', 'string', [-16144, 6000]),
  {
    parameters: {
      operation: 'get',
      calendar,
      eventId: "={{ $('Normalize Input').first().json.event_reference }}",
      options: { timeZone: timezone },
    },
    type: 'n8n-nodes-base.googleCalendar',
    typeVersion: 1.3,
    position: [-15844, 6000],
    id: 'pline-v3-calendar-read-existing',
    name: 'Calendar Read Existing',
    credentials: credential,
    onError: 'continueRegularOutput',
  },
  {
    parameters: { jsCode: existingDecisionCode },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-15544, 6000],
    id: 'pline-v3-calendar-existing-decision',
    name: 'Calendar Existing Decision',
  },
  routeNode('Calendar Create Needed Route', 'pline-v3-calendar-create-needed-route', '={{ $json.should_create }}', true, 'boolean', [-15244, 6000]),
  {
    parameters: {
      calendar,
      start: "={{ $('Normalize Input').first().json.start }}",
      end: "={{ $('Normalize Input').first().json.end }}",
      useDefaultReminders: true,
      additionalFields: {
        allday: "={{ $('Normalize Input').first().json.all_day ? 'yes' : 'no' }}",
        id: "={{ $('Normalize Input').first().json.event_reference }}",
        location: "={{ $('Normalize Input').first().json.location }}",
        sendUpdates: 'none',
        summary: "={{ $('Normalize Input').first().json.title }}",
      },
    },
    type: 'n8n-nodes-base.googleCalendar',
    typeVersion: 1.3,
    position: [-14944, 6000],
    id: 'pline-v3-calendar-create-event',
    name: 'Calendar Create Event',
    credentials: credential,
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      operation: 'get',
      calendar,
      eventId: "={{ $('Normalize Input').first().json.event_reference }}",
      options: { timeZone: timezone },
    },
    type: 'n8n-nodes-base.googleCalendar',
    typeVersion: 1.3,
    position: [-14644, 6000],
    id: 'pline-v3-calendar-terminal-readback',
    name: 'Calendar Terminal Readback',
    credentials: credential,
    onError: 'continueRegularOutput',
  },
  {
    parameters: { jsCode: verifyCode },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-14344, 6000],
    id: 'pline-v3-calendar-verify-readback',
    name: 'Calendar Verify Readback',
  },
];
workflow.nodes.push(...nodes);

if (!Array.isArray(priorNormalizeTargets) || priorNormalizeTargets.length !== 1) {
  throw new Error('unexpected Normalize Input topology');
}
workflow.connections['Normalize Input'] = { main: [[{ node: 'Calendar Create Route', type: 'main', index: 0 }]] };
workflow.connections['Calendar Create Route'] = {
  main: [
    [{ node: 'Calendar Read Existing', type: 'main', index: 0 }],
    priorNormalizeTargets,
  ],
};
workflow.connections['Calendar Read Existing'] = { main: [[{ node: 'Calendar Existing Decision', type: 'main', index: 0 }]] };
workflow.connections['Calendar Existing Decision'] = { main: [[{ node: 'Calendar Create Needed Route', type: 'main', index: 0 }]] };
workflow.connections['Calendar Create Needed Route'] = {
  main: [
    [{ node: 'Calendar Create Event', type: 'main', index: 0 }],
    [{ node: 'Respond to Webhook', type: 'main', index: 0 }],
  ],
};
workflow.connections['Calendar Create Event'] = { main: [[{ node: 'Calendar Terminal Readback', type: 'main', index: 0 }]] };
workflow.connections['Calendar Terminal Readback'] = { main: [[{ node: 'Calendar Verify Readback', type: 'main', index: 0 }]] };
workflow.connections['Calendar Verify Readback'] = { main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]] };

workflow.calendar_create_gate_contract = {
  gate: 'CALENDAR_CREATE_GATE',
  calendar_alias: 'authorized_test',
  calendar_backend: 'primary',
  alias_mapping: 'authorized_test_to_credential_primary',
  timezone: 'Asia/Taipei',
  direct_create_on_complete_input: true,
  terminal_readback_required: true,
  deterministic_event_reference: true,
  readback_before_retry: true,
  memo_nodes_changed: false,
};
workflow.workflow_version_name = 'Calendar Create authorized_test to primary Mapping';
workflow.pinData = {};
fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(JSON.stringify({
  nodes: workflow.nodes.length,
  connection_sources: Object.keys(workflow.connections).length,
  calendar_nodes: names.length,
}));
