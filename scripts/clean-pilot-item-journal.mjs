import fs from "node:fs/promises";
import path from "node:path";

const EXECUTE = process.argv.includes("--execute");
const CONFIRMED = process.argv.includes("--confirm=DELETE_ZEBRA_PILOT_LINES");
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
    companyName: readConfigValue(source, "companyName")
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

function getCollectionUrl(config) {
  const filter = encodeURIComponent("Journal_Template_Name eq 'ITEM' and Journal_Batch_Name eq 'DEFAULT'");
  return `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/ODataV4/Company('${encodeURIComponent(config.companyName)}')/PXItemJournal?$filter=${filter}`;
}

async function fetchJournalLines(config, token) {
  let url = getCollectionUrl(config);
  const lines = [];
  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Error leyendo diario: ${response.status}`);
    lines.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return lines;
}

function isPilotLine(line) {
  return String(line.Document_No || "").startsWith("MOV-") &&
    String(line.Description || "").includes("Zebra TC22");
}

function escapeODataString(value) {
  return String(value).replaceAll("'", "''");
}

function getLineUrl(config, line) {
  const company = encodeURIComponent(config.companyName);
  const template = escapeODataString(line.Journal_Template_Name);
  const batch = escapeODataString(line.Journal_Batch_Name);
  return `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/ODataV4/Company('${company}')/PXItemJournal(Journal_Template_Name='${template}',Journal_Batch_Name='${batch}',Line_No=${line.Line_No})`;
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function deleteLine(config, token, line) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(getLineUrl(config, line), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "If-Match": line["@odata.etag"] || "*"
      }
    });
    if (response.status === 204) {
      return { success: true, lineNo: line.Line_No, documentNo: line.Document_No, quantity: line.Quantity };
    }
    const error = await response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      const retryAfter = Number(response.headers.get("retry-after")) || attempt * 2;
      await wait(retryAfter * 1000);
      continue;
    }
    return {
      success: false,
      lineNo: line.Line_No,
      documentNo: line.Document_No,
      status: response.status,
      error: error.slice(0, 1500)
    };
  }
}

function safeTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

const config = await getConfig();
const token = await getAccessToken(config);
const linesBefore = await fetchJournalLines(config, token);
const pilotLines = linesBefore.filter(isPilotLine);
const preservedLines = linesBefore.filter(line => !isPilotLine(line));
const runId = safeTimestamp();
const backupPath = path.join(BACKUP_DIR, `item-journal-before-pilot-cleanup-${runId}.json`);
const reportPath = path.join(BACKUP_DIR, `item-journal-pilot-cleanup-report-${runId}.json`);

await fs.mkdir(BACKUP_DIR, { recursive: true });
await fs.writeFile(backupPath, JSON.stringify({
  createdAt: new Date().toISOString(),
  totalLines: linesBefore.length,
  pilotLines: pilotLines.length,
  pilotQuantity: pilotLines.reduce((sum, line) => sum + (Number(line.Quantity) || 0), 0),
  preservedLines,
  lines: linesBefore
}, null, 2), "utf8");

console.log(`Líneas totales: ${linesBefore.length}`);
console.log(`Piloto a eliminar: ${pilotLines.length}`);
console.log(`Cantidad piloto: ${pilotLines.reduce((sum, line) => sum + (Number(line.Quantity) || 0), 0)}`);
console.log(`Líneas preservadas: ${preservedLines.length}`);
console.log(`Respaldo: ${backupPath}`);

if (!EXECUTE) {
  console.log("Simulación terminada. No se modificó el diario.");
  process.exit(0);
}

if (!CONFIRMED) {
  throw new Error("Falta --confirm=DELETE_ZEBRA_PILOT_LINES; no se eliminó ninguna línea.");
}

const results = [];
for (const line of pilotLines) {
  const result = await deleteLine(config, token, line);
  results.push(result);
  if (results.length % 20 === 0 || !result.success || results.length === pilotLines.length) {
    console.log(`Procesadas ${results.length}/${pilotLines.length}; eliminadas ${results.filter(value => value.success).length}`);
  }
}

const linesAfter = await fetchJournalLines(config, token);
const remainingPilot = linesAfter.filter(isPilotLine);
await fs.writeFile(reportPath, JSON.stringify({
  completedAt: new Date().toISOString(),
  requested: pilotLines.length,
  successful: results.filter(result => result.success).length,
  failed: results.filter(result => !result.success).length,
  remainingPilot: remainingPilot.length,
  remainingTotalLines: linesAfter.length,
  results
}, null, 2), "utf8");

console.log(`Reporte: ${reportPath}`);
console.log(`Resultado: piloto restante ${remainingPilot.length}; líneas totales restantes ${linesAfter.length}`);

if (remainingPilot.length > 0) process.exitCode = 2;
