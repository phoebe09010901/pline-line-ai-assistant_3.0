import fs from 'node:fs';

const workflowPath = process.argv[2] || 'N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const outputPath = process.argv[3] || workflowPath;
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const names = ['Calendar Search Route', 'Calendar Search Events', 'Calendar Format Search'];

const frozenOpenAi = workflow.nodes.find((node) => node.name === 'OpenAI Chat Model');
if (!frozenOpenAi) throw new Error('missing frozen OpenAI Chat Model');
const frozenOpenAiJson = JSON.stringify(frozenOpenAi);
const frozenModel = frozenOpenAi.parameters?.model?.value || frozenOpenAi.parameters?.model;
if (frozenModel !== 'gpt-5.6-luna') {
  throw new Error(`refusing to overwrite frozen OpenAI model: ${String(frozenModel)}`);
}

const currentNormalizeTargets = workflow.connections['Normalize Input']?.main?.[0];
const currentSearchFalseTargets = workflow.connections['Calendar Search Route']?.main?.[1];
const priorNormalizeTargets = currentNormalizeTargets?.[0]?.node === 'Calendar Search Route'
  ? currentSearchFalseTargets
  : currentNormalizeTargets;
workflow.nodes = workflow.nodes.filter((node) => !names.includes(node.name));
for (const name of names) delete workflow.connections[name];

const normalize = workflow.nodes.find((node) => node.name === 'Normalize Input');
if (!normalize) throw new Error('missing Normalize Input');
const normalizeCode = `if (rawIntent === 'calendar_search') {
  return [{ json: {
    intent: 'calendar_search',
    request_id: String(body.request_id || ''),
    safe_event_hash: String(body.safe_event_hash || '').trim().toLowerCase(),
    calendar_alias: String(body.calendar_alias || ''),
    timezone: String(body.timezone || ''),
    scope: String(body.scope || ''),
    query: String(body.query || '').trim().slice(0, 120),
    time_min: String(body.time_min || '').trim(),
    time_max: String(body.time_max || '').trim(),
    max_results: Math.min(Math.max(Number(body.max_results || 10), 1), 10),
    allowed_intents: ['calendar_search'],
    read_only: true
  } }];
}
`;
if (!normalize.parameters.jsCode.includes("if (rawIntent === 'calendar_search')")) {
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
    "if (rawIntent === 'calendar_create') {",
    `${normalizeCode}\nif (rawIntent === 'calendar_create') {`,
  );
}

const routeNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'pline-v3-calendar-search-route-condition',
        leftValue: '={{ $json.intent }}',
        rightValue: 'calendar_search',
        operator: { type: 'string', operation: 'equals' },
      }],
      combinator: 'and',
    },
    options: {},
  },
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [-16444, 5700],
  id: 'pline-v3-calendar-search-route',
  name: 'Calendar Search Route',
};

const calendar = { __rl: true, value: 'primary', mode: 'list', cachedResultName: 'primary' };
const credentialSource = workflow.nodes.find((node) =>
  ['Calendar Read Existing', 'Calendar Create Event', 'Calendar Terminal Readback'].includes(node.name)
  && node.credentials?.googleCalendarOAuth2Api
);
if (!credentialSource) throw new Error('missing bound Google Calendar credential');
const credential = JSON.parse(JSON.stringify(credentialSource.credentials));
const timezone = { __rl: true, value: 'Asia/Taipei', mode: 'id' };
const searchNode = {
  parameters: {
    operation: 'getAll',
    calendar,
    returnAll: false,
    limit: "={{ $('Normalize Input').first().json.max_results }}",
    timeMin: "={{ $('Normalize Input').first().json.time_min || $now.minus({ years: 5 }).toISO() }}",
    timeMax: "={{ $('Normalize Input').first().json.time_max || $now.plus({ years: 5 }).toISO() }}",
    options: {
      orderBy: 'startTime',
      query: "={{ $('Normalize Input').first().json.query }}",
      recurringEventHandling: 'expand',
      showDeleted: false,
      timeZone: timezone,
    },
  },
  type: 'n8n-nodes-base.googleCalendar',
  typeVersion: 1.3,
  position: [-16144, 5700],
  id: 'pline-v3-calendar-search-events',
  name: 'Calendar Search Events',
  credentials: credential,
  alwaysOutputData: true,
  onError: 'continueRegularOutput',
};

const formatCode = `const input = $('Normalize Input').first().json;
const raw = $input.all().map((item) => item.json || {});
const errorItem = raw.find((event) => event.error || event.errorMessage || event.code >= 400);
if (errorItem) {
  return [{ json: {
    request_id: input.request_id,
    intent: 'calendar_search',
    status: 'failed',
    reason: 'calendar_search_api_failed',
    read_only: true,
    candidates: []
  } }];
}
const candidates = raw
  .filter((event) => event.id && event.status !== 'cancelled')
  .map((event) => {
    const allDay = Boolean(event.start?.date && !event.start?.dateTime);
    return {
      event_reference: String(event.id),
      title: String(event.summary || '(未命名行程)').slice(0, 200),
      location: String(event.location || '').slice(0, 200),
      all_day: allDay,
      start: allDay ? String(event.start.date || '') : String(event.start?.dateTime || ''),
      end: allDay ? String(event.end?.date || '') : String(event.end?.dateTime || '')
    };
  })
  .slice(0, input.max_results);
return [{ json: {
  request_id: input.request_id,
  intent: 'calendar_search',
  status: 'completed',
  reason: '',
  read_only: true,
  candidates
} }];`;
const formatNode = {
  parameters: { jsCode: formatCode },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-15844, 5700],
  id: 'pline-v3-calendar-format-search',
  name: 'Calendar Format Search',
};

if (!Array.isArray(priorNormalizeTargets) || priorNormalizeTargets.length !== 1) {
  throw new Error('unexpected Normalize Input topology');
}
workflow.nodes.push(routeNode, searchNode, formatNode);
workflow.connections['Normalize Input'] = { main: [[{ node: 'Calendar Search Route', type: 'main', index: 0 }]] };
workflow.connections['Calendar Search Route'] = {
  main: [
    [{ node: 'Calendar Search Events', type: 'main', index: 0 }],
    priorNormalizeTargets,
  ],
};
workflow.connections['Calendar Search Events'] = { main: [[{ node: 'Calendar Format Search', type: 'main', index: 0 }]] };
workflow.connections['Calendar Format Search'] = { main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]] };

workflow.calendar_search_gate_contract = {
  gate: 'CALENDAR_SEARCH_GATE',
  calendar_alias: 'authorized_test',
  calendar_backend: 'primary',
  timezone: 'Asia/Taipei',
  operation: 'getAll',
  read_only: true,
  max_results: 10,
  actor_snapshot_ttl_seconds: 600,
  calendar_write_effect: 0,
  calendar_update_effect: 0,
  calendar_delete_effect: 0,
  create_nodes_changed: false,
  memo_nodes_changed: false,
  retry_evidence_limitation: 'formal_same_webhook_live_replay_not_executed',
};
workflow.workflow_version_name = 'Calendar Search Read Only Snapshot Gate';
if (JSON.stringify(workflow.nodes.find((node) => node.name === 'OpenAI Chat Model')) !== frozenOpenAiJson) {
  throw new Error('frozen OpenAI Chat Model changed during Search merge');
}
fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(JSON.stringify({
  output: outputPath,
  nodes: workflow.nodes.length,
  connection_sources: Object.keys(workflow.connections).length,
  calendar_search_nodes: names.length,
  openai_core_model_status: 'preserved_gpt-5.6-luna',
}));
