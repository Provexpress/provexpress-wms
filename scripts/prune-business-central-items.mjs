import fs from "node:fs/promises";
import path from "node:path";

const KEEP_PREFIX = "SIM-TON-";
const EXECUTE = process.argv.includes("--execute");
const BLOCK_ONLY = process.argv.includes("--block-only");
const CONFIRMED_DELETE = process.argv.includes("--confirm=KEEP_ONLY_SIM-TON");
const CONFIRMED_BLOCK = process.argv.includes("--confirm=BLOCK_NON_SIM_TON");
const CONFIG_PATH = path.resolve("vite.config.js");
const BACKUP_DIR = path.resolve("data", "backups");

function readConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*["']([^"']+)["']`));
  if (!match) throw new Error(`No se encontró ${key} en vite.config.js`);
  return match[1];
}

async function getConfig() {
  const source = await fs.readFile(CONFIG_PATH, "utf8");
  return {
    tenantId: readConfigValue(source, "tenantId"),
    clientId: readConfigValue(source, "clientId"),
    clientSecret: readConfigValue(source, "clientSecret"),
    environment: readConfigValue(source, "environment"),
    companyId: readConfigValue(source, "companyId")
  };
}

async function getAccessToken(config) {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://api.businesscentral.dynamics.com/.default"
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    }
  );
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || `Error OAuth ${response.status}`);
  }
  return data.access_token;
}

async function fetchAllItems(config, token) {
  let url = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/v2.0/companies(${config.companyId})/items`;
  const items = [];

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `Error listando artículos: ${response.status}`);
    }
    items.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }

  return items;
}

function isKeptItem(item) {
  return String(item.number || "").trim().toUpperCase().startsWith(KEEP_PREFIX);
}

function safeTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function deleteItem(config, token, item) {
  const url = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/v2.0/companies(${config.companyId})/items(${item.id})`;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "If-Match": item["@odata.etag"] || "*"
      }
    });

    if (response.status === 204) {
      return { number: item.number, id: item.id, status: 204, deleted: true };
    }

    const responseText = await response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after")) || attempt * 2;
      await wait(retryAfter * 1000);
      continue;
    }

    return {
      number: item.number,
      id: item.id,
      status: response.status,
      deleted: false,
      error: responseText.slice(0, 1000)
    };
  }
}

async function blockItem(config, token, item) {
  const url = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/v2.0/companies(${config.companyId})/items(${item.id})`;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "If-Match": item["@odata.etag"] || "*"
      },
      body: JSON.stringify({ blocked: true })
    });

    if (response.ok) {
      return { number: item.number, id: item.id, status: response.status, blocked: true };
    }

    const responseText = await response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      const retryAfter = Number(response.headers.get("retry-after")) || attempt * 3;
      await wait(retryAfter * 1000);
      continue;
    }

    return {
      number: item.number,
      id: item.id,
      status: response.status,
      blocked: false,
      error: responseText.slice(0, 1000)
    };
  }
}

async function runPool(items, worker, concurrency = 4) {
  const results = new Array(items.length);
  let cursor = 0;
  let completed = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
      completed += 1;
      if (completed % 25 === 0 || completed === items.length) {
        const successful = results.filter(Boolean).filter(result => result.deleted || result.blocked).length;
        console.log(`Procesados ${completed}/${items.length}; exitosos ${successful}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  return results;
}

const config = await getConfig();
const token = await getAccessToken(config);
const itemsBefore = await fetchAllItems(config, token);
const keepItems = itemsBefore.filter(isKeptItem);
const deleteTargets = itemsBefore.filter(item => !isKeptItem(item));
const operationTargets = BLOCK_ONLY ? deleteTargets.filter(item => !item.blocked) : deleteTargets;
const runId = safeTimestamp();
const backupPath = path.join(BACKUP_DIR, `business-central-items-before-prune-${runId}.json`);
const reportPath = path.join(BACKUP_DIR, `business-central-${BLOCK_ONLY ? "block" : "prune"}-report-${runId}.json`);

await writeJson(backupPath, {
  createdAt: new Date().toISOString(),
  environment: config.environment,
  companyId: config.companyId,
  keepPrefix: KEEP_PREFIX,
  total: itemsBefore.length,
  keepCount: keepItems.length,
  deleteCount: deleteTargets.length,
  items: itemsBefore
});

console.log(`Respaldo: ${backupPath}`);
console.log(`Total: ${itemsBefore.length}; conservar: ${keepItems.length}; ${BLOCK_ONLY ? "bloquear" : "eliminar"}: ${operationTargets.length}`);

if (!EXECUTE) {
  console.log("Simulación terminada. No se modificó Business Central.");
  process.exit(0);
}

if (BLOCK_ONLY && !CONFIRMED_BLOCK) {
  throw new Error("Falta --confirm=BLOCK_NON_SIM_TON; no se bloqueó ningún artículo.");
}

if (!BLOCK_ONLY && !CONFIRMED_DELETE) {
  throw new Error("Falta --confirm=KEEP_ONLY_SIM-TON; no se ejecutó ninguna eliminación.");
}

const results = await runPool(
  operationTargets,
  item => BLOCK_ONLY ? blockItem(config, token, item) : deleteItem(config, token, item),
  4
);
const itemsAfter = await fetchAllItems(config, token);
const remainingOutsidePrefix = itemsAfter.filter(item => !isKeptItem(item));
const succeeded = results.filter(result => result.deleted || result.blocked);
const failed = results.filter(result => !result.deleted && !result.blocked);
const activeOutsidePrefix = remainingOutsidePrefix.filter(item => !item.blocked);

await writeJson(reportPath, {
  completedAt: new Date().toISOString(),
  environment: config.environment,
  keepPrefix: KEEP_PREFIX,
  before: itemsBefore.length,
  operation: BLOCK_ONLY ? "BLOCK" : "DELETE",
  requestedChanges: operationTargets.length,
  successfulCount: succeeded.length,
  failedCount: failed.length,
  after: itemsAfter.length,
  keptAfter: itemsAfter.filter(isKeptItem).length,
  remainingOutsidePrefix: remainingOutsidePrefix.length,
  activeOutsidePrefix: activeOutsidePrefix.length,
  succeeded,
  failed
});

console.log(`Reporte: ${reportPath}`);
console.log(`Resultado: exitosos ${succeeded.length}; fallidos ${failed.length}; activos fuera del prefijo ${activeOutsidePrefix.length}`);

if ((BLOCK_ONLY ? activeOutsidePrefix.length : remainingOutsidePrefix.length) > 0) {
  process.exitCode = 2;
}
