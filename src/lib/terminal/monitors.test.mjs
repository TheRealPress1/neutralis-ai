import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateMonitors, restoreMonitors } from "./monitors.ts";

const now = Date.parse("2026-10-15T12:00:00Z");
const monitor = { id: "1", ticker: "TEST", title: "Test", direction: "above", threshold: .5, state: "watching", createdAt: new Date(now).toISOString(), lastCheckedAt: null, triggeredAt: null, observedPrice: null };
const quote = { ticker: "TEST", status: "live", lastPrice: .5, updatedAt: new Date(now).toISOString() };
test("monitors trigger once at the inclusive threshold and never act on stale quotes", () => {
  const result = evaluateMonitors([monitor], [quote], now)[0];
  assert.equal(result.state, "triggered");
  assert.equal(result.observedPrice, .5);
  assert.equal(evaluateMonitors([result], [{...quote, lastPrice: .1}], now)[0], result);
  for (const changed of [{status:"stale"}, {lastPrice:null}, {lastPrice:NaN}, {updatedAt:new Date(now-46_000).toISOString()}, {updatedAt:"bad"}]) {
    assert.equal(evaluateMonitors([monitor], [{...quote,...changed}], now)[0], monitor);
  }
});
test("paused monitors stay paused; below conditions and duplicate observations are respected", () => {
  const paused = {...monitor,state:"paused"};
  assert.equal(evaluateMonitors([paused],[quote],now)[0],paused);
  assert.equal(evaluateMonitors([{...monitor,direction:"below"}],[{...quote,lastPrice:.49}],now)[0].state,"triggered");
  const checked = {...monitor,lastCheckedAt:quote.updatedAt};
  assert.equal(evaluateMonitors([checked],[quote],now)[0],checked);
});
test("restored monitors require explicit resume and malformed browser storage is ignored", () => {
  assert.equal(restoreMonitors([monitor])[0].state,"paused");
  assert.deepEqual(restoreMonitors(null),[]);
  assert.deepEqual(restoreMonitors([{...monitor,threshold:2},null]),[]);
});
test("a selected market's older detail never shadows a fresher list quote", () => {
  const old = {...quote,lastPrice:.1,updatedAt:new Date(now-20_000).toISOString()};
  assert.equal(evaluateMonitors([monitor],[quote,old],now)[0].state,"triggered");
  assert.equal(evaluateMonitors([monitor],[quote,{...old,status:"stale"}],now)[0].state,"triggered");
});
