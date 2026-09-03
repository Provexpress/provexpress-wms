import fs from "node:fs/promises";

const source = await fs.readFile("vite.config.js", "utf8");
const readValue = key => {
  const match = source.match(new RegExp(`${key}:\\s*["']([^"']+)["']`));
  if (!match) throw new Error(`No se encontró ${key}`);
  return match[1];
};

const config = {
  tenantId: readValue("tenantId"),
  clientId: readValue("clientId"),
  clientSecret: readValue("clientSecret"),
  environment: readValue("environment"),
  companyName: readValue("companyName")
};

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
if (!tokenResponse.ok) throw new Error(tokenData.error_description || "Error OAuth");

const journalFilter = encodeURIComponent("Journal_Template_Name eq 'ITEM' and Journal_Batch_Name eq 'DEFAULT'");
let url = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/ODataV4/Company('${encodeURIComponent(config.companyName)}')/PXItemJournal?$filter=${journalFilter}`;
const lines = [];
while (url) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Error ${response.status}`);
  lines.push(...(data.value || []));
  url = data["@odata.nextLink"] || null;
}

const simTonLines = lines.filter(line =>
  String(line.Item_No || "").toUpperCase().startsWith("SIM-TON-")
);
const otherLines = lines.filter(line =>
  !String(line.Item_No || "").toUpperCase().startsWith("SIM-TON-")
);
const quantity = simTonLines.reduce((sum, line) => sum + (Number(line.Quantity) || 0), 0);
const otherQuantity = otherLines.reduce((sum, line) => sum + (Number(line.Quantity) || 0), 0);
const groups = Object.values(simTonLines.reduce((result, line) => {
  const sku = String(line.Item_No).toUpperCase();
  result[sku] ??= { sku, lines: 0, quantity: 0 };
  result[sku].lines += 1;
  result[sku].quantity += Number(line.Quantity) || 0;
  return result;
}, {}));
const pilotLines = lines.filter(line =>
  String(line.Document_No || "").startsWith("MOV-") &&
  String(line.Description || "").includes("Zebra TC22")
);

console.log(JSON.stringify({
  fields: lines[0] ? Object.keys(lines[0]) : [],
  totalJournalLines: lines.length,
  pilotLines: pilotLines.length,
  pilotQuantity: pilotLines.reduce((sum, line) => sum + (Number(line.Quantity) || 0), 0),
  nonPilotLines: lines.length - pilotLines.length,
  nonPilotSample: lines.filter(line => !pilotLines.includes(line)).slice(0, 5),
  simTonLines: simTonLines.length,
  simTonQuantity: quantity,
  simTonReferences: groups.length,
  otherLines: otherLines.map(line => ({ item: line.Item_No, quantity: Number(line.Quantity) || 0 })),
  otherQuantity,
  largest: groups.sort((a, b) => b.quantity - a.quantity).slice(0, 15)
}, null, 2));
