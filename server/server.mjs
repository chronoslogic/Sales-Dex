import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = process.env.SALES_DEX_DATA_DIR ? path.resolve(process.env.SALES_DEX_DATA_DIR) : path.join(rootDir, "data");
const configPath = path.join(dataDir, "orgs.json");
const distDir = path.join(rootDir, "dist");
const app = express();
const port = Number(process.env.PORT || 4317);
const isWindows = process.platform === "win32";

const targetPattern = /^[a-zA-Z0-9._@+\- ]{1,180}$/;
const aliasPattern = /^[a-zA-Z0-9._-]{1,90}$/;
const riskLevels = new Set(["Low", "Medium", "High"]);
const environments = new Set(["Production", "Sandbox", "Unknown"]);

app.use(express.json({ limit: "128kb" }));

async function ensureConfig() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(configPath, JSON.stringify({ orgs: [] }, null, 2));
  }
}

async function readConfig() {
  await ensureConfig();
  const raw = await fs.readFile(configPath, "utf8");
  try {
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    return { orgs: Array.isArray(parsed.orgs) ? parsed.orgs : [] };
  } catch {
    return { orgs: [] };
  }
}

async function writeConfig(config) {
  await ensureConfig();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

function runSf(args, options = {}) {
  const timeout = options.timeout ?? 45000;
  const command = isWindows ? "cmd.exe" : "sf";
  const commandArgs = isWindows ? ["/d", "/c", "sf.cmd", ...args] : args;

  return new Promise((resolve) => {
    execFile(command, commandArgs, { timeout, windowsHide: true }, (error, stdout, stderr) => {
      let parsed = null;
      const trimmedStdout = stdout.trim();

      if (trimmedStdout) {
        parsed = parseJsonOutput(trimmedStdout);
      }

      if (error) {
        resolve({
          ok: false,
          code: error.code ?? 1,
          signal: error.signal,
          stdout: trimmedStdout,
          stderr: stderr.trim(),
          result: parsed,
          message: buildErrorMessage(error, stderr, parsed)
        });
        return;
      }

      resolve({
        ok: true,
        code: 0,
        stdout: trimmedStdout,
        stderr: stderr.trim(),
        result: parsed
      });
    });
  });
}

function buildErrorMessage(error, stderr, parsed) {
  if (parsed?.message) return stripAnsi(parsed.message);
  if (parsed?.name && parsed?.message) return stripAnsi(`${parsed.name}: ${parsed.message}`);
  if (stderr?.trim()) return stripAnsi(stderr.trim());
  if (error?.code === "ENOENT") return "Salesforce CLI was not found. Install Salesforce CLI or confirm that the 'sf' command is in PATH.";
  if (error?.killed) return "The Salesforce CLI command took longer than expected and was interrupted.";
  return stripAnsi(error?.message || "Unable to run Salesforce CLI command.");
}

function stripAnsi(value) {
  return String(value || "").replace(/\u001b\[[0-9;]*m/g, "").trim();
}

function parseJsonOutput(value) {
  const cleaned = stripAnsi(value);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function flattenOrgList(result) {
  const source = result?.result ?? result ?? {};
  const buckets = [
    ["nonScratchOrgs", "org"],
    ["scratchOrgs", "scratch"],
    ["sandboxes", "sandbox"],
    ["devHubs", "devHub"],
    ["expired", "expired"],
    ["orphaned", "orphaned"],
    ["other", "other"]
  ];

  const orgs = [];
  const seen = new Set();

  for (const [key, bucket] of buckets) {
    const items = Array.isArray(source[key]) ? source[key] : [];
    for (const item of items) {
      const normalized = normalizeCliOrg(item, bucket);
      const dedupeKey = normalized.alias || normalized.username || normalized.orgId || `${bucket}-${orgs.length}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      orgs.push(normalized);
    }
  }

  if (Array.isArray(source.orgs)) {
    for (const item of source.orgs) {
      const normalized = normalizeCliOrg(item, "org");
      const dedupeKey = normalized.alias || normalized.username || normalized.orgId || `org-${orgs.length}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      orgs.push(normalized);
    }
  }

  return orgs;
}

function normalizeCliOrg(item, bucket) {
  const alias = pickAlias(item);
  const isSandbox = inferSandbox(item);
  const connectedStatus = item.connectedStatus || item.status || item.state || (bucket === "expired" ? "Expired" : "Unknown");

  return {
    id: item.orgId || item.id || alias || item.username || cryptoRandomId(),
    alias,
    username: item.username || item.userName || "",
    orgId: item.orgId || item.organizationId || item.id || "",
    instanceUrl: item.instanceUrl || item.instanceURL || item.url || "",
    loginUrl: item.loginUrl || item.loginURL || "",
    environment: isSandbox === true ? "Sandbox" : isSandbox === false ? "Production" : "Unknown",
    isSandbox,
    connectedStatus,
    lastUsed: item.lastUsed || item.lastUsedDate || item.lastUsedAt || "",
    isDefault: Boolean(item.isDefaultUsername || item.isDefaultDevHubUsername || item.defaultMarker),
    rawType: bucket
  };
}

function pickAlias(item) {
  if (typeof item.alias === "string") return item.alias;
  if (Array.isArray(item.aliases) && item.aliases.length > 0) return item.aliases[0];
  if (typeof item.aliases === "string") return item.aliases;
  return "";
}

function inferSandbox(item) {
  if (typeof item.isSandbox === "boolean") return item.isSandbox;
  if (typeof item.sandboxName === "string" && item.sandboxName.length > 0) return true;
  const instanceUrl = String(item.instanceUrl || item.url || "").toLowerCase();
  const loginUrl = String(item.loginUrl || "").toLowerCase();
  if (instanceUrl.includes(".sandbox.") || loginUrl.includes("test.salesforce.com")) return true;
  if (instanceUrl.includes("my.salesforce.com") || loginUrl.includes("login.salesforce.com")) return false;
  return null;
}

function mergeLocalMetadata(cliOrgs, metadata) {
  const usedMetadataIndexes = new Set();
  const mergedOrgs = cliOrgs.map((org) => {
    const { local, index } = findLocalMetadataForOrg(metadata, org);
    if (index >= 0) usedMetadataIndexes.add(index);
    const localEnvironment = normalizeEnvironment(local.environment);
    return {
      ...org,
      username: org.username || local.username || "",
      orgId: org.orgId || local.orgId || "",
      instanceUrl: org.instanceUrl || local.instanceUrl || "",
      loginUrl: org.loginUrl || local.loginUrl || "",
      connectedStatus: org.connectedStatus || local.connectedStatus || "Unknown",
      client: local.client || "",
      riskLevel: normalizeRiskLevel(local.riskLevel),
      notes: local.notes || "",
      favorite: Boolean(local.favorite),
      localEnvironment,
      effectiveEnvironment: localEnvironment && localEnvironment !== "Unknown" ? localEnvironment : org.environment,
      lastCliLoginAt: local.lastCliLoginAt || "",
      localLastUsedAt: local.lastUsedAt || "",
      metadataUpdatedAt: local.updatedAt || ""
    };
  });

  const disconnectedLocalOrgs = metadata
    .filter((item, index) => !usedMetadataIndexes.has(index) && hasLocalOrgIdentity(item))
    .map(localMetadataToOrg);

  return [...mergedOrgs, ...disconnectedLocalOrgs];
}

function findLocalMetadataForOrg(metadata, org) {
  const index = metadata.findIndex((item) =>
    [org.alias, org.username, org.orgId].filter(Boolean).some((target) => localItemMatchesTarget(item, target))
  );
  return { local: index >= 0 ? metadata[index] : {}, index };
}

function findLocalMetadataIndex(metadata, target) {
  return metadata.findIndex((item) => localItemMatchesTarget(item, target));
}

function localItemMatchesTarget(item, target) {
  const normalizedTarget = normalizeTargetKey(target);
  if (!normalizedTarget) return false;
  return [item.alias, item.username, item.orgId].some((value) => normalizeTargetKey(value) === normalizedTarget);
}

function normalizeTargetKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isDisconnectedLocalOrg(item) {
  return String(item.connectedStatus || "").toLowerCase().includes("disconnect") || Boolean(item.disconnectedAt);
}

function isConnectedLocalOrg(item) {
  const normalized = String(item.connectedStatus || "").toLowerCase();
  return !normalized.includes("disconnect") && (normalized.includes("connect") || normalized.includes("active"));
}

function hasLocalOrgIdentity(item) {
  return Boolean(String(item.alias || item.username || item.orgId || "").trim());
}

function needsConnectedDetails(org) {
  return Boolean(isConnectedLocalOrg(org) && (!org.username || !org.orgId || !org.instanceUrl));
}

function snapshotFromDisplayResult(result, target, fallback = {}) {
  const source = result?.result ?? result ?? {};
  const isSandbox = inferSandbox(source);
  const fallbackEnvironment = normalizeEnvironment(fallback.environment);
  const displayEnvironment = isSandbox === true ? "Sandbox" : isSandbox === false ? "Production" : "Unknown";

  return {
    alias: source.alias || fallback.alias || target,
    username: source.username || source.userName || fallback.username || "",
    orgId: source.id || source.orgId || source.organizationId || fallback.orgId || "",
    instanceUrl: source.instanceUrl || source.instanceURL || fallback.instanceUrl || "",
    loginUrl: source.loginUrl || source.loginURL || fallback.loginUrl || "",
    environment: fallbackEnvironment !== "Unknown" ? fallbackEnvironment : displayEnvironment,
    connectedStatus: source.connectedStatus || source.status || fallback.connectedStatus || "Connected"
  };
}

async function enrichConnectedLocalOrgs(orgs) {
  const enriched = [];

  for (const org of orgs) {
    if (!needsConnectedDetails(org)) {
      enriched.push(org);
      continue;
    }

    const target = org.alias || org.username;
    const displayResult = await runSf(["org", "display", "--target-org", target, "--json"]);

    if (!displayResult.ok) {
      await markDisconnected(target, org);
      enriched.push({ ...org, connectedStatus: "Disconnected" });
      continue;
    }

    const snapshot = snapshotFromDisplayResult(displayResult.result, target, org);
    await touchLastUsed(target, snapshot);
    enriched.push({
      ...org,
      ...snapshot,
      id: snapshot.orgId || snapshot.alias || org.id,
      environment: snapshot.environment,
      effectiveEnvironment: snapshot.environment !== "Unknown" ? snapshot.environment : org.effectiveEnvironment,
      localOnly: false
    });
  }

  return enriched;
}

function localMetadataToOrg(local) {
  const environment = normalizeEnvironment(local.environment);
  return {
    id: local.orgId || local.alias || local.username || cryptoRandomId(),
    alias: local.alias || local.username || "",
    username: local.username || "",
    orgId: local.orgId || "",
    instanceUrl: local.instanceUrl || "",
    loginUrl: local.loginUrl || "",
    environment,
    isSandbox: environment === "Sandbox" ? true : environment === "Production" ? false : null,
    connectedStatus: local.connectedStatus || "Disconnected",
    lastUsed: "",
    isDefault: false,
    rawType: "local",
    client: local.client || "",
    riskLevel: normalizeRiskLevel(local.riskLevel),
    notes: local.notes || "",
    favorite: Boolean(local.favorite),
    localEnvironment: environment,
    effectiveEnvironment: environment,
    lastCliLoginAt: local.lastCliLoginAt || "",
    localLastUsedAt: local.lastUsedAt || "",
    metadataUpdatedAt: local.updatedAt || "",
    localOnly: true
  };
}

function normalizeDetails(result, target, local) {
  const source = result?.result ?? result ?? {};
  const isSandbox = inferSandbox(source);
  const localEnvironment = normalizeEnvironment(local?.environment);
  return {
    target,
    username: source.username || source.userName || local?.username || "",
    alias: source.alias || target,
    orgId: source.id || source.orgId || source.organizationId || local?.orgId || "",
    instanceUrl: source.instanceUrl || source.instanceURL || local?.instanceUrl || "",
    loginUrl: source.loginUrl || source.loginURL || local?.loginUrl || "",
    connectedStatus: source.connectedStatus || source.status || local?.connectedStatus || "Unknown",
    environment: localEnvironment && localEnvironment !== "Unknown" ? localEnvironment : isSandbox === true ? "Sandbox" : isSandbox === false ? "Production" : "Unknown",
    apiVersion: source.apiVersion || source.apiVersionNumber || "",
    client: local?.client || "",
    riskLevel: normalizeRiskLevel(local?.riskLevel),
    notes: local?.notes || "",
    favorite: Boolean(local?.favorite)
  };
}

function sanitizeMetadata(input) {
  const alias = String(input.alias || "").trim();
  if (!targetPattern.test(alias)) {
    throw new Error("Enter a valid alias or username.");
  }

  const environment = normalizeEnvironment(input.environment);
  const riskLevel = normalizeRiskLevel(input.riskLevel);

  return {
    alias,
    client: String(input.client || "").trim().slice(0, 120),
    environment,
    riskLevel,
    notes: String(input.notes || "").trim().slice(0, 1200),
    favorite: Boolean(input.favorite),
    updatedAt: new Date().toISOString()
  };
}

function validateTarget(target) {
  const value = String(target || "").trim();
  if (!targetPattern.test(value)) {
    throw new Error("Invalid alias or username.");
  }
  return value;
}

function validateLoginAlias(alias) {
  const value = String(alias || "").trim();
  if (/\s/.test(value)) {
    throw new Error("Alias cannot contain spaces. Use letters, numbers, dots, hyphens, or underscores.");
  }
  if (!aliasPattern.test(value)) {
    throw new Error("Use a simple alias with letters, numbers, dots, hyphens, or underscores.");
  }
  return value;
}

function sanitizeClientName(client) {
  const value = String(client || "").trim().slice(0, 120);
  if (!value) {
    throw new Error("Enter the client name.");
  }
  return value;
}

async function touchLastUsed(alias, orgSnapshot = {}) {
  const config = await readConfig();
  const now = new Date().toISOString();
  const index = findLocalMetadataIndex(config.orgs, alias);
  const snapshotEnvironment = normalizeEnvironment(orgSnapshot.environment);
  if (index >= 0) {
    const { disconnectedAt, ...existing } = config.orgs[index];
    const existingEnvironment = normalizeEnvironment(existing.environment);
    config.orgs[index] = {
      ...existing,
      alias: existing.alias || orgSnapshot.alias || alias,
      client: orgSnapshot.client || existing.client || "",
      username: orgSnapshot.username || existing.username || "",
      orgId: orgSnapshot.orgId || existing.orgId || "",
      instanceUrl: orgSnapshot.instanceUrl || existing.instanceUrl || "",
      loginUrl: orgSnapshot.loginUrl || existing.loginUrl || "",
      environment: existingEnvironment !== "Unknown" ? existingEnvironment : snapshotEnvironment,
      connectedStatus: orgSnapshot.connectedStatus || "Connected",
      lastCliLoginAt: orgSnapshot.lastCliLoginAt || existing.lastCliLoginAt || "",
      updatedAt: now,
      lastUsedAt: now
    };
  } else {
    config.orgs.push({
      alias: orgSnapshot.alias || alias,
      client: orgSnapshot.client || "",
      username: orgSnapshot.username || "",
      orgId: orgSnapshot.orgId || "",
      instanceUrl: orgSnapshot.instanceUrl || "",
      loginUrl: orgSnapshot.loginUrl || "",
      environment: snapshotEnvironment,
      riskLevel: "Medium",
      notes: "",
      favorite: false,
      connectedStatus: orgSnapshot.connectedStatus || "Connected",
      lastCliLoginAt: orgSnapshot.lastCliLoginAt || "",
      updatedAt: now,
      lastUsedAt: now
    });
  }
  await writeConfig(config);
}

async function captureConnectedOrg(alias, metadata = {}) {
  const displayResult = await runSf(["org", "display", "--target-org", alias, "--json"]);
  if (!displayResult.ok) {
    await touchLastUsed(alias, metadata);
    return { ok: false, message: displayResult.message };
  }

  const snapshot = { ...snapshotFromDisplayResult(displayResult.result, alias, {}), ...metadata };
  await touchLastUsed(alias, snapshot);
  return { ok: true, details: snapshot };
}

async function markDisconnected(target, cliOrg = {}) {
  const config = await readConfig();
  const now = new Date().toISOString();
  const index = findLocalMetadataIndex(config.orgs, target);
  const existing = index >= 0 ? config.orgs[index] : {};
  const existingEnvironment = normalizeEnvironment(existing.environment);
  const cliEnvironment = normalizeEnvironment(cliOrg.environment);
  const next = {
    alias: existing.alias || cliOrg.alias || target,
    client: existing.client || "",
    environment: existingEnvironment !== "Unknown" ? existingEnvironment : cliEnvironment,
    riskLevel: normalizeRiskLevel(existing.riskLevel),
    notes: existing.notes || "",
    favorite: Boolean(existing.favorite),
    ...existing,
    alias: existing.alias || cliOrg.alias || target,
    username: cliOrg.username || existing.username || "",
    orgId: cliOrg.orgId || existing.orgId || "",
    instanceUrl: cliOrg.instanceUrl || existing.instanceUrl || "",
    loginUrl: cliOrg.loginUrl || existing.loginUrl || defaultLoginUrl(existingEnvironment !== "Unknown" ? existingEnvironment : cliEnvironment),
    environment: existingEnvironment !== "Unknown" ? existingEnvironment : cliEnvironment,
    connectedStatus: "Disconnected",
    disconnectedAt: now,
    updatedAt: now
  };

  if (index >= 0) {
    config.orgs[index] = next;
  } else {
    config.orgs.push(next);
  }

  await writeConfig(config);
}

function defaultLoginUrl(environment) {
  if (environment === "Sandbox") return "https://test.salesforce.com/";
  if (environment === "Production") return "https://login.salesforce.com/";
  return "";
}

function findCliOrgByTarget(orgs, target) {
  return orgs.find((org) => [org.alias, org.username, org.orgId].filter(Boolean).some((value) => normalizeTargetKey(value) === normalizeTargetKey(target))) || null;
}

function normalizeEnvironment(value) {
  if (value === "Production" || value === "Sandbox" || value === "Unknown") return value;
  if (value === "Desconhecido" || !value) return "Unknown";
  return environments.has(value) ? value : "Unknown";
}

function normalizeRiskLevel(value) {
  if (value === "Low" || value === "Medium" || value === "High") return value;
  if (value === "Baixo") return "Low";
  if (value === "M\u00e9dio" || value === "Medio" || !value) return "Medium";
  if (value === "Alto") return "High";
  return riskLevels.has(value) ? value : "Medium";
}

function cryptoRandomId() {
  return `local-${Math.random().toString(36).slice(2, 10)}`;
}

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(400).json({ ok: false, message: error.message || "Não foi possível concluir a operação." });
    }
  };
}

app.get("/local-api/health", (_req, res) => {
  res.json({ ok: true, app: "Sales Dex" });
});

app.get("/local-api/orgs", asyncRoute(async (_req, res) => {
  const [config, listResult] = await Promise.all([readConfig(), runSf(["org", "list", "--json"])]);
  if (!listResult.ok) {
    res.status(200).json({
      ok: false,
      message: listResult.message,
      orgs: await enrichConnectedLocalOrgs(mergeLocalMetadata([], config.orgs)),
      localOrgs: config.orgs
    });
    return;
  }

  const orgs = await enrichConnectedLocalOrgs(mergeLocalMetadata(flattenOrgList(listResult.result), config.orgs));
  res.json({
    ok: true,
    orgs,
    localOrgs: config.orgs,
    warnings: listResult.result?.warnings || []
  });
}));

app.get("/local-api/orgs/:target", asyncRoute(async (req, res) => {
  const target = validateTarget(req.params.target);
  const config = await readConfig();
  const localIndex = findLocalMetadataIndex(config.orgs, target);
  const local = localIndex >= 0 ? config.orgs[localIndex] : {};
  const displayResult = await runSf(["org", "display", "--target-org", target, "--json"]);

  if (!displayResult.ok) {
    res.status(200).json({ ok: false, message: displayResult.message, details: normalizeDetails({}, target, local) });
    return;
  }

  await touchLastUsed(target);
  res.json({ ok: true, details: normalizeDetails(displayResult.result, target, local) });
}));

app.post("/local-api/orgs/metadata", asyncRoute(async (req, res) => {
  const metadata = sanitizeMetadata(req.body);
  const config = await readConfig();
  const index = findLocalMetadataIndex(config.orgs, metadata.alias);

  if (index >= 0) {
    config.orgs[index] = { ...config.orgs[index], ...metadata };
  } else {
    config.orgs.push(metadata);
  }

  await writeConfig(config);
  res.json({ ok: true, org: index >= 0 ? config.orgs[index] : metadata });
}));

app.post("/local-api/orgs/favorite", asyncRoute(async (req, res) => {
  const target = validateTarget(req.body.target);
  const favorite = Boolean(req.body.favorite);
  const config = await readConfig();
  const index = findLocalMetadataIndex(config.orgs, target);
  const now = new Date().toISOString();

  if (index >= 0) {
    config.orgs[index] = { ...config.orgs[index], favorite, updatedAt: now };
  } else {
    config.orgs.push({
      alias: target,
      client: "",
      environment: "Unknown",
      riskLevel: "Medium",
      notes: "",
      favorite,
      updatedAt: now
    });
  }

  await writeConfig(config);
  res.json({ ok: true, favorite, message: favorite ? `${target} added to favorites.` : `${target} removed from favorites.` });
}));

app.post("/local-api/orgs/remove", asyncRoute(async (req, res) => {
  const target = validateTarget(req.body.target);
  const config = await readConfig();
  const index = findLocalMetadataIndex(config.orgs, target);

  if (index < 0) {
    res.json({ ok: true, message: `${target} was already removed from the Sales Dex list.` });
    return;
  }

  const listResult = await runSf(["org", "list", "--json"]);
  const cliOrg = listResult.ok ? findCliOrgByTarget(flattenOrgList(listResult.result), target) : null;

  if (cliOrg && !isDisconnectedLocalOrg(config.orgs[index])) {
    res.status(200).json({ ok: false, message: "Only disconnected orgs can be removed from the local Sales Dex list." });
    return;
  }

  config.orgs.splice(index, 1);
  await writeConfig(config);
  res.json({ ok: true, message: `${target} removed from the Sales Dex list.` });
}));

app.post("/local-api/actions/open", asyncRoute(async (req, res) => {
  const target = validateTarget(req.body.target);
  const result = await runSf(["org", "open", "--target-org", target, "--json"], { timeout: 90000 });
  if (!result.ok) {
    res.status(200).json({ ok: false, message: result.message });
    return;
  }
  await touchLastUsed(target);
  res.json({ ok: true, message: "Org opened in the browser." });
}));

app.post("/local-api/actions/logout", asyncRoute(async (req, res) => {
  const target = validateTarget(req.body.target);
  const listResult = await runSf(["org", "list", "--json"]);
  const cliOrg = listResult.ok ? findCliOrgByTarget(flattenOrgList(listResult.result), target) : null;
  const result = await runSf(["org", "logout", "--target-org", target, "--no-prompt", "--json"]);
  if (!result.ok) {
    res.status(200).json({ ok: false, message: result.message });
    return;
  }
  await markDisconnected(target, cliOrg || {});
  res.json({ ok: true, message: `${target} disconnected from Salesforce CLI.` });
}));

app.post("/local-api/actions/reconnect", asyncRoute(async (req, res) => {
  const target = validateTarget(req.body.target);
  const config = await readConfig();
  const index = findLocalMetadataIndex(config.orgs, target);
  const local = index >= 0 ? config.orgs[index] : {};
  const alias = validateTarget(local.alias || target);
  const args = ["org", "login", "web", "--alias", alias, "--json"];
  const reconnectUrl = local.loginUrl || local.instanceUrl || defaultLoginUrl(normalizeEnvironment(local.environment));

  if (reconnectUrl) {
    try {
      const url = new URL(reconnectUrl);
      if (!["https:"].includes(url.protocol)) {
        throw new Error("The login URL must use HTTPS.");
      }
      args.push("--instance-url", url.toString());
    } catch {
      throw new Error("The saved login URL is not valid. Use New connection to authenticate this org again.");
    }
  }

  const result = await runSf(args, { timeout: 300000 });
  if (!result.ok) {
    res.status(200).json({ ok: false, message: result.message });
    return;
  }

  const lastCliLoginAt = new Date().toISOString();
  await captureConnectedOrg(alias, { lastCliLoginAt });
  res.json({ ok: true, message: `${alias} reconnected in Salesforce CLI.` });
}));

app.post("/local-api/actions/login", asyncRoute(async (req, res) => {
  const alias = validateLoginAlias(req.body.alias);
  const client = sanitizeClientName(req.body.client);
  const instanceUrl = String(req.body.instanceUrl || "").trim();
  const args = ["org", "login", "web", "--alias", alias, "--json"];

  if (instanceUrl) {
    try {
      const url = new URL(instanceUrl);
      if (!["https:"].includes(url.protocol)) {
        throw new Error("The login URL must use HTTPS.");
      }
      args.push("--instance-url", url.toString());
    } catch {
      throw new Error("Enter a valid login URL, for example https://login.salesforce.com or https://test.salesforce.com.");
    }
  }

  const result = await runSf(args, { timeout: 300000 });
  if (!result.ok) {
    res.status(200).json({ ok: false, message: result.message });
    return;
  }

  const lastCliLoginAt = new Date().toISOString();
  await captureConnectedOrg(alias, { client, lastCliLoginAt });
  res.json({ ok: true, message: `${alias} authenticated in Salesforce CLI.` });
}));

app.use(express.static(distDir));

app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/local-api")) {
    next();
    return;
  }
  res.sendFile(path.join(distDir, "index.html"));
});

export function startServer(options = {}) {
  const host = options.host || "127.0.0.1";
  const serverPort = Number(options.port || port);

  return new Promise((resolve, reject) => {
    const server = app.listen(serverPort, host, () => {
      console.log(`Sales Dex API available at http://${host}:${serverPort}`);
      resolve(server);
    });
    server.on("error", reject);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
