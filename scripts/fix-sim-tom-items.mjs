import fs from "node:fs/promises";
import path from "node:path";

const CORRECT_PREFIX = "SIM-TON-";
const WRONG_PREFIX_PATTERN = /^(SIM-TOM|SIN-TON|SIN-TOM|SOM-TON)-/i;
const EXACT_NUMBER_CORRECTIONS = new Map([
  ["SIM-TON-MTLD111S", "SIM-TON-MLTD111S"],
  ["SIM-TON-W2021", "SIM-TON-W2021A"]
]);
const EXECUTE = process.argv.includes("--execute");
const CONFIRMED = process.argv.includes("--confirm=FIX_INVALID_TON_PREFIXES");
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
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Error listando artículos: ${response.status}`);
    items.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return items;
}

function safeTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function updateItem(config, token, item, correctedNumber) {
  const url = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/v2.0/companies(${config.companyId})/items(${item.id})`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "If-Match": item["@odata.etag"] || "*"
    },
    body: JSON.stringify({ number: correctedNumber, blocked: false })
  });
  const responseText = await response.text();
  if (!response.ok) {
    return {
      success: false,
      id: item.id,
      before: item.number,
      after: correctedNumber,
      status: response.status,
      error: responseText.slice(0, 1500)
    };
  }
  const updated = responseText ? JSON.parse(responseText) : null;
  return {
    success: true,
    id: item.id,
    before: item.number,
    after: updated?.number || correctedNumber,
    blocked: updated?.blocked,
    status: response.status
  };
}

function getCorrectedNumber(number) {
  const normalized = String(number || "").trim().toUpperCase();
  return EXACT_NUMBER_CORRECTIONS.get(normalized) || normalized.replace(WRONG_PREFIX_PATTERN, CORRECT_PREFIX);
}

const config = await getConfig();
const token = await getAccessToken(config);
const itemsBefore = await fetchAllItems(config, token);
const targets = itemsBefore.filter(item =>
  WRONG_PREFIX_PATTERN.test(String(item.number || "").trim()) ||
  EXACT_NUMBER_CORRECTIONS.has(String(item.number || "").trim().toUpperCase())
);
const existingNumbers = new Set(itemsBefore.map(item => String(item.number || "").trim().toUpperCase()));
const conflicts = targets
  .map(item => ({ before: item.number, after: getCorrectedNumber(item.number) }))
  .filter(mapping => existingNumbers.has(mapping.after.toUpperCase()));

if (conflicts.length > 0) {
  throw new Error(`Existen números destino duplicados: ${JSON.stringify(conflicts)}`);
}

await fs.mkdir(BACKUP_DIR, { recursive: true });
const runId = safeTimestamp();
const backupPath = path.join(BACKUP_DIR, `invalid-ton-prefixes-before-correction-${runId}.json`);
const reportPath = path.join(BACKUP_DIR, `invalid-ton-prefixes-correction-report-${runId}.json`);
await fs.writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), targets }, null, 2), "utf8");

console.log(`Referencias encontradas: ${targets.length}`);
for (const item of targets) {
  console.log(`${item.number} -> ${getCorrectedNumber(item.number)}`);
}
console.log(`Respaldo: ${backupPath}`);

if (!EXECUTE) {
  console.log("Simulación terminada. No se modificó Business Central.");
  process.exit(0);
}

if (!CONFIRMED) {
  throw new Error("Falta --confirm=FIX_INVALID_TON_PREFIXES; no se aplicaron cambios.");
}

const results = [];
for (const item of targets) {
  const correctedNumber = getCorrectedNumber(item.number);
  const result = await updateItem(config, token, item, correctedNumber);
  results.push(result);
  console.log(`${result.success ? "OK" : "ERROR"}: ${item.number} -> ${correctedNumber}`);
}

const itemsAfter = await fetchAllItems(config, token);
const remainingWrong = itemsAfter.filter(item =>
  WRONG_PREFIX_PATTERN.test(String(item.number || "").trim()) ||
  EXACT_NUMBER_CORRECTIONS.has(String(item.number || "").trim().toUpperCase())
);
const correctedActive = itemsAfter.filter(item =>
  targets.some(target => getCorrectedNumber(target.number) === item.number) && !item.blocked
);

await fs.writeFile(reportPath, JSON.stringify({
  completedAt: new Date().toISOString(),
  requested: targets.length,
  successful: results.filter(result => result.success).length,
  failed: results.filter(result => !result.success).length,
  remainingWrong: remainingWrong.length,
  correctedActive: correctedActive.length,
  results
}, null, 2), "utf8");

console.log(`Reporte: ${reportPath}`);
console.log(`Resultado: corregidas ${correctedActive.length}; prefijos inválidos restantes ${remainingWrong.length}`);

if (remainingWrong.length > 0 || correctedActive.length !== targets.length) {
  process.exitCode = 2;
}
