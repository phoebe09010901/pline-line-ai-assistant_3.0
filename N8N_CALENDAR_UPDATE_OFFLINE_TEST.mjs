import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath = process.argv[2] || 'N8N_WORKFLOW_PLINE_V3_CALENDAR_UPDATE_LUNA_IMPORT.json';
const baselinePath = process.argv[3] || 'N8N_WORKFLOW_PLINE_V3_CALENDAR_SEARCH_LUNA_IMPORT.json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
const names = [
  'Calendar Update Route',
  'Calendar Update Read Existing',
  'Calendar Update Inspect Existing',
  'Calendar Update Needed Route',
  'Calendar Update Event',
  'Calendar Update Terminal Readback',
  'Calendar Update Verify Readback',
];
for (const name of names) assert.ok(byName.has(name), `missing ${name}`);
const baselineOpenAi = baseline.nodes.find((node) => node.name === 'OpenAI Chat Model');
const updateOpenAi = byName.get('OpenAI Chat Model');
assert.equal(JSON.stringify(updateOpenAi), JSON.stringify(baselineOpenAi));
assert.equal(updateOpenAi.parameters.model.value, 'gpt-5.6-luna');
assert.equal(updateOpenAi.parameters.options.temperature, 0.1);
assert.ok(updateOpenAi.credentials);
assert.equal(JSON.stringify(workflow.pinData), JSON.stringify(baseline.pinData));

const update = byName.get('Calendar Update Event');
assert.equal(update.parameters.operation, 'update');
assert.equal(update.parameters.calendar.value, 'primary');
assert.equal(update.parameters.modifyTarget, 'instance');
assert.equal(update.parameters.updateFields.sendUpdates, 'none');
assert.equal(update.credentials.googleCalendarOAuth2Api.name, byName.get('Calendar Search Events').credentials.googleCalendarOAuth2Api.name);
assert.equal(byName.get('Calendar Update Read Existing').parameters.operation, 'get');
assert.equal(byName.get('Calendar Update Terminal Readback').parameters.operation, 'get');
assert.match(byName.get('Calendar Update Inspect Existing').parameters.jsCode, /originalMatches/);
assert.match(byName.get('Calendar Update Inspect Existing').parameters.jsCode, /safe_to_update/);
assert.match(byName.get('Calendar Update Verify Readback').parameters.jsCode, /readback_verified/);
assert.match(byName.get('Normalize Input').parameters.jsCode, /rawIntent === 'calendar_update'/);

assert.deepEqual(workflow.connections['Normalize Input'].main[0], [{
  node: workflow.calendar_delete_gate_contract ? 'Calendar Delete Route' : 'Calendar Update Route',
  type: 'main',
  index: 0,
}]);
assert.deepEqual(workflow.connections['Calendar Update Route'].main[1], [{ node: 'Calendar Search Route', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Update Needed Route'].main[0], [{ node: 'Calendar Update Event', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Update Needed Route'].main[1], [{ node: 'Calendar Update Terminal Readback', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Update Event'].main[0], [{ node: 'Calendar Update Terminal Readback', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Update Verify Readback'].main[0], [{ node: 'Respond to Webhook', type: 'main', index: 0 }]);

assert.equal(workflow.calendar_update_gate_contract.actor_pending_ttl_seconds, 600);
assert.equal(workflow.calendar_update_gate_contract.confirmation_required, true);
assert.equal(workflow.calendar_update_gate_contract.original_candidate_match_required, true);
assert.equal(workflow.calendar_update_gate_contract.terminal_readback_required, true);
assert.equal(workflow.calendar_update_gate_contract.calendar_delete_effect, 0);
assert.equal(workflow.calendar_update_gate_contract.retry_evidence_limitation, 'formal_same_webhook_live_replay_not_executed');

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
console.log('calendar update n8n offline checks: PASS');
