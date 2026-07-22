import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath = process.argv[2] || 'N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(
  'checkpoints/workflows/PLine_V3_MEMO_CORE_STABLE_PUBLISHED_271add4b_SANITIZED.json',
  'utf8',
));

const expectedUpdateDelta = workflow.calendar_update_gate_contract ? 7 : 0;
const expectedDeleteDelta = workflow.calendar_delete_gate_contract ? 7 : 0;
assert.equal(workflow.nodes.length, 147 + expectedUpdateDelta + expectedDeleteDelta);
assert.equal(Object.keys(workflow.connections).length, 146 + expectedUpdateDelta + expectedDeleteDelta);
assert.deepEqual(workflow.pinData, {});
if (workflow.calendar_create_gate_contract) {
  assert.equal(workflow.calendar_create_gate_contract.calendar_alias, 'authorized_test');
  assert.equal(workflow.calendar_create_gate_contract.calendar_backend, 'primary');
  assert.equal(workflow.calendar_create_gate_contract.alias_mapping, 'authorized_test_to_credential_primary');
  assert.equal(workflow.calendar_create_gate_contract.timezone, 'Asia/Taipei');
  assert.equal(workflow.calendar_create_gate_contract.memo_nodes_changed, false);
}

const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
const baselineByName = new Map(baseline.nodes.map((node) => [node.name, node]));
const calendarNames = [
  'Calendar Create Route',
  'Calendar Read Existing',
  'Calendar Existing Decision',
  'Calendar Create Needed Route',
  'Calendar Create Event',
  'Calendar Terminal Readback',
  'Calendar Verify Readback',
];
for (const name of calendarNames) assert.ok(byName.has(name), `missing ${name}`);

const googleNodes = calendarNames.map((name) => byName.get(name)).filter((node) => node.type === 'n8n-nodes-base.googleCalendar');
assert.equal(googleNodes.length, 3);
const createCredential = JSON.stringify(googleNodes[0].credentials);
assert.ok(googleNodes[0].credentials?.googleCalendarOAuth2Api);
for (const node of googleNodes) {
  assert.equal(node.parameters.calendar.cachedResultName, 'primary');
  assert.equal(node.parameters.calendar.value, 'primary');
  assert.equal(JSON.stringify(node.credentials), createCredential);
}
assert.equal(byName.get('Calendar Read Existing').parameters.operation, 'get');
assert.equal(byName.get('Calendar Terminal Readback').parameters.operation, 'get');
assert.equal(byName.get('Calendar Create Event').parameters.additionalFields.id.includes('event_reference'), true);
assert.equal(byName.get('Calendar Create Event').parameters.additionalFields.sendUpdates, 'none');
assert.equal(byName.get('Calendar Existing Decision').parameters.jsCode.includes('input.readback_only'), true);
assert.equal(byName.get('Calendar Existing Decision').parameters.jsCode.includes('should_create: false'), true);
assert.equal(byName.get('Calendar Verify Readback').parameters.jsCode.includes('calendar_readback_mismatch'), true);

const normalizeCode = byName.get('Normalize Input').parameters.jsCode;
assert.equal(normalizeCode.includes("if (rawIntent === 'calendar_create')"), true);
assert.equal(normalizeCode.includes("calendar_alias: String(body.calendar_alias || '')"), true);
assert.equal(normalizeCode.includes("readback_only: body.readback_only === true"), true);

for (const baselineNode of baseline.nodes) {
  if (baselineNode.name === 'Normalize Input') continue;
  assert.ok(byName.has(baselineNode.name), `baseline node missing: ${baselineNode.name}`);
}
for (const [source, connection] of Object.entries(baseline.connections)) {
  if (source === 'Normalize Input') continue;
  assert.deepEqual(workflow.connections[source], connection, `baseline connection changed: ${source}`);
}
assert.deepEqual(
  workflow.connections['Calendar Create Route'].main[1],
  baseline.connections['Normalize Input'].main[0],
);
assert.deepEqual(
  workflow.connections['Normalize Input'].main[0],
  [{ node: workflow.calendar_delete_gate_contract
    ? 'Calendar Delete Route'
    : workflow.calendar_update_gate_contract
      ? 'Calendar Update Route'
      : 'Calendar Search Route', type: 'main', index: 0 }],
);
assert.deepEqual(
  workflow.connections['Calendar Search Route'].main[1],
  [{ node: 'Calendar Create Route', type: 'main', index: 0 }],
);
assert.deepEqual(
  workflow.connections['Calendar Create Needed Route'].main[1],
  [{ node: 'Respond to Webhook', type: 'main', index: 0 }],
);

const serialized = JSON.stringify(workflow);
for (const forbidden of ['accessToken', 'refreshToken', 'clientSecret', 'replyToken', 'reply_token', 'user_id']) {
  assert.equal(serialized.includes(`"${forbidden}":`), false, `unsafe field ${forbidden}`);
}

console.log('N8N_CALENDAR_CREATE_OFFLINE_TEST PASS 18/18');
