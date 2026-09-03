import fs from "node:fs/promises";
import path from "node:path";

const PREFIX = "SIM-TON-";
const PROJECT_ROOT = path.resolve(".");
const BACKUP_DIR = path.join(PROJECT_ROOT, "data", "backups");
const PRODUCTS_PATH = path.join(PROJECT_ROOT, "src", "data", "products.json");

function safeTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function detectBrand(number, displayName) {
  const text = `${number} ${displayName}`.toUpperCase();
  if (text.includes("HP") || /\b(CF|CE|W\d|Q\d)/.test(text)) return "HP";
  if (text.includes("XEROX") || text.includes("113R")) return "Xerox";
  if (text.includes("LEXMARK")) return "Lexmark";
  if (text.includes("RICOH")) return "Ricoh";
  if (text.includes("KYOCERA") || text.includes("TK-")) return "Kyocera";
  if (text.includes("SAMSUNG") || text.includes("MLT")) return "Samsung";
  if (text.includes("BROTHER") || /\b(TN|DR)-?\d/.test(text)) return "Brother";
  if (text.includes("CANON")) return "Canon";
  return "Genérico / Otras";
}

const backupFiles = (await fs.readdir(BACKUP_DIR))
  .filter(name => name.startsWith("business-central-items-before-prune-") && name.endsWith(".json"))
  .sort();

if (backupFiles.length === 0) {
  throw new Error("No existe un respaldo de Business Central para generar el catálogo.");
}

const sourcePath = path.join(BACKUP_DIR, backupFiles.at(-1));
const backupSource = JSON.parse(await fs.readFile(sourcePath, "utf8"));
let sourceItems = backupSource.items;
let sourceDescription = sourcePath;

try {
  const liveResponse = await fetch("http://127.0.0.1:3000/api/bc/items");
  const liveData = await liveResponse.json();
  if (liveResponse.ok && Array.isArray(liveData.value)) {
    sourceItems = liveData.value;
    sourceDescription = "Business Central mediante http://127.0.0.1:3000/api/bc/items";
  }
} catch {
  // Si el servidor local no está activo, se utiliza el último respaldo completo.
}

const previousProducts = JSON.parse(await fs.readFile(PRODUCTS_PATH, "utf8"));
const previousBySku = new Map(previousProducts.map(product => [String(product.sku).toUpperCase(), product]));

const products = sourceItems
  .filter(item => String(item.number || "").trim().toUpperCase().startsWith(PREFIX))
  .sort((left, right) => left.number.localeCompare(right.number))
  .map((item, index) => {
    const sku = String(item.number).trim().toUpperCase();
    const previous = previousBySku.get(sku) || {};
    const stock = Number(item.inventory) || 0;
    const unitCost = Number(item.unitCost) || 0;

    return {
      id: index + 1,
      sku,
      name: item.displayName || previous.name || sku,
      brand: previous.brand || detectBrand(sku, item.displayName),
      category: "Impresión y Suministros",
      uom: item.baseUnitOfMeasureCode || previous.uom || "PCS",
      stock,
      unitCost,
      unitPrice: Number(item.unitPrice) || previous.unitPrice || 0,
      totalValue: Math.round(stock * unitCost),
      location: previous.location || "COTA",
      bin: previous.bin || "COTA-A01-N1-P01",
      gtin: item.gtin || previous.gtin || sku.replace(/^SIM-TON-/, ""),
      isSerialized: false
    };
  });

const localBackupPath = path.join(BACKUP_DIR, `app-products-before-sim-ton-${safeTimestamp()}.json`);
await fs.writeFile(localBackupPath, JSON.stringify(previousProducts, null, 2), "utf8");
await fs.writeFile(PRODUCTS_PATH, JSON.stringify(products, null, 2) + "\n", "utf8");

console.log(`Fuente: ${sourceDescription}`);
console.log(`Respaldo local: ${localBackupPath}`);
console.log(`Catálogo generado: ${products.length} referencias ${PREFIX}*`);
