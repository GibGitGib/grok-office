#!/usr/bin/env node
/**
 * Regenerate data.js from Linear Office-labeled issues and projects.
 *
 * Usage:
 *   LINEAR_API_KEY=... node scripts/sync-from-linear.mjs
 *   node scripts/sync-from-linear.mjs --fixture scripts/fixtures/linear-office.json
 *
 * When LINEAR_API_KEY is missing and no --fixture is passed, exit 0 after a
 * clear log line so GitHub Actions no-ops cleanly until the secret is set.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STATIC_PATH = path.join(__dirname, "office-static.json");
const DATA_PATH = path.join(ROOT, "data.js");
const LINEAR_URL = "https://api.linear.app/graphql";
const TEAM_KEY = "COR";
const OFFICE_LABEL = "Office";

function parseArgs(argv) {
  const out = { fixture: null, asOf: null, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixture") out.fixture = argv[++i];
    else if (a === "--as-of") out.asOf = argv[++i];
    else if (a === "--check") out.check = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/sync-from-linear.mjs [--fixture path] [--as-of stamp] [--check]");
      process.exit(0);
    }
  }
  return out;
}

function unwrapLinearMarkdown(text) {
  if (!text) return "";
  let s = String(text);
  // Linear autolinks: [label](<url>) or [label](url)
  s = s.replace(/\[([^\]]+)\]\(\s*<?([^)>\s]+)>?\s*\)/g, (all, label, url) => {
    const cleanUrl = url.replace(/^mailto:/i, "");
    if (label === url || label === cleanUrl || label === url.replace(/^https?:\/\//, "")) {
      return label;
    }
    if (/^(https?:\/\/|mailto:)/i.test(url) && (label.includes(".") || label.includes("@"))) {
      return label;
    }
    return label;
  });
  // Common markdown escapes Linear inserts around underscores and asterisks
  s = s.replace(/\\([_*`#[\]()])/g, "$1");
  return s;
}

function parseMeta(description) {
  const raw = description || "";
  const meta = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^office-([a-z0-9-]+):\s*(.*)$/i);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
  }
  const unwrapped = unwrapLinearMarkdown(raw);
  const parts = unwrapped.split(/\n---\n/);
  const body = (parts.length > 1 ? parts.slice(0, -1).join("\n---\n") : unwrapped)
    .replace(/\s+$/, "");
  return { meta, body };
}

function formatStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("month")} ${get("day")}, ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET`;
}

async function graphql(apiKey, query, variables) {
  const res = await fetch(LINEAR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    const msg = json.errors?.map((e) => e.message).join("; ") || `${res.status} ${res.statusText}`;
    throw new Error(`Linear GraphQL error: ${msg}`);
  }
  return json.data;
}

const ISSUES_QUERY = `
  query OfficeIssues($after: String) {
    issues(
      filter: {
        team: { key: { eq: "${TEAM_KEY}" } }
        labels: { name: { eq: "${OFFICE_LABEL}" } }
      }
      first: 100
      after: $after
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        identifier
        title
        description
        url
        createdAt
        updatedAt
        assignee { name }
        state { name type }
        labels { name parent { name } }
      }
    }
  }
`;

const PROJECTS_QUERY = `
  query OfficeProjects($after: String) {
    projects(
      filter: {
        accessibleTeams: { key: { eq: "${TEAM_KEY}" } }
        labels: { name: { eq: "${OFFICE_LABEL}" } }
      }
      first: 50
      after: $after
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        description
        url
        updatedAt
        labels { name }
      }
    }
  }
`;

function normalizeIssue(node) {
  const labels = (node.labels || []).map((l) => (typeof l === "string" ? l : l.name));
  const assignee = node.assignee
    ? typeof node.assignee === "string"
      ? node.assignee
      : node.assignee.name
    : null;
  return {
    id: node.identifier || node.id,
    title: node.title,
    description: node.description || "",
    url: node.url,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    assignee,
    status: node.status || node.state?.name || null,
    labels,
  };
}

function normalizeProject(node) {
  const labels = (node.labels || []).map((l) => (typeof l === "string" ? l : l.name));
  return {
    id: node.id,
    name: node.name,
    description: node.description || "",
    url: node.url,
    updatedAt: node.updatedAt,
    labels,
  };
}

async function fetchFromLinear(apiKey) {
  const issues = [];
  let after = null;
  do {
    const data = await graphql(apiKey, ISSUES_QUERY, { after });
    const conn = data.issues;
    issues.push(...conn.nodes.map(normalizeIssue));
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (after);

  const projects = [];
  after = null;
  do {
    const data = await graphql(apiKey, PROJECTS_QUERY, { after });
    const conn = data.projects;
    projects.push(...conn.nodes.map(normalizeProject));
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (after);

  return { issues, projects };
}

function shortName(name) {
  return name.split(" · ")[0];
}

function botLabelToAgentId(label, roster) {
  const match = roster.find((a) => shortName(a.name) === label || a.name === label);
  return match ? match.id : null;
}

function asOfLater(a, b) {
  function score(s) {
    if (!s || s === "None recorded") return -1;
    const [mon, day] = String(s).split(" ");
    const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    return (months[mon] || 0) * 100 + Number(day || 0);
  }
  return score(a) >= score(b) ? a : b;
}

function jsString(s) {
  return JSON.stringify(s ?? "");
}

function renderDataJs(asOf, zones, agents, rooms, about) {
  const lines = [];
  lines.push(`const AS_OF = ${jsString(asOf)};`);
  lines.push("");
  lines.push(`const ZONES = ${JSON.stringify(zones)};`);
  lines.push("");
  lines.push("const AGENTS = [");
  agents.forEach((a, ai) => {
    lines.push("  {");
    lines.push(`    id: ${jsString(a.id)},`);
    lines.push(`    name: ${jsString(a.name)},`);
    lines.push(`    initials: ${jsString(a.initials)},`);
    lines.push(`    role: ${jsString(a.role)},`);
    lines.push(`    zone: ${jsString(a.zone)},`);
    lines.push(`    lastSeen: ${jsString(a.lastSeen)},`);
    if (a.items.length === 0) {
      lines.push("    items: [],");
    } else {
      lines.push("    items: [");
      a.items.forEach((it) => {
        const keyPart = it.key ? `, key: ${jsString(it.key)}` : "";
        lines.push(`      { text: ${jsString(it.text)}, you: ${it.you ? "true" : "false"}, asOf: ${jsString(it.asOf)}${keyPart} },`);
      });
      lines.push("    ],");
    }
    if (a.projects.length === 0) {
      lines.push("    projects: [],");
    } else {
      lines.push("    projects: [");
      a.projects.forEach((p) => {
        lines.push(`      { name: ${jsString(p.name)}, detail: ${jsString(p.detail)}, asOf: ${jsString(p.asOf)} },`);
      });
      lines.push("    ],");
    }
    lines.push(ai === agents.length - 1 ? "  }" : "  },");
  });
  lines.push("];");
  lines.push("");
  lines.push("const ROOMS = [");
  rooms.forEach((r, i) => {
    lines.push("  {");
    lines.push(`    name: ${jsString(r.name)},`);
    lines.push(`    members: ${JSON.stringify(r.members)},`);
    lines.push(`    topic: ${jsString(r.topic)},`);
    lines.push(`    asOf: ${jsString(r.asOf)},`);
    lines.push(i === rooms.length - 1 ? "  }" : "  },");
  });
  lines.push("];");
  lines.push("");
  lines.push(`const ABOUT =`);
  lines.push(`  ${jsString(about)};`);
  lines.push("");
  return lines.join("\n");
}

function buildAgents(staticData, issues, projects) {
  const roster = staticData.agents.map((a) => ({ ...a, items: [], projects: [] }));
  const byId = new Map(roster.map((a) => [a.id, a]));
  const warnings = [];

  for (const issue of issues) {
    const { meta, body } = parseMeta(issue.description);
    const text = body || issue.title || "";
    if (!text) {
      warnings.push(`Skipping issue ${issue.id}: no text`);
      continue;
    }
    const agentIds = new Set();
    if (meta.agents) {
      for (const id of meta.agents.split(",").map((s) => s.trim()).filter(Boolean)) {
        agentIds.add(id);
      }
    }
    for (const label of issue.labels || []) {
      const id = botLabelToAgentId(label, staticData.agents);
      if (id) agentIds.add(id);
    }
    if (agentIds.size === 0) {
      warnings.push(`Skipping issue ${issue.id} (${issue.title}): no Bot label or office-agents`);
      continue;
    }
    let you;
    if (meta.you === "true") you = true;
    else if (meta.you === "false") you = false;
    else you = Boolean(issue.assignee);
    const asOf = meta["as-of"] || "Nov 23";
    const item = { text, you, asOf };
    if (meta["item-key"]) item.key = meta["item-key"];
    for (const id of agentIds) {
      const agent = byId.get(id);
      if (!agent) {
        warnings.push(`Unknown office-agent '${id}' on issue ${issue.id}`);
        continue;
      }
      agent.items.push({ ...item });
      agent.lastSeen = asOfLater(agent.lastSeen, asOf);
    }
  }

  for (const project of projects) {
    const { meta, body } = parseMeta(project.description);
    const agentId = meta.agent;
    const agent = agentId ? byId.get(agentId) : null;
    if (!agent) {
      warnings.push(`Skipping project ${project.id || project.name}: missing or unknown office-agent`);
      continue;
    }
    let name = meta["project-name"];
    if (!name && project.name) {
      const prefix = "Office · " + shortName(agent.name) + " · ";
      name = project.name.startsWith(prefix) ? project.name.slice(prefix.length) : project.name;
    }
    if (!name) {
      warnings.push(`Skipping project ${project.id}: no name`);
      continue;
    }
    const asOf = meta["as-of"] || "Nov 23";
    agent.projects.push({ name, detail: body || "", asOf });
    agent.lastSeen = asOfLater(agent.lastSeen, asOf);
  }

  function asOfScore(s) {
    if (!s || s === "None recorded") return -1;
    const [mon, day] = String(s).split(" ");
    const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    return (months[mon] || 0) * 100 + Number(day || 0);
  }
  for (const agent of roster) {
    agent.items.sort((a, b) => asOfScore(b.asOf) - asOfScore(a.asOf) || a.text.localeCompare(b.text));
    agent.projects.sort((a, b) => asOfScore(b.asOf) - asOfScore(a.asOf) || a.name.localeCompare(b.name));
  }

  return { agents: roster, warnings };
}

function assertShape(staticData, agents) {
  const errors = [];
  if (agents.length !== staticData.agents.length) {
    errors.push(`agent count ${agents.length} != roster ${staticData.agents.length}`);
  }
  for (const a of agents) {
    for (const field of ["id", "name", "initials", "role", "zone", "lastSeen"]) {
      if (a[field] == null || a[field] === "") errors.push(`${a.id} missing ${field}`);
    }
    if (!Array.isArray(a.items) || !Array.isArray(a.projects)) {
      errors.push(`${a.id} items/projects are not arrays`);
    }
    for (const it of a.items) {
      if (!it.text || typeof it.you !== "boolean" || !it.asOf) {
        errors.push(`${a.id} has a malformed item`);
      }
    }
    for (const p of a.projects) {
      if (!p.name || p.detail == null || !p.asOf) {
        errors.push(`${a.id} has a malformed project`);
      }
    }
  }
  if (!Array.isArray(staticData.zones) || staticData.zones.length !== 5) {
    errors.push("ZONES must have 5 entries");
  }
  if (!Array.isArray(staticData.rooms) || staticData.rooms.length !== 3) {
    errors.push("ROOMS must have 3 entries");
  }
  if (!staticData.about) errors.push("ABOUT is missing");
  return errors;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.LINEAR_API_KEY || "";
  const fixturePath = args.fixture
    ? path.resolve(process.cwd(), args.fixture)
    : null;

  if (!fixturePath && !apiKey) {
    console.log("LINEAR_API_KEY is not set; skipping Linear sync.");
    process.exit(0);
  }

  const staticData = JSON.parse(fs.readFileSync(STATIC_PATH, "utf8"));

  let issues, projects, asOf;
  if (fixturePath) {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    issues = fixture.issues || [];
    projects = fixture.projects || [];
    asOf = args.asOf || fixture.asOf || formatStamp();
    console.log(`Loaded fixture ${fixturePath}: ${issues.length} issues, ${projects.length} projects`);
  } else {
    const data = await fetchFromLinear(apiKey);
    issues = data.issues;
    projects = data.projects;
    asOf = args.asOf || formatStamp();
    console.log(`Fetched from Linear: ${issues.length} Office issues, ${projects.length} Office projects`);
  }

  const { agents, warnings } = buildAgents(staticData, issues, projects);
  for (const w of warnings) console.warn("warn:", w);

  const errors = assertShape(staticData, agents);
  if (errors.length) {
    for (const e of errors) console.error("shape error:", e);
    process.exit(1);
  }

  const output = renderDataJs(asOf, staticData.zones, agents, staticData.rooms, staticData.about);
  const itemCount = agents.reduce((n, a) => n + a.items.length, 0);
  const youCount = agents.reduce((n, a) => n + a.items.filter((i) => i.you).length, 0);
  const projectCount = agents.reduce((n, a) => n + a.projects.length, 0);

  if (args.check) {
    console.log(`Shape OK: ${agents.length} agents, ${itemCount} items (${youCount} waiting on you), ${projectCount} projects`);
    return;
  }

  const previous = fs.existsSync(DATA_PATH) ? fs.readFileSync(DATA_PATH, "utf8") : "";
  if (previous === output) {
    console.log("data.js is unchanged.");
    return;
  }
  fs.writeFileSync(DATA_PATH, output);
  console.log(`Wrote ${path.relative(ROOT, DATA_PATH)}: ${agents.length} agents, ${itemCount} items (${youCount} waiting on you), ${projectCount} projects, AS_OF ${asOf}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
