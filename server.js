import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Business Central desde variables de entorno seguras
const BC_CONFIG = {
  tenantId: process.env.BC_TENANT_ID || process.env.DYNAMICS_TENANT_ID || "618a50d8-4687-488a-8320-4112805ba00d",
  clientId: process.env.BC_CLIENT_ID || process.env.DYNAMICS_CLIENT_ID || "e6243d14-6255-45ed-a73e-78338f3ec829",
  clientSecret: process.env.BC_CLIENT_SECRET || process.env.DYNAMICS_CLIENT_SECRET || "",
  environment: process.env.BC_ENVIRONMENT || process.env.DYNAMICS_ENVIRONMENT || "Production",
  companyId: process.env.BC_COMPANY_ID || process.env.DYNAMICS_COMPANY_ID || "9b8d1202-be8f-f111-8327-7ced8db3712c",
  companyName: process.env.BC_COMPANY_NAME || process.env.DYNAMICS_COMPANY_NAME || "My Company"
};

// Rutas de archivos de datos
const DATA_DIR = path.resolve(__dirname, "data");
const BACKUP_DIR = path.resolve(DATA_DIR, "backups");
const DB_PATH = path.resolve(DATA_DIR, "kardex-db.json");
const PROD_PATH = path.resolve(__dirname, "src", "data", "products.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logger básico estructurado
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.url.startsWith("/api/")) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// =========================================================================
// 1. GESTIÓN DE PERSISTENCIA ATÓMICA Y BACKUPS CONCURRENTES
// =========================================================================
function getLocalDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("[DB Read Error]:", e);
  }
  return { movements: [], serials: {}, customItems: [] };
}

function saveLocalDB(data) {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    // 1. Atomic write using temporary file
    const tempPath = `${DB_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, jsonStr, "utf-8");
    fs.renameSync(tempPath, DB_PATH);

    // 2. Rotating backup (keep last 10 backups)
    const backupFile = path.resolve(BACKUP_DIR, `kardex-backup-${Date.now()}.json`);
    fs.writeFileSync(backupFile, jsonStr, "utf-8");
    
    const allBackups = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("kardex-backup-")).sort();
    if (allBackups.length > 10) {
      allBackups.slice(0, allBackups.length - 10).forEach(oldF => {
        try { fs.unlinkSync(path.resolve(BACKUP_DIR, oldF)); } catch(e) {}
      });
    }
    return true;
  } catch (e) {
    console.error("[DB Save Error]:", e);
    return false;
  }
}

// =========================================================================
// 2. TOKEN OAUTH 2.0 CON EXPIRACIÓN SEGURA Y RETRY
// =========================================================================
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${BC_CONFIG.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", BC_CONFIG.clientId);
  params.append("client_secret", BC_CONFIG.clientSecret);
  params.append("scope", "https://api.businesscentral.dynamics.com/.default");

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  const data = await res.json();
  if (data.access_token) {
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in - 120) * 1000;
    return cachedToken;
  }
  throw new Error(data.error_description || "Error de autenticación con Azure AD");
}

function isSimTonSku(value) {
  return String(value || "").trim().toUpperCase().startsWith("SIM-TON-");
}

// =========================================================================
// 3. RUTAS DE AUTENTICACIÓN Y ROLES (RBAC)
// =========================================================================
const USERS_ROLES = {
  "1234": { role: "OPERADOR", name: "Operador Bodega", permissions: ["SCAN", "ENTRADA", "CONTEO"] },
  "4321": { role: "SUPERVISOR", name: "Supervisor de Inventario", permissions: ["SCAN", "ENTRADA", "CONTEO", "CREATE_ITEM", "EDIT_GTIN", "EXPORT"] },
  "9876": { role: "GERENCIA", name: "Gerencia y Auditoría", permissions: ["*"] }
};

app.post("/api/auth/login", (req, res) => {
  const { pin } = req.body;
  if (!pin || !USERS_ROLES[pin]) {
    return res.status(401).json({ success: false, error: "PIN de acceso inválido." });
  }

  const user = USERS_ROLES[pin];
  return res.json({
    success: true,
    user: {
      role: user.role,
      name: user.name,
      permissions: user.permissions,
      loginTime: new Date().toISOString()
    }
  });
});

// =========================================================================
// 4. API DE SALUD Y CONEXIÓN CON BUSINESS CENTRAL
// =========================================================================
app.get("/api/health", (req, res) => {
  res.json({
    status: "UP",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "2.5.0"
  });
});

app.get("/api/bc/ping", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({
      success: true,
      message: "Conectado en vivo a Business Central Cloud",
      tenant: BC_CONFIG.tenantId,
      company: BC_CONFIG.companyName,
      environment: BC_CONFIG.environment,
      hasToken: Boolean(token)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error conectando con Business Central Cloud: " + err.message
    });
  }
});

app.get("/api/bc/companies", async (req, res) => {
  try {
    const token = await getAccessToken();
    const bcUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_CONFIG.tenantId}/${BC_CONFIG.environment}/api/v2.0/companies`;
    const bcRes = await fetch(bcUrl, { headers: { Authorization: `Bearer ${token}` } });
    const bcData = await bcRes.json();
    res.json(bcData);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/bc/items", async (req, res) => {
  try {
    const token = await getAccessToken();
    const itemsUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_CONFIG.tenantId}/${BC_CONFIG.environment}/api/v2.0/companies(${BC_CONFIG.companyId})/items`;
    const itemsRes = await fetch(itemsUrl, { headers: { Authorization: `Bearer ${token}` } });
    const itemsData = await itemsRes.json();
    const activeSimTonItems = (itemsData.value || []).filter(item =>
      String(item.number || "").trim().toUpperCase().startsWith("SIM-TON-") && !item.blocked
    );
    res.json({ value: activeSimTonItems, totalCount: activeSimTonItems.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 5. API CENTRAL DE PRODUCTOS Y KARDEX CON EXISTENCIAS CONCILIADAS
// =========================================================================
app.get("/api/kardex", (req, res) => {
  const db = getLocalDB();
  res.json(db);
});

app.get("/api/products", (req, res) => {
  try {
    let prods = [];
    if (fs.existsSync(PROD_PATH)) {
      prods = JSON.parse(fs.readFileSync(PROD_PATH, "utf-8"));
    }
    const db = getLocalDB();
    
    // Compute real physical stock from all kardex movements
    const stockMap = {};
    (db.movements || []).forEach(m => {
      const sku = (m.sku || "").toUpperCase();
      const qty = Number(m.quantity) || 0;
      if (m.type === "ENTRADA") stockMap[sku] = (stockMap[sku] || 0) + qty;
      else if (m.type === "SALIDA") stockMap[sku] = Math.max(0, (stockMap[sku] || 0) - qty);
      else if (m.type === "CONTEO") stockMap[sku] = qty;
    });

    const enriched = prods.map(p => {
      const sku = (p.sku || "").toUpperCase();
      const stock = stockMap[sku] !== undefined ? stockMap[sku] : (Number(p.stock) || 0);
      return {
        ...p,
        stock: stock,
        totalValue: stock * (Number(p.unitCost) || 120000)
      };
    });

    res.json({ value: enriched, total: enriched.length });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// =========================================================================
// 6. POST MOVEMENT CON CÁLCULO RIGUROSO DE DELTA CONTABLE Y MANEJO HONESTO
// =========================================================================
app.post("/api/bc/post-movement", async (req, res) => {
  try {
    const movement = req.body;

    // Validación Backend Estricta
    if (!movement || !movement.sku) {
      return res.status(400).json({ success: false, error: "El SKU del producto es obligatorio." });
    }

    if (!isSimTonSku(movement.sku)) {
      return res.status(400).json({ success: false, error: "Solo se permiten referencias con nomenclatura SIM-TON-*" });
    }

    const requestedQty = Number(movement.quantity);
    if (isNaN(requestedQty) || requestedQty <= 0) {
      return res.status(400).json({ success: false, error: "La cantidad debe ser un número entero mayor a 0." });
    }

    const db = getLocalDB();

    // Calcular el stock previo acumulado para este SKU
    let previousStock = 0;
    (db.movements || []).forEach(m => {
      if ((m.sku || "").toUpperCase() === movement.sku.toUpperCase()) {
        const q = Number(m.quantity) || 0;
        if (m.type === "ENTRADA") previousStock += q;
        else if (m.type === "SALIDA") previousStock = Math.max(0, previousStock - q);
        else if (m.type === "CONTEO") previousStock = q;
      }
    });

    // Validar stock negativo en SALIDA
    if (movement.type === "SALIDA" && requestedQty > previousStock) {
      return res.status(400).json({
        success: false,
        error: `No hay suficientes existencias para salida. Stock actual: ${previousStock}, Solicitado: ${requestedQty}`
      });
    }

    // Determinar la transacción contable para Business Central
    let entryType = "Positive Adjmt.";
    let bcQuantity = requestedQty;
    let shouldPostToBC = true;

    if (movement.type === "ENTRADA") {
      entryType = "Positive Adjmt.";
      bcQuantity = requestedQty;
    } else if (movement.type === "SALIDA") {
      entryType = "Negative Adjmt.";
      bcQuantity = requestedQty;
    } else if (movement.type === "CONTEO") {
      // CÁLCULO DELTA PARA CONTEO FÍSICO:
      const delta = requestedQty - previousStock;
      if (delta > 0) {
        entryType = "Positive Adjmt.";
        bcQuantity = delta;
      } else if (delta < 0) {
        entryType = "Negative Adjmt.";
        bcQuantity = Math.abs(delta);
      } else {
        // Delta == 0 (el inventario coincide exactamente)
        shouldPostToBC = false;
      }
    }

    const newEntry = {
      id: "MOV-" + Date.now().toString().slice(-6),
      timestamp: new Date().toLocaleString("es-CO"),
      ...movement,
      quantity: requestedQty,
      serialList: movement.serialList || (movement.serialNo ? [movement.serialNo] : []),
      bcStatus: "PENDIENTE_DE_TRANSMISION"
    };

    // Actualizar seriales en base de datos
    const sku = movement.sku.toUpperCase();
    if (!db.serials[sku]) db.serials[sku] = [];

    if (newEntry.serialList && newEntry.serialList.length > 0) {
      newEntry.serialList.forEach(sn => {
        if (movement.type === "ENTRADA" || movement.type === "CONTEO") {
          const existingIdx = db.serials[sku].findIndex(s => s.sn === sn);
          if (existingIdx >= 0) {
            db.serials[sku][existingIdx].status = "EN_BODEGA";
            db.serials[sku][existingIdx].timestamp = newEntry.timestamp;
          } else {
            db.serials[sku].push({
              sn: sn,
              status: "EN_BODEGA",
              timestamp: newEntry.timestamp,
              user: newEntry.user,
              note: newEntry.note
            });
          }
        } else if (movement.type === "SALIDA") {
          const existingIdx = db.serials[sku].findIndex(s => s.sn === sn);
          if (existingIdx >= 0) {
            db.serials[sku][existingIdx].status = "DESPACHADO";
            db.serials[sku][existingIdx].timestamp = newEntry.timestamp;
          }
        }
      });
    }

    // Transmitir a Business Central Cloud
    let bcResult = null;
    let syncStatus = "SUCCESS";
    let syncMessage = "✓ Registrado localmente y en Business Central Cloud";

    if (shouldPostToBC) {
      try {
        const token = await getAccessToken();
        const odataJournalUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_CONFIG.tenantId}/${BC_CONFIG.environment}/ODataV4/Company('${encodeURIComponent(BC_CONFIG.companyName)}')/PXItemJournal`;
        
        const serialsSummary = newEntry.serialList.length > 0 ? ` SN: ${newEntry.serialList.slice(0, 3).join(", ")}` : "";
        const journalPayload = {
          Journal_Template_Name: "ITEM",
          Journal_Batch_Name: "DEFAULT",
          Posting_Date: new Date().toISOString().split("T")[0],
          Entry_Type: entryType,
          Document_No: newEntry.id,
          Item_No: movement.sku,
          Quantity: bcQuantity,
          Gen_Prod_Posting_Group: "RETAIL",
          Description: `${movement.type} Zebra TC22 (Qty: ${bcQuantity})${serialsSummary}`.slice(0, 50)
        };

        const bcRes = await fetch(odataJournalUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(journalPayload)
        });

        if (bcRes.ok) {
          bcResult = await bcRes.json();
          newEntry.bcStatus = "SINCRONIZADO_EN_BC_CLOUD";
          console.log(`[BC Cloud Auto-Post] ✓ Línea ${newEntry.id} (${bcQuantity} ${movement.sku} - ${entryType}) asentada en BC!`);
        } else {
          const errText = await bcRes.text();
          newEntry.bcStatus = "ERROR_BC";
          newEntry.bcErrorDetails = errText;
          syncStatus = "PARTIAL_ERROR";
          syncMessage = `⚠️ Guardado en Kardex pero Business Central rechazó la línea: ${errText.slice(0, 100)}`;
          console.warn("[BC Cloud Auto-Post Error]:", errText);
        }
      } catch (bcErr) {
        newEntry.bcStatus = "ERROR_CONEXION_BC";
        newEntry.bcErrorDetails = bcErr.message;
        syncStatus = "PARTIAL_ERROR";
        syncMessage = `⚠️ Guardado en Kardex local pero hubo error de conexión con BC: ${bcErr.message}`;
        console.warn("[BC Cloud Connection Error]:", bcErr.message);
      }
    } else {
      newEntry.bcStatus = "CONTEO_SIN_DIFERENCIAS_BC";
      syncMessage = "✓ Conteo Físico auditado: El stock coincide exactamente con el sistema (Delta = 0).";
    }

    db.movements.unshift(newEntry);
    saveLocalDB(db);

    return res.json({
      success: syncStatus === "SUCCESS",
      syncStatus: syncStatus,
      entry: newEntry,
      bcLine: bcResult,
      message: syncMessage
    });

  } catch (err) {
    console.error("[Post Movement Handler Error]:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 7. CREAR ÍTEM EN BUSINESS CENTRAL CLOUD
// =========================================================================
app.post("/api/bc/create-item", async (req, res) => {
  try {
    const itemData = req.body;
    if (!itemData || !itemData.number) {
      return res.status(400).json({ success: false, error: "El número SKU es obligatorio." });
    }

    if (!isSimTonSku(itemData.number)) {
      return res.status(400).json({ success: false, error: "Solo se permite crear referencias SIM-TON-*" });
    }

    const token = await getAccessToken();
    const postUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_CONFIG.tenantId}/${BC_CONFIG.environment}/api/v2.0/companies(${BC_CONFIG.companyId})/items`;
    
    const bcRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        number: itemData.number,
        displayName: itemData.displayName || itemData.name,
        type: "Inventory",
        unitCost: Number(itemData.unitCost) || 0,
        unitPrice: Number(itemData.unitPrice) || 0,
        baseUnitOfMeasureCode: itemData.baseUnitOfMeasureCode || "PCS"
      })
    });

    let resp = null;
    if (bcRes.ok) {
      resp = await bcRes.json();
    } else {
      const errText = await bcRes.text();
      console.warn("[BC Create Item Notice]:", errText);
    }

    // Persistir en base de datos local y catálogo
    const db = getLocalDB();
    if (!db.customItems) db.customItems = [];
    db.customItems.unshift(itemData);
    saveLocalDB(db);

    // Agregar a products.json
    try {
      if (fs.existsSync(PROD_PATH)) {
        const prods = JSON.parse(fs.readFileSync(PROD_PATH, "utf-8"));
        const exists = prods.some(p => p.sku.toUpperCase() === itemData.number.toUpperCase());
        if (!exists) {
          prods.unshift({
            id: prods.length + 1000,
            sku: itemData.number.toUpperCase(),
            name: itemData.displayName || itemData.name,
            brand: itemData.brand || "Genérico",
            category: itemData.category || "Impresión y Suministros",
            uom: itemData.baseUnitOfMeasureCode || "PCS",
            stock: Number(itemData.stock) || 0,
            unitCost: Number(itemData.unitCost) || 0,
            unitPrice: Number(itemData.unitPrice) || 0,
            totalValue: 0,
            location: "COTA",
            bin: "COTA-SUM-01",
            gtin: itemData.gtin || itemData.number,
            isSerialized: Boolean(itemData.isSerialized)
          });
          fs.writeFileSync(PROD_PATH, JSON.stringify(prods, null, 2), "utf-8");
        }
      }
    } catch(pe) {
      console.error("Error updating products.json:", pe);
    }

    return res.json({ success: true, item: resp || itemData });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// =========================================================================
// 8. SERVIR FRONTEND ESTÁTICO (PRODUCCIÓN & PREVIEW)
// =========================================================================
const DIST_PATH = path.resolve(__dirname, "dist");
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.url.startsWith("/api/")) {
      return res.sendFile(path.resolve(DIST_PATH, "index.html"));
    }
    next();
  });
}

// Iniciar Servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(`  🚀 PROVEXPRESS WMS BACKEND SERVER ACTIVO`);
  console.log(`  📍 Local:   http://localhost:${PORT}`);
  console.log(`  ☁️ Dynamics 365 Cloud: ${BC_CONFIG.environment} (${BC_CONFIG.companyName})`);
  console.log(`=======================================================`);
});