import test from "node:test";
import assert from "node:assert/strict";
import { executeOnce } from "./trading-execution.ts";
const preview = { clientOrderId: "stable-client-id", expiresAt: new Date(100_000).toISOString() };
const order = { id: "exchange-order", clientOrderId: preview.clientOrderId };
function scenario(failure) {
  let record = null, sends = 0, claims = 0;
  const options = { preview, now: () => 1000,
    lookup: async () => record,
    claim: async () => { claims++; if (record) return false; record = { status: "submitting" }; return true; },
    save: async (status, orderId) => { record = { status, orderId }; return true; },
    send: async () => { sends++; if (failure) throw failure; return order; },
    reconcile: async (row) => ({ status: row.status === "submitting" ? "unknown" : row.status, order: row.status === "accepted" ? order : null, clientOrderId: preview.clientOrderId, message: "Reconciled only" }),
    rejectionMessage: (error) => error.definitive ? "Exchange rejected" : null,
    blockedError: () => new Error("blocked"),
  };
  return { options, stats: () => ({ record, sends, claims }) };
}
test("accepted submission is sent once; repeated confirmation only reconciles", async () => {
  const s = scenario();
  assert.equal((await executeOnce(s.options)).status, "accepted");
  assert.equal((await executeOnce(s.options)).status, "accepted");
  assert.equal(s.stats().sends, 1); assert.equal(s.stats().claims, 1);
});
test("unknown network outcome retains lock and same ID; no blind resubmission", async () => {
  const s = scenario(new Error("timeout"));
  assert.equal((await executeOnce(s.options)).status, "unknown");
  assert.equal((await executeOnce(s.options)).status, "unknown");
  assert.equal(s.stats().record.status, "unknown"); assert.equal(s.stats().sends, 1);
});
test("explicit rejection is durable and is never sent again", async () => {
  const s = scenario(Object.assign(new Error("400"), { definitive: true }));
  assert.equal((await executeOnce(s.options)).status, "rejected");
  assert.equal((await executeOnce(s.options)).status, "rejected");
  assert.equal(s.stats().sends, 1);
});
test("concurrent confirmations compete for one durable claim", async () => {
  const s = scenario();
  await Promise.all([executeOnce(s.options), executeOnce(s.options)]);
  assert.equal(s.stats().sends, 1);
});
test("expired review after claim is rejected without an exchange write", async () => {
  const s = scenario(); s.options.now = () => 100_000;
  assert.equal((await executeOnce(s.options)).status, "rejected");
  assert.equal(s.stats().sends, 0); assert.equal(s.stats().record.status, "rejected");
});
test("unavailable ledger or another unresolved submission blocks writes", async () => {
  const s = scenario(); s.options.claim = async () => false;
  await assert.rejects(executeOnce(s.options), /blocked/);
  assert.equal(s.stats().sends, 0);
});
test("failed persistence of rejection stays uncertain and cannot trigger a second send", async () => {
  const s = scenario(Object.assign(new Error("400"), { definitive: true })); s.options.save = async () => false;
  assert.equal((await executeOnce(s.options)).status, "unknown");
  assert.equal((await executeOnce(s.options)).status, "unknown");
  assert.equal(s.stats().sends, 1);
});
