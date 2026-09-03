import fs from "node:fs/promises";
import path from "node:path";

const CONFIG_PATH = path.resolve("vite.config.js");
const DB_PATH = path.resolve("data", "kardex-db.json");
const MARKER = "CONTEO DEPURADO 816";
const EXPECTED_REFERENCES = 122;
const EXPECTED_QUANTITY = 816;

function readConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*["']([^"']+)["']`));
  if (!match) throw new Error(`No se encontró ${key} en vite.config.js`);
  return match[1];
}

const source = await fs.readFile(CONFIG_PATH, "utf8");
const config = Object.fromEntries([
  "tenantId", "clientId", "clientSecret", "environment", "companyName", "companyId"
].map(key => [key, readConfigValue(source, key)]));
const params = new URLSearchParams({
  grant_type: "client_credentials",
  client_id: config.clientId,
  client_secret: config.clientSecret,
  scope: "https://api.businesscentral.dynamics.com/.default"
});
const tokenResponse = await fetch(
  `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  }
);
const tokenData = await tokenResponse.json();
if (!tokenResponse.ok || !tokenData.access_token) {
  throw new Error(tokenData.error_description || `Error OAuth ${tokenResponse.status}`);
}
const token = tokenData.access_token;
const headers = { Authorization: `Bearer ${token}` };
const odataRoot = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/ODataV4/Company('${encodeURIComponent(config.companyName)}')`;
const filter = encodeURIComponent(
  `Journal_Template_Name eq 'ITEM' and Journal_Batch_Name eq 'DEFAULT' and Description eq '${MARKER}'`
);
const linesResponse = await fetch(`${odataRoot}/PXItemJournal?$filter=${filter}`, { headers });
const linesData = await linesResponse.json();
if (!linesResponse.ok) throw new Error(linesData?.error?.message || `Error diario ${linesResponse.status}`);
const lines = linesData.value || [];
const quantity = lines.reduce((sum, line) => sum + Number(line.Quantity || 0), 0);
if (lines.length !== EXPECTED_REFERENCES || quantity !== EXPECTED_QUANTITY) {
  throw new Error(`Diario inesperado: ${lines.length} líneas y ${quantity} unidades`);
}

const first = lines.sort((a, b) => a.Line_No - b.Line_No)[0];
const actionUrl = `${odataRoot}/PXItemJournal(Journal_Template_Name='ITEM',Journal_Batch_Name='DEFAULT',Line_No=${first.Line_No})/NAV.Post`;
const postResponse = await fetch(actionUrl, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: "{}"
});
const postText = await postResponse.text();
console.log(`Acción NAV.Post: HTTP ${postResponse.status}`);
if (!postResponse.ok) {
  console.log(postText.slice(0, 1500));
  process.exitCode = 2;
  process.exit();
}

await new Promise(resolve => setTimeout(resolve, 2000));
const itemsUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/v2.0/companies(${config.companyId})/items?$filter=${encodeURIComponent("startswith(number,'SIM-TON-') and blocked eq false")}&$select=number,inventory`;
const itemsResponse = await fetch(itemsUrl, { headers });
const itemsData = await itemsResponse.json();
if (!itemsResponse.ok) throw new Error(itemsData?.error?.message || `Error artículos ${itemsResponse.status}`);
const inventory = (itemsData.value || []).reduce((sum, item) => sum + Number(item.inventory || 0), 0);
if (inventory !== EXPECTED_QUANTITY) {
  throw new Error(`Dynamics registró una cantidad inesperada: ${inventory}`);
}

const localDatabase = JSON.parse(await fs.readFile(DB_PATH, "utf8"));
for (const movement of localDatabase.movements || []) {
  movement.bcStatus = "REGISTRADO_EN_DYNAMICS";
}
await fs.writeFile(DB_PATH, JSON.stringify(localDatabase, null, 2) + "\n", "utf8");
console.log(`Registro completo: ${inventory} unidades visibles en inventario.`);
