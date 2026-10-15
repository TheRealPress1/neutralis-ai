import assert from "node:assert/strict";
import test from "node:test";
import { runCli, validateLane } from "./check-lane.mjs";

// Synthetic fixtures only. Passing these tests asserts nothing about a live lane.
const now = Date.parse("2030-01-01T00:00:30.000Z");
function fixture() {
  return {
    profile: {
      founderCreatorId: "synthetic-founder", repoUrl: "https://example.invalid/team/repo",
      projectId: "synthetic-project", maxMetadataAgeSeconds: 60,
      allowedPairs: [
        { workspaceId: "workspace-a", sessionId: "session-a" },
        { workspaceId: "workspace-b", sessionId: "session-b" },
      ],
      forbiddenWorkspaceIds: ["forbidden-workspace"], forbiddenSessionIds: ["forbidden-session"],
    },
    workspace: {
      id: "workspace-a", creatorId: "synthetic-founder", repoUrl: "https://example.invalid/team/repo",
      projectId: "synthetic-project", state: "ready", fetchedAt: "2030-01-01T00:00:00.000Z",
    },
    session: { id: "session-a", workspaceId: "workspace-a", fetchedAt: "2030-01-01T00:00:00.000Z" },
  };
}
const check = ({ profile, workspace, session }) => validateLane(profile, workspace, session, now);

test("passes an exact, fresh synthetic approved pair without changing its inputs", () => {
  const data = fixture();
  const before = structuredClone(data);
  assert.deepEqual(check(data), { ok: true, errors: [] });
  assert.deepEqual(data, before);
});

for (const [label, change, reason] of [
  ["wrong creator", (d) => { d.workspace.creatorId = "someone-else"; }, /creatorId/],
  ["wrong repository", (d) => { d.workspace.repoUrl += ".git"; }, /repository/],
  ["wrong project", (d) => { d.workspace.projectId = "other-project"; }, /projectId/],
  ["unlisted workspace", (d) => { d.workspace.id = d.session.workspaceId = "unlisted"; }, /pair/],
  ["unlisted session", (d) => { d.session.id = "unlisted"; }, /pair/],
  ["crossed pair", (d) => { d.session.id = "session-b"; }, /pair/],
  ["wrong session workspace", (d) => { d.session.workspaceId = "workspace-b"; }, /different workspace/],
  ["forbidden workspace even when allowlisted", (d) => {
    d.profile.forbiddenWorkspaceIds.push("workspace-a");
  }, /workspace is forbidden/],
  ["forbidden session even when allowlisted", (d) => {
    d.profile.forbiddenSessionIds.push("session-a");
  }, /session is forbidden/],
  ["forbidden session workspace", (d) => { d.session.workspaceId = "forbidden-workspace"; }, /forbidden/],
  ["not ready", (d) => { d.workspace.state = "archived"; }, /not ready/],
  ["ambiguous session mapping", (d) => {
    d.profile.allowedPairs.push({ workspaceId: "workspace-b", sessionId: "session-a" });
  }, /duplicate sessionId/],
  ["empty allowlist", (d) => { d.profile.allowedPairs = []; }, /nonempty array/],
  ["invalid pair", (d) => { d.profile.allowedPairs.push({ workspaceId: "workspace-c" }); }, /sessionId/],
  ["invalid deny list", (d) => { d.profile.forbiddenSessionIds = [""]; }, /forbiddenSessionIds/],
  ["blank founder", (d) => { d.profile.founderCreatorId = "   "; }, /founderCreatorId/],
  ["blank observed creator", (d) => { d.workspace.creatorId = ""; }, /creatorId/],
  ["unbounded freshness", (d) => { d.profile.maxMetadataAgeSeconds = 301; }, /maxMetadataAgeSeconds/],
  ["invalid freshness type", (d) => { d.profile.maxMetadataAgeSeconds = "60"; }, /maxMetadataAgeSeconds/],
]) {
  test(`denies ${label}`, () => {
    const data = fixture();
    change(data);
    const result = check(data);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("; "), reason);
  });
}

for (const section of ["profile", "workspace", "session"]) {
  for (const field of Object.keys(fixture()[section])) {
    test(`fails closed when ${section}.${field} is missing`, () => {
      const data = fixture();
      delete data[section][field];
      assert.equal(check(data).ok, false);
    });
  }
  for (const malformed of [null, [], "", 0]) {
    test(`fails closed on ${section} = ${JSON.stringify(malformed)}`, () => {
      const data = fixture();
      data[section] = malformed;
      assert.equal(check(data).ok, false);
    });
  }
}

for (const section of ["workspace", "session"]) {
  for (const fetchedAt of ["2029-12-31T23:59:29.999Z", "2030-01-01T00:00:30.001Z", "bad", "2030-01-01"]) {
    test(`denies invalid or non-fresh ${section} timestamp ${fetchedAt}`, () => {
      const data = fixture();
      data[section].fetchedAt = fetchedAt;
      assert.equal(check(data).ok, false);
    });
  }
}

test("fails closed with invalid clock", () => {
  const { profile, workspace, session } = fixture();
  assert.equal(validateLane(profile, workspace, session, NaN).ok, false);
});

test("CLI returns 0 on pass and 1 on deny, printing only the result", async () => {
  for (const deny of [false, true]) {
    const data = fixture();
    if (deny) data.workspace.creatorId = "other";
    const printed = [];
    const code = await runCli(["profile", "workspace", "session"], {
      now, read: async (path) => JSON.stringify(data[path]), output: (value) => printed.push(value),
    });
    assert.equal(code, deny ? 1 : 0);
    assert.deepEqual(printed, [check(data)]);
  }
});

test("CLI rejects bad arity, unreadable files, and malformed JSON with exit 2", async () => {
  for (const [args, read] of [
    [[], async () => { throw new Error("must not read"); }],
    [["a", "b", "c"], async () => { throw new Error("private source detail"); }],
    [["a", "b", "c"], async () => "not JSON: private source detail"],
  ]) {
    const printed = [];
    assert.equal(await runCli(args, { now, read, output: (value) => printed.push(value) }), 2);
    assert.equal(printed[0].ok, false);
    assert.doesNotMatch(JSON.stringify(printed), /private source detail/);
  }
});
