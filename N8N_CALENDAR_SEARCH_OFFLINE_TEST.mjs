import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath = process.argv[2] || 'N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
const searchNames = ['Calendar Search Route', 'Calendar Search Events', 'Calendar Format Search'];

const expectedUpdateDelta = workflow.calendar_update_gate_contract ? 7 : 0;
const expectedDeleteDelta = workflow.calendar_delete_gate_contract ? 7 : 0;
assert.equal(workflow.nodes.length, 147 + expectedUpdateDelta + expectedDeleteDelta);
assert.equal(Object.keys(workflow.connections).length, 146 + expectedUpdateDelta + expectedDeleteDelta);
assert.deepEqual(workflow.pinData, {});
for (const name of searchNames) assert.ok(byName.has(name), `missing ${name}`);

const route = byName.get('Calendar Search Route');
const search = byName.get('Calendar Search Events');
const format = byName.get('Calendar Format Search');
assert.equal(route.type, 'n8n-nodes-base.if');
assert.equal(route.parameters.conditions.conditions[0].rightValue, 'calendar_search');
assert.equal(search.type, 'n8n-nodes-base.googleCalendar');
assert.equal(search.parameters.operation, 'getAll');
assert.equal(search.parameters.calendar.value, 'primary');
assert.equal(search.parameters.calendar.cachedResultName, 'primary');
assert.equal(search.parameters.returnAll, false);
assert.equal(search.parameters.limit.includes('max_results'), true);
assert.equal(search.parameters.timeMin.includes('time_min'), true);
assert.equal(search.parameters.timeMax.includes('time_max'), true);
assert.equal(search.parameters.options.query.includes('query'), true);
assert.equal(search.parameters.options.orderBy, 'startTime');
assert.equal(search.parameters.options.recurringEventHandling, 'expand');
assert.equal(search.parameters.options.showDeleted, false);
assert.equal(search.parameters.options.timeZone.value, 'Asia/Taipei');
assert.equal(search.alwaysOutputData, true);
assert.deepEqual(search.credentials, byName.get('Calendar Read Existing').credentials);
assert.equal(format.parameters.jsCode.includes("intent: 'calendar_search'"), true);
assert.equal(format.parameters.jsCode.includes("read_only: true"), true);
assert.equal(format.parameters.jsCode.includes('event_reference'), true);
assert.deepEqual(
  workflow.connections['Normalize Input'].main[0],
  [{ node: workflow.calendar_delete_gate_contract
    ? 'Calendar Delete Route'
    : workflow.calendar_update_gate_contract
      ? 'Calendar Update Route'
      : 'Calendar Search Route', type: 'main', index: 0 }],
);
assert.deepEqual(workflow.connections['Calendar Search Route'].main[0], [{ node: 'Calendar Search Events', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Search Route'].main[1], [{ node: 'Calendar Create Route', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Search Events'].main[0], [{ node: 'Calendar Format Search', type: 'main', index: 0 }]);
assert.deepEqual(workflow.connections['Calendar Format Search'].main[0], [{ node: 'Respond to Webhook', type: 'main', index: 0 }]);

const normalizeCode = byName.get('Normalize Input').parameters.jsCode;
assert.equal(normalizeCode.includes("if (rawIntent === 'calendar_search')"), true);
assert.equal(normalizeCode.includes("allowed_intents: ['calendar_search']"), true);
assert.equal(workflow.calendar_search_gate_contract.read_only, true);
assert.equal(workflow.calendar_search_gate_contract.actor_snapshot_ttl_seconds, 600);
assert.equal(workflow.calendar_search_gate_contract.calendar_write_effect, 0);
assert.equal(workflow.calendar_search_gate_contract.calendar_update_effect, 0);
assert.equal(workflow.calendar_search_gate_contract.calendar_delete_effect, 0);
assert.equal(workflow.calendar_search_gate_contract.retry_evidence_limitation, 'formal_same_webhook_live_replay_not_executed');

const serialized = JSON.stringify(workflow);
for (const forbidden of ['accessToken', 'refreshToken', 'clientSecret', 'replyToken', 'reply_token', 'user_id']) {
  assert.equal(serialized.includes(`"${forbidden}":`), false, `unsafe field ${forbidden}`);
}

const mutatingCalendarNodes = workflow.nodes.filter((node) =>
  node.type === 'n8n-nodes-base.googleCalendar'
  && ['create', 'update', 'delete'].includes(String(node.parameters?.operation || 'create'))
  && node.name.startsWith('Calendar Search'),
);
assert.equal(mutatingCalendarNodes.length, 0);

console.log('N8N_CALENDAR_SEARCH_OFFLINE_TEST PASS 38/38');
