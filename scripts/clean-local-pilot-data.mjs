import fs from "node:fs/promises";
import path from "node:path";

const DB_PATH = path.resolve("data", "kardex-db.json");
const BACKUP_DIR = path.resolve("data", "backups");
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupPath = path.join(BACKUP_DIR, `kardex-before-pilot-cleanup-${runId}.json`);

const database = JSON.parse(await fs.readFile(DB_PATH, "utf8"));
await fs.mkdir(BACKUP_DIR, { recursive: true });
await fs.writeFile(backupPath, JSON.stringify(database, null, 2), "utf8");

const summary = {
  movementsRemoved: Array.isArray(database.movements) ? database.movements.length : 0,
  serialGroupsRemoved: database.serials ? Object.keys(database.serials).length : 0,
  customItemsRemoved: Array.isArray(database.customItems) ? database.customItems.length : 0
};

await fs.writeFile(DB_PATH, JSON.stringify({
  movements: [],
  serials: {},
  customItems: []
}, null, 2) + "\n", "utf8");

console.log(`Respaldo: ${backupPath}`);
console.log(JSON.stringify(summary));
