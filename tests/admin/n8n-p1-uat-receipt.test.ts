import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {readScopedUatAck} from '../../lib/admin/n8n/uat-receipt';
const jobId='6bb54293-6bc6-4001-966e-810f20c6fb30';
const correlationId='aa46c9fa-a39e-43cc-bbbb-e4ceafbf6dbc';
const expected={jobId,correlationId};
const receipt={accepted:true,receiptVerified:true,environment:'admin-uat',jobId,correlationId,n8nExecutionId:'53701'};
test('UAT receipt is bound to both UUIDs and an actual n8n execution',()=>{
  assert.deepEqual(readScopedUatAck(receipt,expected),receipt);
  assert.equal(readScopedUatAck({...receipt,jobId:'00000000-0000-4000-8000-000000000001'},expected),null);
  assert.equal(readScopedUatAck({...receipt,correlationId:'00000000-0000-4000-8000-000000000001'},expected),null);
  assert.equal(readScopedUatAck({...receipt,environment:'production-admin'},expected),null);
  assert.equal(readScopedUatAck({...receipt,receiptVerified:false},expected),null);
  assert.equal(readScopedUatAck({...receipt,n8nExecutionId:'0'},expected),null);
  assert.equal(readScopedUatAck({...receipt,customerName:'sensitive'},expected),null);
});
test('UAT ingress marks a durable waiting job before asynchronous n8n dispatch',()=>{
  const route=readFileSync(new URL('../../apps/admin/app/api/admin/n8n/p1/seo/route.ts',import.meta.url),'utf8');
  assert.match(route,/idempotency-key-required/);
  assert.match(route,/idempotency_conflict/);
  assert.match(route,/job\.outcome==="duplicate"/);
  assert.match(route,/status:"waiting_external",stage:"n8n-dispatching"/);
  assert.match(route,/dispatchState\?\.outcome!=="updated"/);
  assert.match(route,/expectedVersion:dispatchState\.rowVersion/);
  assert.match(route,/status:"queued"/);
  assert.doesNotMatch(route,/readScopedUatAck|n8nExecutionId:ack|status:"completed"/);
});
