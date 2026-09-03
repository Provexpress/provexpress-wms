import fs from "node:fs/promises";
import path from "node:path";

const EXECUTE = process.argv.includes("--execute");
const CONFIRMED = process.argv.includes("--confirm=RESTORE_816_UNITS");
const EXPECTED_REFERENCES = 122;
const EXPECTED_QUANTITY = 816;
const SOURCE_PATH = path.resolve(
  "data",
  "backups",
  "kardex-before-pilot-cleanup-2026-09-01T14-45-04-179Z.json"
);
const CONFIG_PATH = path.resolve("vite.config.js");
const DB_PATH = path.resolve("data", "kardex-db.json");
const BACKUP_DIR = path.resolve("data", "backups");
const MARKER = "CONTEO DEPURADO 816";

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
    companyName: readConfigValue(source, "companyName"),
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

function parseSpanishTimestamp(value) {
  const match = String(value).match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*([ap])\.\s*m\.$/i
  );
  if (!match) throw new Error(`Fecha no reconocida: ${value}`);
  const [, day, month, year, rawHour, minute, second, period] = match;
  let hour = Number(rawHour) % 12;
  if (period.toLowerCase() === "p") hour += 12;
  return new Date(Date.UTC(
    Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second)
  ));
}

function buildLatestCount(database) {
  const sourceMovements = (database.movements || []).filter(movement =>
    movement.note === "Recepción desde Zebra TC22 (Piloto)" &&
    String(movement.sku || "").startsWith("SIM-TON-")
  );
  const latestBySku = new Map();
  for (const movement of sourceMovements) {
    const normalized = {
      ...movement,
      sku: String(movement.sku).trim().toUpperCase(),
      quantity: Number(movement.quantity),
      parsedTimestamp: parseSpanishTimestamp(movement.timestamp)
    };
    if (!Number.isFinite(normalized.quantity) || normalized.quantity <= 0) {
      throw new Error(`Cantidad inválida para ${normalized.sku}: ${movement.quantity}`);
    }
    const existing = latestBySku.get(normalized.sku);
    if (!existing || normalized.parsedTimestamp > existing.parsedTimestamp) {
      latestBySku.set(normalized.sku, normalized);
    }
  }
  return [...latestBySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

async function fetchAll(url, token) {
  const values = [];
  let nextUrl = url;
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Error GET ${response.status}`);
    values.push(...(data.value || []));
    nextUrl = data["@odata.nextLink"] || null;
  }
  return values;
}

function journalUrl(config) {
  return `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/ODataV4/Company('${encodeURIComponent(config.companyName)}')/PXItemJournal`;
}

async function createJournalLine(config, token, movement) {
  const payload = {
    Journal_Template_Name: "ITEM",
    Journal_Batch_Name: "DEFAULT",
    Posting_Date: "2026-08-31",
    Entry_Type: "Positive Adjmt.",
    Document_No: movement.id,
    Item_No: movement.sku,
    Quantity: movement.quantity,
    Gen_Prod_Posting_Group: "RETAIL",
    Description: MARKER
  };
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(journalUrl(config), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const responseText = await response.text();
    if (response.ok) return JSON.parse(responseText);
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      const retryAfter = Number(response.headers.get("retry-after")) || attempt * 2;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    throw new Error(
      `No se pudo crear ${movement.sku} (${response.status}): ${responseText.slice(0, 1000)}`
    );
  }
}

function safeTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

const sourceDatabase = JSON.parse(await fs.readFile(SOURCE_PATH, "utf8"));
const restoredCount = buildLatestCount(sourceDatabase);
const restoredQuantity = restoredCount.reduce((sum, movement) => sum + movement.quantity, 0);

if (restoredCount.length !== EXPECTED_REFERENCES || restoredQuantity !== EXPECTED_QUANTITY) {
  throw new Error(
    `Conteo inesperado: ${restoredCount.length} referencias y ${restoredQuantity} unidades; ` +
    `se esperaban ${EXPECTED_REFERENCES} y ${EXPECTED_QUANTITY}`
  );
}

const config = await getConfig();
const token = await getAccessToken(config);
const itemsEndpoint = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/v2.0/companies(${config.companyId})/items?$select=id,number,displayName,blocked,inventory`;
const activeItems = await fetchAll(itemsEndpoint, token);
const itemByNumber = new Map(activeItems.map(item => [String(item.number).toUpperCase(), item]));
const missing = restoredCount.filter(movement => !itemByNumber.has(movement.sku));
const blocked = restoredCount.filter(movement => itemByNumber.get(movement.sku)?.blocked);
const withExistingInventory = restoredCount.filter(
  movement => Number(itemByNumber.get(movement.sku)?.inventory || 0) !== 0
);
if (missing.length > 0) throw new Error(`Referencias inexistentes: ${missing.map(value => value.sku).join(", ")}`);
if (blocked.length > 0) throw new Error(`Referencias bloqueadas: ${blocked.map(value => value.sku).join(", ")}`);
if (withExistingInventory.length > 0) {
  throw new Error(
    `Hay existencias previas en: ${withExistingInventory.map(value => value.sku).join(", ")}; ` +
    "se detuvo para evitar duplicarlas"
  );
}

const filter = encodeURIComponent("Journal_Template_Name eq 'ITEM' and Journal_Batch_Name eq 'DEFAULT'");
const linesBefore = await fetchAll(`${journalUrl(config)}?$filter=${filter}`, token);
const targetDocumentNumbers = new Set(restoredCount.map(movement => movement.id));
const existingTargetLines = linesBefore.filter(line =>
  line.Description === MARKER || targetDocumentNumbers.has(line.Document_No)
);
for (const line of existingTargetLines) {
  const expected = restoredCount.find(movement => movement.id === line.Document_No);
  if (!expected || line.Item_No !== expected.sku || Number(line.Quantity) !== expected.quantity) {
    throw new Error(`Línea existente inconsistente: ${line.Document_No || line.Line_No}`);
  }
}

const alreadyCreated = new Set(existingTargetLines.map(line => line.Document_No));
const pending = restoredCount.filter(movement => !alreadyCreated.has(movement.id));
console.log(`Conteo validado: ${restoredCount.length} referencias; ${restoredQuantity} unidades.`);
console.log(`Ya creadas: ${alreadyCreated.size}; pendientes: ${pending.length}.`);

if (!EXECUTE) {
  console.log("Simulación terminada. No se modificó Dynamics.");
  process.exit(0);
}
if (!CONFIRMED) {
  throw new Error("Falta --confirm=RESTORE_816_UNITS; no se creó ninguna línea.");
}

await fs.mkdir(BACKUP_DIR, { recursive: true });
const runId = safeTimestamp();
const backupPath = path.join(BACKUP_DIR, `before-restore-816-${runId}.json`);
const reportPath = path.join(BACKUP_DIR, `restore-816-report-${runId}.json`);
await fs.writeFile(backupPath, JSON.stringify({
  createdAt: new Date().toISOString(),
  linesBefore,
  localDatabaseBefore: JSON.parse(await fs.readFile(DB_PATH, "utf8")),
  restoredCount
}, null, 2), "utf8");

const created = [];
for (const movement of pending) {
  const line = await createJournalLine(config, token, movement);
  created.push(line);
  if (created.length % 20 === 0 || created.length === pending.length) {
    console.log(`Creadas ${created.length}/${pending.length}`);
  }
}

const linesAfter = await fetchAll(`${journalUrl(config)}?$filter=${filter}`, token);
const restoredLines = linesAfter.filter(line =>
  line.Description === MARKER && targetDocumentNumbers.has(line.Document_No)
);
const journalQuantity = restoredLines.reduce((sum, line) => sum + Number(line.Quantity || 0), 0);
if (restoredLines.length !== EXPECTED_REFERENCES || journalQuantity !== EXPECTED_QUANTITY) {
  throw new Error(
    `Verificación falló: diario tiene ${restoredLines.length} líneas y ${journalQuantity} unidades`
  );
}

const localMovements = restoredCount
  .sort((a, b) => b.parsedTimestamp - a.parsedTimestamp)
  .map(movement => ({
    id: movement.id,
    timestamp: movement.timestamp,
    type: "CONTEO",
    sku: movement.sku,
    productName: itemByNumber.get(movement.sku).displayName,
    quantity: movement.quantity,
    serialNo: "N/A",
    serialList: [],
    location: movement.location || "COTA",
    bin: movement.bin || "COTA-A01-N1-P01",
    user: movement.user || "Bodega Zebra",
    note: "Conteo físico deduplicado: último conteo por referencia",
    bcStatus: "PENDIENTE_DE_REGISTRO"
  }));
await fs.writeFile(DB_PATH, JSON.stringify({
  movements: localMovements,
  serials: {},
  customItems: []
}, null, 2) + "\n", "utf8");

await fs.writeFile(reportPath, JSON.stringify({
  completedAt: new Date().toISOString(),
  references: restoredLines.length,
  quantity: journalQuantity,
  createdNow: created.length,
  alreadyPresent: alreadyCreated.size,
  postingStatus: "PENDING",
  marker: MARKER,
  backupPath,
  lines: restoredLines
}, null, 2), "utf8");

console.log(`Respaldo: ${backupPath}`);
console.log(`Reporte: ${reportPath}`);
console.log(`Diario listo: ${restoredLines.length} líneas; ${journalQuantity} unidades; pendiente de registrar.`);
