import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real server actions with an in-memory service-client boundary.
// No Supabase session, service credential, or network is used.
const source = ts.transpileModule(readFileSync(new URL("../src/app/actions/dashboard.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(initialRows = [], user = { id: "alice" }) {
  const rows = structuredClone(initialRows);
  const operations = [];
  let serviceCalls = 0;
  const service = {
    from(table) {
      assert.equal(table, "risk_profiles");
      const filters = [];
      let patch;
      let inserted;
      const query = {
        select() { return query; },
        limit() { return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        is(key, value) { filters.push(row => row[key] === value); return query; },
        update(values) { patch = values; return query; },
        insert(values) { inserted = values; return query; },
        async maybeSingle() { return query.single(); },
        async single() {
          if (inserted) {
            const row = { id: Math.max(0, ...rows.map(row => row.id)) + 1, ...inserted };
            operations.push({ kind: "insert", values: inserted });
            rows.push(row);
            return { data: structuredClone(row), error: null };
          }
          const row = rows.find(row => filters.every(matches => matches(row)));
          if (row && patch) {
            operations.push({ kind: "update", id: row.id, values: patch });
            Object.assign(row, patch);
          }
          return { data: row ? structuredClone(row) : null, error: null };
        },
      };
      return query;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports) { ${source}\n})`, {})((id) => {
    if (id === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) };
    if (id === "@/lib/supabase/service") return { createServiceClient: () => { serviceCalls++; return service; } };
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  return { actions: module.exports, rows, operations, serviceCalls: () => serviceCalls };
}

const profile = (id, userId) => ({ id, user_id: userId, is_active: true, name: "Conservative", preset: "conservative", min_time_to_expiry_hours: 1, max_time_to_expiry_hours: 48, max_position_dollars: 20, min_edge_pct: 2 });

test("risk actions require authentication before using the service client", async () => {
  const h = harness([profile(1, null)], null);
  assert.equal((await h.actions.getActiveRiskProfile()).error, "Unauthorized");
  assert.equal((await h.actions.updateRiskProfile(1, { min_edge_pct: 4 })).error, "Unauthorized");
  assert.equal(h.serviceCalls(), 0);
});

test("active profile lookup returns only the signed-in user's profile", async () => {
  const h = harness([profile(1, "bob"), profile(2, null), profile(3, "alice")]);
  assert.equal((await h.actions.getActiveRiskProfile()).data.id, 3);
  assert.equal(h.operations.length, 0);
});

test("a shared default becomes a personal profile without copying ownership or identifiers", async () => {
  const h = harness([{ ...profile(2, null), created_at: "old", unexpected_column: "never copy" }]);
  const result = await h.actions.getActiveRiskProfile();
  assert.equal(result.data.user_id, "alice");
  assert.equal(result.data.id, 3);
  assert.equal(result.data.is_active, true);
  assert.equal(result.data.max_position_dollars, 20);
  assert.equal(result.data.created_at, undefined);
  assert.equal(result.data.unexpected_column, undefined);
  assert.equal(h.rows[0].user_id, null);
  assert.equal((await h.actions.getActiveRiskProfile()).data.id, 3);
  assert.equal(h.operations.length, 1);
});

test("updates cannot mutate another user's profile or the shared preset", async () => {
  const h = harness([profile(1, "bob"), profile(2, null)]);
  for (const id of [1, 2]) assert.equal((await h.actions.updateRiskProfile(id, { max_position_dollars: 99 })).error, "Risk profile not found");
  assert.equal(h.operations.length, 0);
});

test("runtime allowlist rejects ownership, activation, metadata, and prototype keys", async () => {
  const h = harness([profile(1, "alice")]);
  for (const key of ["user_id", "id", "is_active", "preset", "created_at", "updated_at", "constructor", "__proto__"]) {
    assert.equal((await h.actions.updateRiskProfile(1, { [key]: 3 })).error, "Unsupported risk setting");
  }
  assert.equal(h.operations.length, 0);
});

test("risk numbers are finite and bounded, and expiry constraints use the saved other bound", async () => {
  const h = harness([profile(1, "alice")]);
  for (const update of [{ min_edge_pct: NaN }, { max_position_dollars: Infinity }, { max_position_dollars: "10" }, { min_edge_pct: -1 }, { max_venue_exposure_pct: 1.1 }, { max_open_positions: 1.5 }, { min_time_to_expiry_hours: 49 }, { max_time_to_expiry_hours: 0 }, {}]) {
    assert.ok((await h.actions.updateRiskProfile(1, update)).error);
  }
  assert.equal(h.operations.length, 0);
  const result = await h.actions.updateRiskProfile(1, { max_position_dollars: 35, min_time_to_expiry_hours: 72, max_time_to_expiry_hours: 96 });
  assert.equal(result.data.max_position_dollars, 35);
  assert.equal(result.data.user_id, "alice");
  assert.ok(result.data.updated_at);
  assert.equal(h.operations.length, 1);
});
