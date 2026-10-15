#!/usr/bin/env node
import { readFile, realpath } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Read-only preflight, not access control. A sending wrapper must enforce its result,
// use trusted freshly fetched metadata, and keep credentials scoped independently.
// profile: {founderCreatorId,repoUrl,projectId,allowedPairs:[{workspaceId,sessionId}],
//   forbiddenWorkspaceIds:[],forbiddenSessionIds:[],maxMetadataAgeSeconds:60}
// workspace: {id,creatorId,repoUrl,projectId,state:"ready",fetchedAt}
// session: {id,workspaceId,fetchedAt}; this is a normalized shape, not an API claim.
// fetchedAt: caller-observed UTC ISO time (YYYY-MM-DDTHH:mm:ss.sssZ), added only
// after resolving fresh trusted metadata. Timestamps cannot prove provenance.
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const explicit = (value) => typeof value === "string" && value.length > 0 && value.trim() === value;

export function validateLane(profile, workspace, session, now = Date.now()) {
  const errors = [];
  const requireFields = (value, label, fields) => {
    if (!object(value)) errors.push(`${label} must be an object`);
    else for (const field of fields) {
      if (!explicit(value[field])) errors.push(`${label}.${field} must be an explicit nonempty string`);
    }
  };
  requireFields(profile, "profile", ["founderCreatorId", "repoUrl", "projectId"]);
  requireFields(workspace, "workspace", ["id", "creatorId", "repoUrl", "projectId", "state", "fetchedAt"]);
  requireFields(session, "session", ["id", "workspaceId", "fetchedAt"]);
  if (!object(profile) || !object(workspace) || !object(session)) return { ok: false, errors };

  for (const key of ["forbiddenWorkspaceIds", "forbiddenSessionIds"]) {
    if (!Array.isArray(profile[key]) || !profile[key].every(explicit)) {
      errors.push(`profile.${key} must be an explicit array of nonempty IDs`);
    }
  }
  if (!Array.isArray(profile.allowedPairs) || profile.allowedPairs.length === 0) {
    errors.push("profile.allowedPairs must be a nonempty array");
  } else for (const pair of profile.allowedPairs) {
    requireFields(pair, "profile.allowedPairs entry", ["workspaceId", "sessionId"]);
  }
  if (!Number.isInteger(profile.maxMetadataAgeSeconds)
      || profile.maxMetadataAgeSeconds < 1 || profile.maxMetadataAgeSeconds > 300) {
    errors.push("profile.maxMetadataAgeSeconds must be an integer from 1 to 300");
  }
  if (!Number.isFinite(now)) errors.push("now must be a finite epoch-millisecond number");
  if (errors.length) return { ok: false, errors };

  for (const [label, value] of [["workspace", workspace], ["session", session]]) {
    const timestamp = Date.parse(value.fetchedAt);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value.fetchedAt) {
      errors.push(`${label}.fetchedAt must be a canonical UTC ISO timestamp`);
    } else if (timestamp > now || now - timestamp > profile.maxMetadataAgeSeconds * 1000) {
      errors.push(`${label} metadata is stale or future-dated`);
    }
  }
  if (workspace.creatorId !== profile.founderCreatorId) errors.push("creatorId is not the approved founder");
  if (workspace.repoUrl !== profile.repoUrl) errors.push("repository is not exactly allowlisted");
  if (workspace.projectId !== profile.projectId) errors.push("projectId is not exactly allowlisted");
  if (workspace.state !== "ready") errors.push("workspace is not ready");
  if (session.workspaceId !== workspace.id) errors.push("session belongs to a different workspace");
  if (profile.forbiddenWorkspaceIds.includes(workspace.id)
      || profile.forbiddenWorkspaceIds.includes(session.workspaceId)) errors.push("workspace is forbidden");
  if (profile.forbiddenSessionIds.includes(session.id)) errors.push("session is forbidden");
  if (!profile.allowedPairs.some((pair) => pair.workspaceId === workspace.id && pair.sessionId === session.id)) {
    errors.push("workspace/session pair is not allowlisted");
  }
  const seenSessions = new Set();
  for (const pair of profile.allowedPairs) {
    if (seenSessions.has(pair.sessionId)) errors.push("allowlist contains a duplicate sessionId");
    seenSessions.add(pair.sessionId);
    if (profile.forbiddenWorkspaceIds.includes(pair.workspaceId)
        || profile.forbiddenSessionIds.includes(pair.sessionId)) errors.push("allowlist overlaps forbidden IDs");
  }
  return { ok: errors.length === 0, errors };
}

// Dependencies are injectable for tests; production only reads files and prints JSON.
export async function runCli(args, {
  read = readFile,
  output = (result) => console.log(JSON.stringify(result)),
  now = Date.now(),
} = {}) {
  if (args.length !== 3) {
    output({ ok: false, errors: ["Usage: node scripts/check-lane.mjs profile.json workspace.json session.json"] });
    return 2;
  }
  let inputs;
  try {
    inputs = await Promise.all(args.map(async (path) => JSON.parse(await read(path, "utf8"))));
  } catch {
    output({ ok: false, errors: ["Could not read or parse the three JSON inputs"] });
    return 2;
  }
  const result = validateLane(...inputs, now);
  output(result);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
