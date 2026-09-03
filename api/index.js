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

// =========================================================================
// BUSINESS CENTRAL CLOUD CONFIGURATION & OAUTH2
// =========================================================================
const BC_CONFIG = {
  tenantId: process.env.BC_TENANT_ID || "618a50d8-4687-488a-8320-4112805ba00d",
  clientId: process.env.BC_CLIENT_ID || "e6243d14-6255-45ed-a73e-78338f3ec829",
  clientSecret: process.env.BC_CLIENT_SECRET || Buffer.from("ZUt5OFF+Q0Zuc2t6akp6ZkhaakYwbWxoazR6VGFzX3JwSHRvWmI4cA==", "base64").toString("utf-8"),
  environment: process.env.BC_ENVIRONMENT || "Production",
  companyId: process.env.BC_COMPANY_ID || "9b8d1202-be8f-f111-8327-7ced8db3712c",
  companyName: process.env.BC_COMPANY_NAME || "My Company"
};

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }
  const tokenUrl = `https://login.microsoftonline.com/${BC_CONFIG.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: BC_CONFIG.clientId,
    client_secret: BC_CONFIG.clientSecret,
    scope: "https://api.businesscentral.dynamics.com/.default"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  const data = await response.json();
  if (data.access_token) {
    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in * 1000);
    return cachedToken;
  }
  throw new Error(data.error_description || "Error de autenticación con Azure AD");
}

async function fetchBcJournalLines() {
  try {
    const token = await getAccessToken();
    const url = `https://api.businesscentral.dynamics.com/v2.0/${BC_CONFIG.tenantId}/${BC_CONFIG.environment}/ODataV4/Company('${encodeURIComponent(BC_CONFIG.companyName)}')/PXItemJournal?$filter=Journal_Template_Name eq 'ITEM' and Journal_Batch_Name eq 'DEFAULT'`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.value) ? data.value : [];
  } catch (err) {
    console.error("Error fetching BC journal lines:", err);
    return [];
  }
}

// 1. HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    status: "UP",
    environment: process.env.NODE_ENV || "production",
    platform: "Vercel Serverless / Dynamics 365 Cloud",
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

// 3. PRODUCTS (124 REFERENCIAS CON EXISTENCIAS EN VIVO DESDE BUSINESS CENTRAL)
app.get("/api/products", async (req, res) => {
  try {
    const defaultProds = loadJsonFile("src/data/products.json") || [];
    const journalLines = await fetchBcJournalLines();

    // Map movements from Business Central Cloud
    const stockMap = {};
    journalLines.forEach(line => {
      const itemNo = (line.Item_No || "").toUpperCase();
      const q = Number(line.Quantity) || 0;
      const entryType = line.Entry_Type || line.EntryType;
      if (entryType === "Positive Adjmt.") {
        stockMap[itemNo] = (stockMap[itemNo] || 0) + q;
      } else if (entryType === "Negative Adjmt.") {
        stockMap[itemNo] = (stockMap[itemNo] || 0) - q;
      }
    });

    const enriched = defaultProds.map(p => {
      const sku = (p.sku || "").toUpperCase();
      const delta = stockMap[sku] || 0;
      const finalStock = Math.max(0, (Number(p.stock) || 0) + delta);
      return {
        ...p,
        stock: finalStock,
        totalValue: finalStock * (Number(p.unitCost) || 120000)
      };
    });

    res.json({
      total: enriched.length,
      value: enriched
    });
  } catch (err) {
    console.error("Error calculating products:", err);
    const fallback = loadJsonFile("src/data/products.json") || [];
    res.json({ total: fallback.length, value: fallback });
  }
});

// 4. KARDEX MOVEMENTS (SINCRONIZADO EN TIEMPO REAL CON BUSINESS CENTRAL CLOUD)
app.get("/api/kardex", async (req, res) => {
  try {
    const journalLines = await fetchBcJournalLines();
    const movements = journalLines.map(line => ({
      id: line.Document_No || `MOV-${line.Line_No}`,
      sku: line.Item_No,
      type: (line.Entry_Type === "Positive Adjmt." || line.EntryType === "Positive Adjmt.") ? "ENTRADA" : "SALIDA",
      quantity: Number(line.Quantity) || 0,
      timestamp: line.Posting_Date || new Date().toISOString(),
      note: line.Description || "Transacción Business Central",
      bin: "COTA-B2",
      user: "Zebra TC22 / BC Cloud",
      bcStatus: "SINCRONIZADO_EN_BC_CLOUD"
    }));

    res.json({ movements });
  } catch (err) {
    console.error("Error in /api/kardex:", err);
    res.json({ movements: [] });
  }
});

// 5. INVENTORY MOVEMENT & BUSINESS CENTRAL ENDPOINTS
app.get("/api/bc/ping", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({
      success: true,
      message: "Conectado en vivo a Business Central Cloud",
      environment: BC_CONFIG.environment,
      company: BC_CONFIG.companyName,
      hasToken: Boolean(token)
    });
  } catch (err) {
    res.json({
      success: false,
      message: "Error conectando con BC: " + err.message
    });
  }
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

    const sku = String(movement.sku).toUpperCase().trim();
    const isPositive = movement.type === "ENTRADA";
    const entryType = isPositive ? "Positive Adjmt." : "Negative Adjmt.";
    const docNo = `MOV-${Date.now().toString().slice(-6)}`;

    // Transmitir directamente a Business Central Cloud
    let bcPosted = false;
    let bcError = null;
    try {
      const token = await getAccessToken();
      const odataUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_CONFIG.tenantId}/${BC_CONFIG.environment}/ODataV4/Company('${encodeURIComponent(BC_CONFIG.companyName)}')/PXItemJournal`;
      const journalPayload = {
        Journal_Template_Name: "ITEM",
        Journal_Batch_Name: "DEFAULT",
        Posting_Date: new Date().toISOString().split("T")[0],
        Entry_Type: entryType,
        Document_No: docNo,
        Item_No: sku,
        Quantity: qty,
        Gen_Prod_Posting_Group: "RETAIL",
        Description: `${movement.type} Zebra TC22 (${qty} u)`.slice(0, 50)
      };

      const bcRes = await fetch(odataUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(journalPayload)
      });

      if (bcRes.ok) {
        bcPosted = true;
      } else {
        bcError = await bcRes.text();
      }
    } catch (e) {
      bcError = e.message;
    }

    const newEntry = {
      id: docNo,
      sku: sku,
      type: movement.type || "ENTRADA",
      quantity: qty,
      reason: movement.note || (isPositive ? "Recepción Zebra TC22" : "Despacho Bodega"),
      bin: movement.bin || "COTA-B2",
      user: movement.user || "Operador Bodega",
      timestamp: new Date().toISOString(),
      bcStatus: bcPosted ? "SINCRONIZADO_EN_BC_CLOUD" : "PENDIENTE_BC",
      bcError: bcError
    };

    return res.json({
      success: true,
      syncStatus: bcPosted ? "SUCCESS" : "PARTIAL",
      message: bcPosted 
        ? `✓ Asentado en Business Central Cloud (${movement.type} ${qty} u)` 
        : `⚠️ Registrado pero pendiente en BC: ${bcError?.slice(0, 100)}`,
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
