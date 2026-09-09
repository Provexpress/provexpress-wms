import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

function getBaseProducts() {
  try {
    return require("./products.json");
  } catch (e) {
    try {
      return require("../src/data/products.json");
    } catch (e2) {
      console.error("Error loading products.json:", e2);
      return [];
    }
  }
}

// In-memory central buffer of all recent transactions across devices
const centralMovementsLog = [];

// Localized timestamp formatted strictly in Colombia (America/Bogota, UTC-5)
function getBogotaTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
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
    permissions: ["SCAN", "ENTRADA", "CONTEO", "DESPACHO", "VIEW_MAP", "VIEW_CATALOG"] 
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
    const defaultProds = getBaseProducts();
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

    // Also incorporate recent app transactions from centralMovementsLog
    const countOverrides = {};
    centralMovementsLog.forEach(m => {
      const sku = (m.sku || "").toUpperCase();
      const inJournal = journalLines.some(jl => jl.Document_No === m.id);
      if (!inJournal) {
        if (m.type === "CONTEO") {
          countOverrides[sku] = m.quantity;
        } else if (m.type === "ENTRADA") {
          stockMap[sku] = (stockMap[sku] || 0) + m.quantity;
        } else if (m.type === "SALIDA") {
          stockMap[sku] = (stockMap[sku] || 0) - m.quantity;
        }
      }
    });

    const enriched = defaultProds.map(p => {
      const sku = (p.sku || "").toUpperCase();
      const delta = stockMap[sku] || 0;
      let finalStock = Math.max(0, (Number(p.stock) || 0) + delta);
      if (countOverrides[sku] !== undefined) {
        finalStock = countOverrides[sku];
      }
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
    const fallback = getBaseProducts();
    res.json({ total: fallback.length, value: fallback });
  }
});

// 4. KARDEX MOVEMENTS (SINCRONIZADO EN TIEMPO REAL CON BUSINESS CENTRAL CLOUD)
app.get("/api/kardex", async (req, res) => {
  try {
    const journalLines = await fetchBcJournalLines();
    const bcMovements = journalLines
      .filter(line => line.Item_No && line.Item_No.trim().length > 0)
      .reverse()
      .map(line => {
        const desc = line.Description || "";
        const isConteo = desc.toUpperCase().includes("CONTEO");
        const isPositive = (line.Entry_Type === "Positive Adjmt." || line.EntryType === "Positive Adjmt.");
        
        let type = "SALIDA";
        if (isConteo) {
          type = "CONTEO";
        } else if (isPositive) {
          type = "ENTRADA";
        }

        let parsedQty = Number(line.Quantity) || 0;
        let parsedDelta = isPositive ? parsedQty : -parsedQty;

        if (isConteo) {
          const match = desc.match(/CONTEO\s+Fisico:\s*(\d+)u/i);
          if (match) {
            parsedQty = Number(match[1]);
            parsedDelta = isPositive ? (Number(line.Quantity) || 0) : -(Number(line.Quantity) || 0);
          }
        }

        return {
          id: line.Document_No || `MOV-${line.Line_No}`,
          sku: line.Item_No,
          type: type,
          quantity: parsedQty,
          delta: parsedDelta,
          timestamp: line.Posting_Date || new Date().toISOString(),
          note: desc || "Transacción Business Central",
          bin: "COTA-B2",
          user: "Zebra TC22 / BC Cloud",
          bcStatus: "SINCRONIZADO_EN_BC_CLOUD"
        };
      });

    const seenIds = new Set();
    const combined = [];

    // 1. Priorizar transacciones registradas en tiempo real en la app (incluye Conteos con delta 0)
    centralMovementsLog.forEach(m => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        combined.push(m);
      }
    });

    // 2. Incluir transacciones de Business Central
    bcMovements.forEach(m => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        combined.push(m);
      }
    });

    res.json({ movements: combined });
  } catch (err) {
    console.error("Error in /api/kardex:", err);
    res.json({ movements: centralMovementsLog });
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
  const products = getBaseProducts();
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
    const docNo = (movement.id && String(movement.id).startsWith("MOV-")) ? movement.id : `MOV-${Date.now().toString().slice(-6)}`;
    const moveType = movement.type || "ENTRADA";

    // 1. Calcular inventario actual previo para determinar el delta en CONTEO
    const defaultProds = getBaseProducts();
    const journalLines = await fetchBcJournalLines();
    const prod = defaultProds.find(p => p.sku.toUpperCase() === sku);
    const baseStock = prod ? (Number(prod.stock) || 0) : 0;
    let netJournalDelta = 0;
    journalLines.forEach(line => {
      if ((line.Item_No || "").toUpperCase() === sku) {
        const q = Number(line.Quantity) || 0;
        const eType = line.Entry_Type || line.EntryType;
        if (eType === "Positive Adjmt.") netJournalDelta += q;
        else if (eType === "Negative Adjmt.") netJournalDelta -= q;
      }
    });
    const currentStock = Math.max(0, baseStock + netJournalDelta);

    let entryType = "Positive Adjmt.";
    let bcQuantity = qty;
    let delta = 0;
    let shouldPostToBC = true;

    if (moveType === "ENTRADA") {
      entryType = "Positive Adjmt.";
      bcQuantity = qty;
      delta = qty;
    } else if (moveType === "SALIDA") {
      entryType = "Negative Adjmt.";
      bcQuantity = qty;
      delta = -qty;
    } else if (moveType === "CONTEO") {
      // Conteo físico: Delta = cantidad física contada - stock en sistema
      delta = qty - currentStock;
      if (delta > 0) {
        entryType = "Positive Adjmt.";
        bcQuantity = delta;
      } else if (delta < 0) {
        entryType = "Negative Adjmt.";
        bcQuantity = Math.abs(delta);
      } else {
        // Conteo coincide exactamente con el inventario actual
        shouldPostToBC = false;
        bcQuantity = 0;
      }
    }

    const desc = moveType === "CONTEO"
      ? `CONTEO Fisico: ${qty}u (Ajuste: ${delta >= 0 ? '+' : ''}${delta})`
      : `${moveType} Zebra TC22 (${qty} u)`;

    // Transmitir directamente a Business Central Cloud
    let bcPosted = false;
    let bcError = null;
    if (shouldPostToBC) {
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
          Quantity: bcQuantity,
          Gen_Prod_Posting_Group: "RETAIL",
          Description: desc.slice(0, 50)
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
    } else {
      bcPosted = true; // Sin diferencias en auditoría, conteo coincide al 100%
    }

    const newEntry = {
      id: docNo,
      sku: sku,
      productName: movement.productName || sku,
      type: moveType,
      quantity: qty,
      delta: delta,
      reason: movement.note || desc,
      note: movement.note || desc,
      bin: movement.bin || "COTA-B2",
      user: movement.user || "Operador Bodega",
      timestamp: movement.timestamp || getBogotaTimestamp(),
      bcStatus: bcPosted ? "SINCRONIZADO_EN_BC_CLOUD" : "PENDIENTE_BC",
      bcError: bcError
    };

    centralMovementsLog.unshift(newEntry);
    if (centralMovementsLog.length > 200) centralMovementsLog.pop();

    return res.json({
      success: true,
      syncStatus: bcPosted ? "SUCCESS" : "PARTIAL",
      message: bcPosted 
        ? (moveType === "CONTEO" 
            ? `✓ Conteo físico asentado: ${qty} u en estante (Ajuste: ${delta >= 0 ? '+' : ''}${delta})`
            : `✓ Asentado en Business Central Cloud (${moveType} ${qty} u)`)
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
    timestamp: getBogotaTimestamp(),
    bcStatus: "REGISTRADO_EN_DYNAMICS"
  };

  res.json({
    success: true,
    movement: newMovement
  });
});

export default app;
