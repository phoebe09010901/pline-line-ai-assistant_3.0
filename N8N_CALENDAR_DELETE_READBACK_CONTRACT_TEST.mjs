import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath = process.argv[2] || 'N8N_WORKFLOW_PLINE_V3_CALENDAR_DELETE_TOMBSTONE_FIX_LUNA_IMPORT.json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const verifyNode = workflow.nodes.find((node) => node.name === 'Calendar Delete Verify Absence');
assert.ok(verifyNode, 'missing Calendar Delete Verify Absence');

function runVerify(event, inspected) {
  const normalized = {
    request_id: 'calendar-delete-request-local-contract',
    intent: 'calendar_delete',
  };
  const nodeLookup = (name) => ({
    first() {
      if (name === 'Normalize Input') return { json: normalized };
      if (name === 'Calendar Delete Inspect Existing') return { json: inspected };
      throw new Error(`unexpected node lookup: ${name}`);
    },
  });
  const execute = new Function('$', '$json', verifyNode.parameters.jsCode);
  return execute(nodeLookup, event)[0].json;
}

const deletedTombstone = runVerify(
  { id: 'local-event-reference', status: 'cancelled' },
  { safe_to_delete: true, readback_only: false },
);
assert.equal(deletedTombstone.status, 'completed');
assert.equal(deletedTombstone.readback_verified, true);
assert.equal(deletedTombstone.exists, false);

const readbackOnlyTombstone = runVerify(
  { id: 'local-event-reference', status: 'cancelled' },
  { safe_to_delete: false, readback_only: true },
);
assert.equal(readbackOnlyTombstone.status, 'completed');
assert.equal(readbackOnlyTombstone.exists, false);

const missingBeforeDelete = runVerify(
  { id: 'local-event-reference', status: 'cancelled' },
  { safe_to_delete: false, readback_only: false },
);
assert.equal(missingBeforeDelete.status, 'failed');
assert.equal(missingBeforeDelete.reason, 'calendar_delete_candidate_missing_or_changed');
assert.equal(missingBeforeDelete.readback_verified, false);

const goneAfterDelete = runVerify(
  { statusCode: 404, message: 'not found' },
  { safe_to_delete: true, readback_only: false },
);
assert.equal(goneAfterDelete.status, 'completed');
assert.equal(goneAfterDelete.exists, false);

const stillActive = runVerify(
  { id: 'local-event-reference', status: 'confirmed' },
  { safe_to_delete: true, readback_only: false },
);
assert.equal(stillActive.status, 'failed');
assert.equal(stillActive.reason, 'calendar_delete_readback_still_exists');
assert.equal(stillActive.exists, true);

const unknown = runVerify(
  {},
  { safe_to_delete: true, readback_only: false },
);
assert.equal(unknown.status, 'failed');
assert.equal(unknown.reason, 'calendar_delete_readback_unverified');
assert.equal(unknown.readback_verified, false);

console.log('calendar delete terminal readback contract: 6/6 PASS');
