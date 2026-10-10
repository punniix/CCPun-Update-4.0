import assert from "node:assert/strict";
import test from "node:test";
import { classifyN8nReceipt } from "../../lib/admin/n8n/receipt-policy";
test("P1 n8n monitoring cannot turn upstream 401 into a green success", () => {
  assert.equal(classifyN8nReceipt({httpStatus:200,upstreamStatus:401,executionState:"success",receiptVerified:true}),"failed");
  assert.equal(classifyN8nReceipt({httpStatus:200,upstreamStatus:503,executionState:"success",receiptVerified:true}),"degraded");
  assert.equal(classifyN8nReceipt({httpStatus:200,upstreamStatus:200,executionState:"success",receiptVerified:false}),"degraded");
  assert.equal(classifyN8nReceipt({httpStatus:200,upstreamStatus:200,executionState:"success",receiptVerified:true}),"verified");
  assert.equal(classifyN8nReceipt({httpStatus:null,upstreamStatus:null}),"degraded");
});
