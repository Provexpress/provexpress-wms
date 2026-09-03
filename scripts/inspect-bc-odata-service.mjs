import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../vite.config.js", import.meta.url), "utf8");

function readConfigValue(key) {
  const match = source.match(new RegExp(`${key}:\\s*["']([^"']+)["']`));
  if (!match) throw new Error(`No se encontró ${key} en vite.config.js`);
  return match[1];
}

const config = {
  tenantId: readConfigValue("tenantId"),
  clientId: readConfigValue("clientId"),
  clientSecret: readConfigValue("clientSecret"),
  environment: readConfigValue("environment"),
  companyName: readConfigValue("companyName")
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
if (!tokenResponse.ok || !tokenData.access_token) {
  throw new Error(tokenData.error_description || `Error OAuth ${tokenResponse.status}`);
}

const root = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/ODataV4`;
const headers = { Authorization: `Bearer ${tokenData.access_token}` };
const [serviceResponse, metadataResponse] = await Promise.all([
  fetch(root, { headers }),
  fetch(`${root}/$metadata`, { headers })
]);
const service = await serviceResponse.json();
const metadata = await metadataResponse.text();
if (!serviceResponse.ok) throw new Error(service?.error?.message || `Error servicio ${serviceResponse.status}`);
if (!metadataResponse.ok) throw new Error(`Error metadata ${metadataResponse.status}: ${metadata.slice(0, 500)}`);

const matchingServices = (service.value || []).filter(entry =>
  /item|journal|invent|post|^px/i.test(`${entry.name} ${entry.url}`)
);
const actions = [...metadata.matchAll(/<Action\b[\s\S]*?<\/Action>/g)]
  .map(match => match[0])
  .filter(action => /item|journal|invent|post/i.test(action));
const entityFragments = [...metadata.matchAll(/<(?:EntityType|EntitySet)\b[^>]*(?:PXItemJournal|ItemJournal)[^>]*>[\s\S]*?<\/(?:EntityType|EntitySet)>|<(?:EntityType|EntitySet)\b[^>]*(?:PXItemJournal|ItemJournal)[^>]*\/>/gi)]
  .map(match => match[0]);
const imports = [...metadata.matchAll(/<(?:ActionImport|FunctionImport)\b[^>]*\/>/g)]
  .map(match => match[0])
  .filter(value => /item|journal|invent|post|^px/i.test(value));
const soapUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/WS/${encodeURIComponent(config.companyName)}/Services`;
const soapResponse = await fetch(soapUrl, { headers });
const soapServices = await soapResponse.text();
const matchingSoapServices = [...soapServices.matchAll(/<contractRef[^>]*ref="([^"]+)"[^>]*docRef="([^"]+)"[^>]*\/>/g)]
  .map(([, ref, docRef]) => ({ ref, docRef }))
  .filter(value => /item|journal|invent|post|px/i.test(`${value.ref} ${value.docRef}`));
const apiMetadataResponse = await fetch(
  `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/api/v2.0/$metadata`,
  { headers }
);
const apiMetadata = await apiMetadataResponse.text();
const matchingApiActions = [...apiMetadata.matchAll(/<Action\b[\s\S]*?<\/Action>/g)]
  .map(match => match[0])
  .filter(action => /item|journal|invent|adjust|post/i.test(action));

console.log(JSON.stringify({
  matchingServices,
  entityFragments,
  actions,
  imports,
  soapStatus: soapResponse.status,
  matchingSoapServices,
  soapPreview: matchingSoapServices.length === 0 ? soapServices.slice(0, 2000) : undefined,
  apiMetadataStatus: apiMetadataResponse.status,
  matchingApiActions
}, null, 2));
