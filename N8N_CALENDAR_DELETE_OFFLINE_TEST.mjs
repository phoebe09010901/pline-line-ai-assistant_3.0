import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath = process.argv[2] || 'N8N_WORKFLOW_PLINE_V3_CALENDAR_DELETE_TOMBSTONE_FIX_LUNA_IMPORT.json';
const baselinePath = process.argv[3] || 'N8N_WORKFLOW_PLINE_V3_CALENDAR_UPDATE_LUNA_IMPORT.json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
const names = [
  'Calendar Delete Route',
  'Calendar Delete Read Existing',
  'Calendar Delete Inspect Existing',
  'Calendar Delete Needed Route',
  'Calendar Delete Event',
  'Calendar Delete Terminal Readback',
  'Calendar Delete Verify Absence',
];
for (const name of names) assert.ok(byName.has(name), `missing ${name}`);

assert.equal(workflow.nodes.length, baseline.nodes.length + names.length);
const baselineOpenAi = baseline.nodes.find((node) => node.name === 'OpenAI Chat Model');
const deleteOpenAi = byName.get('OpenAI Chat Model');
assert.equal(JSON.stringify(deleteOpenAi), JSON.stringify(baselineOpenAi));
assert.equal(deleteOpenAi.parameters.model.value, 'gpt-5.6-luna');
assert.equal(deleteOpenAi.parameters.options.temperature, 0.1);
assert.ok(deleteOpenAi.credentials);
assert.equal(JSON.stringify(workflow.pinData), JSON.stringify(baseline.pinData));

const deleteNode = byName.get('Calendar Delete Event');
assert.equal(deleteNode.parameters.operation, 'delete');
assert.equal(deleteNode.parameters.calendar.value, 'primary');
assert.equal(deleteNode.parameters.options.sendUpdates, 'none');
assert.equal(deleteNode.alwaysOutputData, true);
assert.equal(deleteNode.credentials.googleCalendarOAuth2Api.name, byName.get('Calendar Update Event').credentials.googleCalendarOAuth2Api.name);
assert.equal(byName.get('Calendar Delete Read Existing').parameters.operation, 'get');
assert.equal(byName.get('Calendar Delete Terminal Readback').parameters.operation, 'get');
assert.match(byName.get('Calendar Delete Inspect Existing').parameters.jsCode, /originalMatches/);
assert.match(byName.get('Calendar Delete Inspect Existing').parameters.jsCode, /safe_to_delete/);
assert.match(byName.get('Calendar Delete Inspect Existing').parameters.jsCode, /cancelledTombstone/);
assert.match(byName.get('Calendar Delete Verify Absence').parameters.jsCode, /readback_verified/);
assert.match(byName.get('Calendar Delete Verify Absence').parameters.jsCode, /statusCode === 404/);
assert.match(byName.get('Calendar Delete Verify Absence').parameters.jsCode, /cancelledTombstone/);
assert.match(byName.get('Calendar Delete Verify Absence').parameters.jsCode, /eligibleAbsence/);
assert.match(byName.get('Calendar Delete Verify Absence').parameters.jsCode, /calendar_delete_candidate_missing_or_changed/);
assert.match(byName.get('Normalize Input').parameters.jsCode, /rawIntent === 'calendar_delete'/);

assert.deepEqual(workflow.connections['Normalize Input'].main[0], [{ node: 'Calendar Delete Route', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Delete Route'].main[1], [{ node: 'Calendar Update Route', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Delete Needed Route'].main[0], [{ node: 'Calendar Delete Event', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Delete Needed Route'].main[1], [{ node: 'Calendar Delete Terminal Readback', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Delete Event'].main[0], [{ node: 'Calendar Delete Terminal Readback', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Delete Verify Absence'].main[0], [{ node: 'Respond to Webhook', type: 'main', index: 0 }]);

assert.equal(workflow.calendar_delete_gate_contract.actor_pending_ttl_seconds, 600);
assert.equal(workflow.calendar_delete_gate_contract.confirmation_required, true);
assert.equal(workflow.calendar_delete_gate_contract.unbounded_delete_allowed, false);
assert.equal(workflow.calendar_delete_gate_contract.original_candidate_match_required, true);
assert.equal(workflow.calendar_delete_gate_contract.terminal_absence_readback_required, true);
assert.deepEqual(workflow.calendar_delete_gate_contract.terminal_absence_states, ['404', 'not_found', 'cancelled_tombstone']);
assert.equal(workflow.calendar_delete_gate_contract.candidate_missing_or_changed_fail_closed, true);
assert.equal(workflow.calendar_delete_gate_contract.successful_absence_requires_delete_attempt_or_readback_only, true);
assert.equal(workflow.calendar_delete_gate_contract.retry_evidence_limitation, 'formal_same_webhook_live_replay_not_executed');

const baselineNodes = new Map(baseline.nodes.map((node) => [node.name, node]));
for (const [name, node] of baselineNodes) {
  if (name === 'Normalize Input') continue;
  assert.equal(JSON.stringify(byName.get(name)), JSON.stringify(node), `baseline node changed: ${name}`);
}
for (const [name, connection] of Object.entries(baseline.connections)) {
  if (name === 'Normalize Input') continue;
  assert.equal(JSON.stringify(workflow.connections[name]), JSON.stringify(connection), `baseline connection changed: ${name}`);
}
assert.equal(JSON.stringify(workflow).includes('formal_same_webhook_live_replay_not_executed'), true);
console.log('calendar delete n8n offline checks: PASS');
