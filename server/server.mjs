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
    const parsed = JSON.parse(raw);
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
        try {
          parsed = JSON.parse(trimmedStdout);
        } catch {
          parsed = null;
        }
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
  if (parsed?.message) return parsed.message;
  if (parsed?.name && parsed?.message) return `${parsed.name}: ${parsed.message}`;
  if (stderr?.trim()) return stderr.trim();
  if (error?.code === "ENOENT") return "Salesforce CLI was not found. Install Salesforce CLI or confirm that the 'sf' command is in PATH.";
  if (error?.killed) return "The Salesforce CLI command took longer than expected and was interrupted.";
  return error?.message || "Unable to run Salesforce CLI command.";
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
  const metadataByAlias = new Map(metadata.map((item) => [item.alias, item]));
  return cliOrgs.map((org) => {
    const local = metadataByAlias.get(org.alias) || metadataByAlias.get(org.username) || {};
    const localEnvironment = normalizeEnvironment(local.environment);
    return {
      ...org,
      client: local.client || "",
      riskLevel: normalizeRiskLevel(local.riskLevel),
      notes: local.notes || "",
      localEnvironment,
      effectiveEnvironment: localEnvironment && localEnvironment !== "Unknown" ? localEnvironment : org.environment,
      localLastUsedAt: local.lastUsedAt || "",
      metadataUpdatedAt: local.updatedAt || ""
    };
  });
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
    notes: local?.notes || ""
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
  if (!aliasPattern.test(value)) {
    throw new Error("Use a simple alias with letters, numbers, dot, hyphen, or underscore.");
  }
  return value;
}

async function touchLastUsed(alias) {
  const config = await readConfig();
  const now = new Date().toISOString();
  const index = config.orgs.findIndex((item) => item.alias === alias);
  if (index >= 0) {
    config.orgs[index] = { ...config.orgs[index], lastUsedAt: now };
  } else {
    config.orgs.push({ alias, client: "", environment: "Unknown", riskLevel: "Medium", notes: "", updatedAt: now, lastUsedAt: now });
  }
  await writeConfig(config);
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
      orgs: mergeLocalMetadata([], config.orgs),
      localOrgs: config.orgs
    });
    return;
  }

  const orgs = mergeLocalMetadata(flattenOrgList(listResult.result), config.orgs);
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
  const local = config.orgs.find((item) => item.alias === target);
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
  const index = config.orgs.findIndex((item) => item.alias === metadata.alias);

  if (index >= 0) {
    config.orgs[index] = { ...config.orgs[index], ...metadata };
  } else {
    config.orgs.push(metadata);
  }

  await writeConfig(config);
  res.json({ ok: true, org: index >= 0 ? config.orgs[index] : metadata });
}));

app.post("/local-api/actions/default", asyncRoute(async (req, res) => {
  const target = validateTarget(req.body.target);
  const result = await runSf(["config", "set", `target-org=${target}`, "--json"]);
  if (!result.ok) {
    res.status(200).json({ ok: false, message: result.message });
    return;
  }
  await touchLastUsed(target);
  res.json({ ok: true, message: `${target} is now the default org.` });
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
  const result = await runSf(["org", "logout", "--target-org", target, "--no-prompt", "--json"]);
  if (!result.ok) {
    res.status(200).json({ ok: false, message: result.message });
    return;
  }
  res.json({ ok: true, message: `${target} disconnected from Salesforce CLI.` });
}));

app.post("/local-api/actions/login", asyncRoute(async (req, res) => {
  const alias = validateLoginAlias(req.body.alias);
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

  await touchLastUsed(alias);
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
