import { readFileSync, writeFileSync } from 'node:fs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('usage: node N8N_SANITIZE_WORKFLOW_EXPORT.mjs input.json output.json');

const workflow = JSON.parse(readFileSync(inputPath, 'utf8'));
for (const node of workflow.nodes || []) {
  if (!node.credentials || typeof node.credentials !== 'object') continue;
  node.credentials = Object.fromEntries(Object.keys(node.credentials).map((type) => [type, { redacted: true }]));
}
workflow.pinData = {};
if (workflow.staticData && typeof workflow.staticData === 'object') workflow.staticData = null;
writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n');

const serialized = JSON.stringify(workflow);
for (const forbidden of ['accessToken', 'refreshToken', 'clientSecret', 'replyToken', 'reply_token', 'user_id']) {
  if (serialized.includes(`"${forbidden}":`)) throw new Error(`unsafe workflow export field: ${forbidden}`);
}
console.log(`SANITIZED ${workflow.nodes?.length || 0} nodes`);
