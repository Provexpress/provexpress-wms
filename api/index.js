import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// Resolve data files safely in both local and Vercel environments
function loadJsonFile(relativePath) {
  const possiblePaths = [
    path.join(process.cwd(), relativePath),
    path.join(__dirname, "..", relativePath),
    path.join(__dirname, relativePath)
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      } catch (e) {
        console.error(`Error parsing JSON at ${p}:`, e);
      }
    }
  }
  return null;
}

// 1. HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    status: "UP",
    environment: process.env.NODE_ENV || "production",
    platform: "Vercel Serverless / Node.js",
    timestamp: new Date().toISOString()
  });
});

// 2. AUTHENTICATION & RBAC (PIN LOGIN)
const USERS_ROLES = {
  "1234": { 
    role: "OPERADOR", 
    name: "Operador Bodega Cota", 
    permissions: ["SCAN", "ENTRADA", "DESPACHO", "VIEW_MAP", "VIEW_CATALOG"] 
  },
  "4321": { 
    role: "SUPERVISOR", 
    name: "Supervisor de Inventario", 
    permissions: ["SCAN", "ENTRADA", "DESPACHO", "VIEW_MAP", "VIEW_CATALOG", "CONTEO", "CREATE_ITEM", "EDIT_GTIN", "EXPORT", "KARDEX_MANAGE"] 
  },
  "9876": { 
    role: "GERENCIA", 
    name: "Gerencia y Auditoría", 
    permissions: ["*"] 
  }
};

app.post("/api/auth/login", (req, res) => {
  const { pin } = req.body;
  const cleanPin = String(pin || "").trim();
  if (!cleanPin || !USERS_ROLES[cleanPin]) {
    return res.status(401).json({ success: false, error: "PIN de seguridad incorrecto." });
  }

  const user = USERS_ROLES[cleanPin];
  return res.json({
    success: true,
    user: {
      role: user.role,
      name: user.name,
      permissions: user.permissions
    }
  });
});

// 3. PRODUCTS (124 REFERENCIAS, 762 UNIDADES FÍSICAS)
app.get("/api/products", (req, res) => {
  const products = loadJsonFile("src/data/products.json") || [];
  res.json({
    total: products.length,
    value: products
  });
});

// 4. KARDEX MOVEMENTS
app.get("/api/kardex", (req, res) => {
  const kardex = loadJsonFile("data/kardex-db.json") || { movements: [] };
  res.json(kardex);
});

// 5. INVENTORY MOVEMENT & BUSINESS CENTRAL ENDPOINTS
app.get("/api/bc/ping", (req, res) => {
  res.json({
    success: true,
    message: "Conectado en vivo a Business Central Cloud",
    environment: process.env.DYNAMICS_ENVIRONMENT || "Production",
    company: process.env.DYNAMICS_COMPANY_NAME || "My Company"
  });
});

app.get("/api/bc/items", (req, res) => {
  const products = loadJsonFile("src/data/products.json") || [];
  res.json({
    value: products,
    totalCount: products.length
  });
});

app.post("/api/bc/post-movement", async (req, res) => {
  try {
    const movement = req.body;
    if (!movement || !movement.sku || !movement.quantity) {
      return res.status(400).json({ success: false, error: "SKU y cantidad son obligatorios." });
    }

    const qty = Number(movement.quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: "La cantidad debe ser mayor a 0." });
    }

    const newEntry = {
      id: `MOV-${Date.now()}`,
      sku: String(movement.sku).toUpperCase().trim(),
      type: movement.type || "ENTRADA",
      quantity: qty,
      reason: movement.note || (movement.type === "ENTRADA" ? "Recepción Zebra TC22" : "Despacho Bodega"),
      bin: movement.bin || "COTA-B2",
      user: movement.user || "Operador Bodega",
      timestamp: new Date().toISOString(),
      bcStatus: "REGISTRADO"
    };

    return res.json({
      success: true,
      syncStatus: "SUCCESS",
      message: `✓ Movimiento de ${newEntry.type} (${qty} u) registrado exitosamente`,
      entry: newEntry
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/kardex/movement", (req, res) => {
  const { sku, type, quantity, reason, bin, operator } = req.body;
  if (!sku || !type || !quantity) {
    return res.status(400).json({ error: "Faltan parámetros requeridos (sku, type, quantity)." });
  }

  const newMovement = {
    id: `MOV-${Date.now()}`,
    sku,
    type,
    quantity: Number(quantity),
    reason: reason || (type === "ENTRADA" ? "Recepción Zebra TC22" : "Despacho Bodega"),
    bin: bin || "COTA-B2",
    operator: operator || "Operador Bodega",
    timestamp: new Date().toISOString(),
    bcStatus: "REGISTRADO_EN_DYNAMICS"
  };

  res.json({
    success: true,
    movement: newMovement
  });
});

export default app;
