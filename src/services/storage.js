import defaultProducts from "../data/products.json";
import { bcService } from "./bc-api";

const INVENTORY_SKU_PREFIX = "SIM-TON-";

function normalizeInventorySku(value) {
  const sku = String(value || "").trim().toUpperCase();
  return sku.startsWith(INVENTORY_SKU_PREFIX) ? sku : `${INVENTORY_SKU_PREFIX}${sku}`;
}

function isInventoryProduct(product) {
  return String(product?.sku || "").trim().toUpperCase().startsWith(INVENTORY_SKU_PREFIX);
}

const STORAGE_KEYS = {
  PRODUCTS: "provexpress_products_v2",
  KARDEX: "provexpress_kardex_v3",
  CONFIG: "provexpress_config_v2",
  USER_ROLE: "provexpress_user_role_v2",
  SERIALS: "provexpress_serials_v3",
  ORDERS: "provexpress_outbound_orders_v1",
  PRO_ORDERS: "provexpress_pro_orders_v1"
};

export const storageService = {
  getProducts() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const inventoryProducts = parsed.filter(isInventoryProduct);
          // Ensure brand property exists
          return inventoryProducts.map(p => ({
            ...p,
            brand: p.brand || "Genérico / Otras"
          }));
        }
      }
    } catch (e) {
      console.error("Error reading products:", e);
    }
    return (defaultProducts || []).filter(isInventoryProduct);
  },

  saveProducts(products) {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products.filter(isInventoryProduct)));
    } catch (e) {}
  },

  
  linkProductBarcode(sku, newGtin) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.sku.toUpperCase() === sku.toUpperCase());
    if (idx >= 0) {
      products[idx] = {
        ...products[idx],
        gtin: newGtin.trim()
      };
      this.saveProducts(products);
      return products[idx];
    }
    return null;
  },

  addProduct(newProd) {
    const products = this.getProducts();
    const normalizedSku = normalizeInventorySku(newProd.sku);
    const normalizedProduct = { ...newProd, sku: normalizedSku };
    const existingIndex = products.findIndex(p => p.sku.toUpperCase() === normalizedSku);
    
    if (existingIndex >= 0) {
      products[existingIndex] = { ...products[existingIndex], ...normalizedProduct };
    } else {
      products.unshift({
        id: Date.now(),
        sku: normalizedSku,
        name: newProd.name.trim(),
        brand: newProd.brand || "Genérico / Otras",
        category: newProd.category || "General / Accesorios",
        uom: newProd.uom || "PCS",
        stock: Number(newProd.stock) || 0,
        unitCost: Number(newProd.unitCost) || 0,
        unitPrice: Number(newProd.unitPrice) || Math.round(Number(newProd.unitCost || 0) * 1.30),
        totalValue: (Number(newProd.stock) || 0) * (Number(newProd.unitCost) || 0),
        location: newProd.location || "COTA",
        bin: newProd.bin || "COTA-A01-N1-P01",
        gtin: newProd.gtin || normalizedSku.replace(/^SIM-TON-/, ""),
        isSerialized: Boolean(newProd.isSerialized)
      });
    }
    this.saveProducts(products);
    return products;
  },

  getKardex() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.KARDEX);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  },

  saveKardex(kardex) {
    try {
      localStorage.setItem(STORAGE_KEYS.KARDEX, JSON.stringify(kardex));
    } catch (e) {}
  },

  async addMovement(movement) {
    if (!isInventoryProduct(movement)) {
      throw new Error("Solo se permiten movimientos de referencias SIM-TON-*");
    }
    const kardex = this.getKardex();
    const products = this.getProducts();
    
    const prodIndex = products.findIndex(p => p.sku.toUpperCase() === movement.sku.toUpperCase());
    const qty = Number(movement.quantity) || 1;
    if (prodIndex >= 0) {
      const currentStock = Number(products[prodIndex].stock) || 0;
      let newStock = currentStock;
      
      if (movement.type === "ENTRADA") {
        newStock += qty;
      } else if (movement.type === "SALIDA") {
        newStock = Math.max(0, currentStock - qty);
      } else if (movement.type === "CONTEO") {
        newStock = qty;
      }
      
      products[prodIndex].stock = newStock;
      products[prodIndex].totalValue = newStock * (Number(products[prodIndex].unitCost) || 0);
      this.saveProducts(products);
    } else {
      // Auto-register product in local catalog if not found
      products.unshift({
        id: Date.now(),
        sku: movement.sku.toUpperCase().trim(),
        name: movement.productName || movement.sku,
        brand: "Genérico / Otras",
        category: "Impresión y Suministros",
        uom: "PCS",
        stock: qty,
        unitCost: 0,
        unitPrice: 0,
        totalValue: 0,
        location: movement.location || "COTA",
        bin: movement.bin || "COTA-A01-N1-P01",
        gtin: movement.sku,
        isSerialized: Boolean(movement.serialList && movement.serialList.length > 0)
      });
      this.saveProducts(products);
    }

    const newEntry = {
      id: "MOV-" + Date.now().toString().slice(-6),
      timestamp: new Date().toLocaleString("es-CO"),
      ...movement,
      serialList: movement.serialList || (movement.serialNo ? [movement.serialNo] : [])
    };

    kardex.unshift(newEntry);
    this.saveKardex(kardex);

    // Movement is centralized through /api/bc/post-movement

    return newEntry;
  },

  // OUTBOUND ORDERS (Alistamiento / Picking & Revisión)
  getOrders() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    
    // Initial sample orders
    const initialOrders = [
      {
        id: "PED-2026-001",
        customer: "Banco de Bogotá - Sede Principal",
        destination: "Bogotá D.C. - Cra 8 # 15-42",
        createdAt: "25/08/2026, 09:30:00 a. m.",
        status: "EN_REVISION", // BORRADOR, EN_REVISION, DESPACHADO, DEVUELTO
        pickerUser: "Operario Bodega 1",
        reviewerUser: "",
        notes: "Despacho prioritario para sucursal norte",
        items: [
          {
            sku: "TEC-ZEB-001",
            productName: "Handheld Zebra TC22 Android (Bodega COTA)",
            requestedQty: 1,
            pickedQty: 1,
            serials: ["SN-ZEB-2026-001"],
            isSerialized: true
          }
        ]
      },
      {
        id: "PED-2026-002",
        customer: "Provexpress Cliente Corporativo",
        destination: "Zona Franca COTA",
        createdAt: "25/08/2026, 10:15:00 a. m.",
        status: "BORRADOR",
        pickerUser: "Operario Bodega 2",
        reviewerUser: "",
        notes: "Pedido regular de insumos",
        items: [
          {
            sku: "TEST-PROV-001",
            productName: "Producto de Prueba Creado desde Zebra TC22",
            requestedQty: 2,
            pickedQty: 0,
            serials: [],
            isSerialized: false
          }
        ]
      }
    ];

    this.saveOrders(initialOrders);
    return initialOrders;
  },

  saveOrders(orders) {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch (e) {}
  },

  createOrder(orderData) {
    const orders = this.getOrders();
    const newOrder = {
      id: "PED-" + Date.now().toString().slice(-6),
      customer: orderData.customer || "Cliente General",
      destination: orderData.destination || "Bodega Central",
      createdAt: new Date().toLocaleString("es-CO"),
      status: "BORRADOR",
      pickerUser: this.getUserRole(),
      reviewerUser: "",
      notes: orderData.notes || "",
      items: orderData.items || []
    };
    orders.unshift(newOrder);
    this.saveOrders(orders);
    return newOrder;
  },

  updateOrder(updatedOrder) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === updatedOrder.id);
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...updatedOrder };
      this.saveOrders(orders);
    }
    return orders;
  },

  sendOrderToReview(orderId, pickedItems, pickerNotes) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx >= 0) {
      orders[idx].status = "EN_REVISION";
      orders[idx].items = pickedItems;
      orders[idx].pickerUser = this.getUserRole();
      if (pickerNotes) orders[idx].notes = pickerNotes;
      orders[idx].submittedToReviewAt = new Date().toLocaleString("es-CO");
      this.saveOrders(orders);
      return orders[idx];
    }
    return null;
  },

  returnOrderToPicking(orderId, rejectionReason) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx >= 0) {
      orders[idx].status = "DEVUELTO";
      orders[idx].rejectionReason = rejectionReason || "Inconsistencias detectadas en revisión";
      orders[idx].returnedAt = new Date().toLocaleString("es-CO");
      this.saveOrders(orders);
      return orders[idx];
    }
    return null;
  },

  async approveAndDispatchOrder(orderId, reviewerNotes = "") {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx < 0) return { success: false, error: "Pedido no encontrado" };

    const order = orders[idx];
    const reviewer = this.getUserRole();

    // 1. Process Salida for each item line in order
    for (const item of order.items) {
      const qty = item.pickedQty || item.requestedQty || 1;
      if (qty > 0) {
        const movementData = {
          type: "SALIDA",
          sku: item.sku,
          productName: item.productName || item.sku,
          quantity: qty,
          serialNo: (item.serials && item.serials.length > 0) ? item.serials.join(", ") : "N/A",
          serialList: item.serials || [],
          location: "COTA",
          bin: "COTA-EXP-01",
          user: `${reviewer} (Revisor) / ${order.pickerUser} (Alistador)`,
          note: `Despacho Pedido #${order.id} - ${order.customer}. ${reviewerNotes || order.notes || ""}`
        };

        await bcService.postMovement(movementData);
      }
    }

    // 2. Mark order as DESPACHADO
    order.status = "DESPACHADO";
    order.reviewerUser = reviewer;
    order.dispatchedAt = new Date().toLocaleString("es-CO");
    order.reviewerNotes = reviewerNotes;

    orders[idx] = order;
    this.saveOrders(orders);

    return { success: true, order };
  },

  // ==========================================
  // FLUJO PRO: PIPELINE END-TO-END 6 FASES
  // ==========================================
  getProOrders() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRO_ORDERS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}

    // Pre-loaded realistic Pro Orders
    const initialProOrders = [
      {
        id: "PED-PRO-001",
        customer: "Banco de Bogotá - Sede Calle 72",
        commercialAgent: "Carolina Gómez (Comercial)",
        createdAt: "25/08/2026, 08:30 a. m.",
        priority: "Alta",
        deliveryZone: "Bogotá Urbana",
        slaHours: "4 - 6 Horas",
        stage: "LOGISTICA", // COMERCIAL, COMPRAS, LOGISTICA, FACTURACION, DESPACHO, ENTREGADO
        assignedOperator: "Carlos Mendoza (Zebra Handheld #1)",
        invoiceNo: "",
        carrier: "Flota Propia Provexpress (Móvil #3)",
        trackingNumber: "PX-RUTA-7842",
        items: [
          {
            sku: "TEC-ZEB-001",
            productName: "Handheld Zebra TC22 Android (Bodega COTA)",
            qty: 2,
            stockAvailable: 5,
            checkedByPurchasing: true,
            serials: ["SN-ZEB-2026-001", "SN-ZEB-2026-002"],
            isSerialized: true
          }
        ],
        timeline: [
          { stage: "COMERCIAL", user: "Carolina Gómez", time: "25/08/2026, 08:30 a. m.", note: "Pedido creado para sucursal Calle 72" },
          { stage: "COMPRAS", user: "Andrés Pulido (Compras)", time: "25/08/2026, 09:05 a. m.", note: "Checklist de stock 100% verificado en Bodega Cota" },
          { stage: "LOGISTICA", user: "Carlos Mendoza (Bodega)", time: "25/08/2026, 09:40 a. m.", note: "Asignado a Zebra #1. En proceso de picking y seriales." }
        ]
      },
      {
        id: "PED-PRO-002",
        customer: "Provexpress Corporativo - Zona Franca",
        commercialAgent: "Julián Morales (Comercial)",
        createdAt: "25/08/2026, 10:00 a. m.",
        priority: "Normal",
        deliveryZone: "Zona Sabana / Cota",
        slaHours: "1 - 2 Horas",
        stage: "COMPRAS",
        assignedOperator: "Por Asignar",
        invoiceNo: "",
        carrier: "Flota Propia Provexpress",
        trackingNumber: "",
        items: [
          {
            sku: "TEST-PROV-001",
            productName: "Producto de Prueba Creado desde Zebra TC22",
            qty: 3,
            stockAvailable: 5,
            checkedByPurchasing: false,
            serials: [],
            isSerialized: false
          }
        ],
        timeline: [
          { stage: "COMERCIAL", user: "Julián Morales", time: "25/08/2026, 10:00 a. m.", note: "Pedido ingresado al sistema para despacho urgente en Cota" }
        ]
      },
      {
        id: "PED-PRO-003",
        customer: "Falabella Colombia - Centro de Distribución",
        commercialAgent: "Valeria Torres (Comercial)",
        createdAt: "24/08/2026, 02:15 p. m.",
        priority: "Alta",
        deliveryZone: "Medellín / Antioquia",
        slaHours: "24 Horas",
        stage: "ENTREGADO",
        assignedOperator: "David Herrera (Bodega)",
        invoiceNo: "FAC-2026-0489",
        carrier: "Coordinadora Mercantil",
        trackingNumber: "GUIA-COO-98124578",
        items: [
          {
            sku: "TEC-ZEB-001",
            productName: "Handheld Zebra TC22 Android",
            qty: 1,
            stockAvailable: 5,
            checkedByPurchasing: true,
            serials: ["SN-ZEB-2026-003"],
            isSerialized: true
          }
        ],
        timeline: [
          { stage: "COMERCIAL", user: "Valeria Torres", time: "24/08/2026, 02:15 p. m.", note: "Pedido mayorista creado" },
          { stage: "COMPRAS", user: "Andrés Pulido", time: "24/08/2026, 02:40 p. m.", note: "Stock aprobado" },
          { stage: "LOGISTICA", user: "David Herrera", time: "24/08/2026, 03:20 p. m.", note: "Picking finalizado con serial SN-ZEB-2026-003" },
          { stage: "FACTURACION", user: "Sandra Vega (Facturación)", time: "24/08/2026, 03:50 p. m.", note: "Factura FAC-2026-0489 emitida y asentada en Business Central" },
          { stage: "DESPACHO", user: "Muelle Despacho", time: "24/08/2026, 04:30 p. m.", note: "Entregado a Coordinadora Mercantil (Guía 98124578)" },
          { stage: "ENTREGADO", user: "Transportadora", time: "25/08/2026, 09:10 a. m.", note: "Recibido a satisfacción con firma digital en Medellín" }
        ]
      }
    ];

    this.saveProOrders(initialProOrders);
    return initialProOrders;
  },

  saveProOrders(orders) {
    try {
      localStorage.setItem(STORAGE_KEYS.PRO_ORDERS, JSON.stringify(orders));
    } catch (e) {}
  },

  createProOrder(orderData) {
    const orders = this.getProOrders();
    const zoneSlaMap = {
      "Zona Sabana / Cota": "1 - 2 Horas",
      "Bogotá Urbana": "4 - 6 Horas",
      "Medellín / Antioquia": "24 Horas",
      "Cali / Valle": "24 Horas",
      "Barranquilla / Costa": "48 Horas",
      "Nacional / Otras": "48 - 72 Horas"
    };

    const zone = orderData.deliveryZone || "Bogotá Urbana";
    const sla = zoneSlaMap[zone] || "24 Horas";
    const agent = orderData.commercialAgent || this.getUserRole();

    const newOrder = {
      id: "PED-PRO-" + Date.now().toString().slice(-4),
      customer: orderData.customer || "Cliente Corporativo",
      commercialAgent: agent,
      createdAt: new Date().toLocaleString("es-CO"),
      priority: orderData.priority || "Normal",
      deliveryZone: zone,
      slaHours: sla,
      stage: "COMPRAS", // Goes directly to Purchasing queue for stock check
      assignedOperator: "Por Asignar",
      invoiceNo: "",
      carrier: "Flota Propia Provexpress",
      trackingNumber: "",
      items: orderData.items || [],
      timeline: [
        {
          stage: "COMERCIAL",
          user: agent,
          time: new Date().toLocaleString("es-CO"),
          note: `Pedido creado para ${orderData.customer} con destino ${zone} (SLA: ${sla}).`
        }
      ]
    };

    orders.unshift(newOrder);
    this.saveProOrders(orders);
    return newOrder;
  },

  advanceProOrderStage(orderId, nextStage, details = {}) {
    const orders = this.getProOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx < 0) return null;

    const order = orders[idx];
    order.stage = nextStage;

    if (details.assignedOperator) order.assignedOperator = details.assignedOperator;
    if (details.invoiceNo) order.invoiceNo = details.invoiceNo;
    if (details.carrier) order.carrier = details.carrier;
    if (details.trackingNumber) order.trackingNumber = details.trackingNumber;
    if (details.items) order.items = details.items;

    const user = details.user || this.getUserRole();
    const time = new Date().toLocaleString("es-CO");

    order.timeline.push({
      stage: nextStage,
      user: user,
      time: time,
      note: details.note || `Fase completada y transferida a ${nextStage}.`
    });

    orders[idx] = order;
    this.saveProOrders(orders);
    return order;
  },

  getUserRole() {
    return localStorage.getItem(STORAGE_KEYS.USER_ROLE) || "Bodega Zebra";
  },

  setUserRole(role) {
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
  },

  getConfig() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {
      tenantId: "618a50d8-4687-488a-8320-4112805ba00d",
      environment: "Production",
      company: "My Company",
      lastSync: new Date().toLocaleString("es-CO"),
      isConnected: true
    };
  },

  saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cfg));
  }
};
