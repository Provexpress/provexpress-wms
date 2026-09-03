import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  Package, ArrowUpRight, CheckCircle2, ShieldCheck, AlertCircle, Plus, 
  Search, X, QrCode, ClipboardCheck, ArrowRight, RotateCcw, Clock, 
  Truck, Check, AlertTriangle, UserCheck, FileText, Send, Minus, Sparkles,
  Barcode
} from "lucide-react";
import { storageService } from "../services/storage";
import { audioService } from "../services/audio";
import { validateLocalBarcode } from "../services/barcode-validation";

export function OutboundFlow({ products, onOrderDispatched, onGoToZebra }) {
  const [subTab, setSubTab] = useState("picking"); // 'picking' | 'review' | 'history'
  const [orders, setOrders] = useState(storageService.getOrders());
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  
  // New Order Form (Mobile-first full screen)
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [newOrderCustomer, setNewOrderCustomer] = useState("");
  const [newOrderDestination, setNewOrderDestination] = useState("Bodega Central COTA");
  const [newOrderNotes, setNewOrderNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductsForNewOrder, setSelectedProductsForNewOrder] = useState([]);

  // Laser Scanner State for Zebra TC22 (Despacho: Creación & Picking)
  const [builderLaserInput, setBuilderLaserInput] = useState("");
  const [builderLaserFlash, setBuilderLaserFlash] = useState(false);
  const [pickingLaserInput, setPickingLaserInput] = useState("");
  const [pickingLaserFlash, setPickingLaserFlash] = useState(false);

  const builderLaserRef = useRef(null);
  const pickingLaserRef = useRef(null);

  // Active Picking State
  const [scanSerialInput, setScanSerialInput] = useState("");
  const [activeItemForScan, setActiveItemForScan] = useState(null);
  const [pickerNote, setPickerNote] = useState("");
  
  // Review & Quality State
  const [rejectionModalOrder, setRejectionModalOrder] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewerNote, setReviewerNote] = useState("");
  const [notification, setNotification] = useState("");

  const serialInputRef = useRef(null);
  const prodSearchInputRef = useRef(null);

  // Load orders on mount
  useEffect(() => {
    setOrders(storageService.getOrders());
  }, []);

  const refreshOrders = () => {
    const updated = storageService.getOrders();
    setOrders([...updated]);
    if (onOrderDispatched) onOrderDispatched();
  };

  const activePickingOrders = useMemo(() => {
    return orders.filter(o => o.status === "BORRADOR" || o.status === "DEVUELTO");
  }, [orders]);

  const pendingReviewOrders = useMemo(() => {
    return orders.filter(o => o.status === "EN_REVISION");
  }, [orders]);

  const historyOrders = useMemo(() => {
    return orders.filter(o => o.status === "DESPACHADO");
  }, [orders]);

  // Current active order in picking
  const currentPickingOrder = useMemo(() => {
    if (selectedOrderId) return orders.find(o => o.id === selectedOrderId);
    return activePickingOrders[0] || null;
  }, [orders, selectedOrderId, activePickingOrders]);

  // Current active order in review
  const currentReviewOrder = useMemo(() => {
    if (selectedOrderId) return orders.find(o => o.id === selectedOrderId);
    return pendingReviewOrders[0] || null;
  }, [orders, selectedOrderId, pendingReviewOrders]);

  // Filtered products for new order builder
  const filteredProductsForOrder = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 15);
    return products.filter(p => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [products, productSearch]);

  // 1. ADD SERIAL DURING PICKING
  const handleAddPickedSerial = (itemSku, serial) => {
    if (!currentPickingOrder || !serial.trim()) return;
    const cleanSerial = serial.trim().toUpperCase();

    const orderCopy = { ...currentPickingOrder };
    const itemIndex = orderCopy.items.findIndex(it => it.sku.toUpperCase() === itemSku.toUpperCase());
    if (itemIndex < 0) return;

    const item = orderCopy.items[itemIndex];
    if (!item.serials) item.serials = [];

    if (item.serials.includes(cleanSerial)) {
      audioService.playError();
      setNotification(`⚠️ El serial ${cleanSerial} ya fue escaneado en este pedido.`);
      setTimeout(() => setNotification(""), 3500);
      return;
    }

    item.serials.push(cleanSerial);
    item.pickedQty = item.serials.length;
    orderCopy.items[itemIndex] = item;

    storageService.updateOrder(orderCopy);
    refreshOrders();
    audioService.playSuccess();
    setScanSerialInput("");
    if (serialInputRef.current) serialInputRef.current.focus();
  };

  const handleIncrementNonSerialized = (itemSku) => {
    if (!currentPickingOrder) return;
    const orderCopy = { ...currentPickingOrder };
    const itemIndex = orderCopy.items.findIndex(it => it.sku.toUpperCase() === itemSku.toUpperCase());
    if (itemIndex < 0) return;

    const item = orderCopy.items[itemIndex];
    item.pickedQty = Math.min(item.requestedQty, (item.pickedQty || 0) + 1);
    orderCopy.items[itemIndex] = item;

    storageService.updateOrder(orderCopy);
    refreshOrders();
    audioService.playSuccess();
  };

  const handleDecrementNonSerialized = (itemSku) => {
    if (!currentPickingOrder) return;
    const orderCopy = { ...currentPickingOrder };
    const itemIndex = orderCopy.items.findIndex(it => it.sku.toUpperCase() === itemSku.toUpperCase());
    if (itemIndex < 0) return;

    const item = orderCopy.items[itemIndex];
    item.pickedQty = Math.max(0, (item.pickedQty || 0) - 1);
    orderCopy.items[itemIndex] = item;

    storageService.updateOrder(orderCopy);
    refreshOrders();
  };

  const handleRemoveSerial = (itemSku, serialToRemove) => {
    if (!currentPickingOrder) return;
    const orderCopy = { ...currentPickingOrder };
    const itemIndex = orderCopy.items.findIndex(it => it.sku.toUpperCase() === itemSku.toUpperCase());
    if (itemIndex < 0) return;

    const item = orderCopy.items[itemIndex];
    item.serials = (item.serials || []).filter(s => s !== serialToRemove);
    item.pickedQty = item.serials.length;
    orderCopy.items[itemIndex] = item;

    storageService.updateOrder(orderCopy);
    refreshOrders();
  };

  // 2. SUBMIT PICKING TO REVIEW
  const handleSubmitToReview = (order) => {
    const isComplete = order.items.every(it => (it.pickedQty || 0) >= it.requestedQty);
    if (!isComplete) {
      if (!window.confirm("⚠️ El pedido aún no tiene todas las unidades alistadas. ¿Deseas enviarlo a revisión de todas formas?")) {
        return;
      }
    }

    storageService.sendOrderToReview(order.id, order.items, pickerNote);
    refreshOrders();
    audioService.playSuccess();
    setNotification(`✓ Pedido #${order.id} enviado exitosamente a REVISIÓN.`);
    setTimeout(() => setNotification(""), 4000);
    setSubTab("review");
    setSelectedOrderId(order.id);
  };

  // 3. APPROVE AND DISPATCH (Fase 2)
  const handleApproveAndDispatch = async (orderId) => {
    setNotification("⏳ Despachando e insertando en Business Central...");
    const res = await storageService.approveAndDispatchOrder(orderId, reviewerNote);
    if (res.success) {
      audioService.playSuccess();
      refreshOrders();
      setNotification(`🚀 ¡Salida oficial registrada y asentada en Business Central para Pedido #${orderId}!`);
      setTimeout(() => setNotification(""), 5000);
      setSubTab("history");
      setSelectedOrderId(orderId);
      setReviewerNote("");
    } else {
      audioService.playError();
      setNotification(`❌ Error al despachar: ${res.error}`);
    }
  };

  // 4. REJECT AND RETURN TO PICKING
  const handleConfirmRejection = () => {
    if (!rejectionModalOrder) return;
    storageService.returnOrderToPicking(rejectionModalOrder.id, rejectionReason);
    refreshOrders();
    audioService.playError();
    setNotification(`⚠️ Pedido #${rejectionModalOrder.id} devuelto a Alistamiento.`);
    setTimeout(() => setNotification(""), 4000);
    setRejectionModalOrder(null);
    setRejectionReason("");
    setSubTab("picking");
  };

  // 4.5. ZEBRA TC22 BARCODE HANDLERS (HANDSFREE TRIGGER PULLS)
  const handleBuilderBarcodeScan = (rawCode) => {
    if (!rawCode || !rawCode.trim()) return;
    const result = validateLocalBarcode(products, rawCode.trim());
    if (result && result.found && result.product) {
      const prod = result.product;
      handleAddProductToBuilder(prod);
      setBuilderLaserFlash(true);
      setTimeout(() => setBuilderLaserFlash(false), 250);
      setNotification(`✓ ${prod.sku} sumado al pedido (+1)`);
      setTimeout(() => setNotification(""), 3500);
      setBuilderLaserInput("");
      setProductSearch("");
      if (builderLaserRef.current) builderLaserRef.current.focus();
    } else {
      audioService.playError();
      setNotification(`⚠️ Código "${rawCode}" no encontrado en catálogo.`);
      setTimeout(() => setNotification(""), 4000);
      setBuilderLaserInput("");
    }
  };

  const handlePickingBarcodeScan = (rawCode) => {
    if (!currentPickingOrder || !rawCode || !rawCode.trim()) return;
    const result = validateLocalBarcode(products, rawCode.trim());
    if (!result || !result.found || !result.product) {
      audioService.playError();
      setNotification(`⚠️ Código "${rawCode}" no reconocido en el catálogo.`);
      setTimeout(() => setNotification(""), 4000);
      setPickingLaserInput("");
      return;
    }

    const scannedProd = result.product;
    const itemIndex = currentPickingOrder.items.findIndex(
      it => it.sku.toUpperCase() === scannedProd.sku.toUpperCase()
    );

    if (itemIndex < 0) {
      audioService.playError();
      setNotification(`❌ ERROR DE PICKING: ${scannedProd.sku} NO pertenece a este pedido #${currentPickingOrder.id}!`);
      setTimeout(() => setNotification(""), 5000);
      setPickingLaserInput("");
      return;
    }

    const item = currentPickingOrder.items[itemIndex];
    if ((item.pickedQty || 0) >= item.requestedQty) {
      audioService.playError();
      setNotification(`⚠️ ${scannedProd.sku} ya completó la cantidad requerida (${item.requestedQty} u).`);
      setTimeout(() => setNotification(""), 4000);
      setPickingLaserInput("");
      return;
    }

    handleIncrementNonSerialized(scannedProd.sku);
    setPickingLaserFlash(true);
    setTimeout(() => setPickingLaserFlash(false), 250);
    const newQty = (item.pickedQty || 0) + 1;
    setNotification(`✓ ${scannedProd.sku} verificado (${newQty}/${item.requestedQty} u)`);
    setTimeout(() => setNotification(""), 3500);
    setPickingLaserInput("");
    if (pickingLaserRef.current) pickingLaserRef.current.focus();
  };

  // Auto-focus Zebra Laser receiver
  useEffect(() => {
    if (showNewOrderForm && builderLaserRef.current) {
      builderLaserRef.current.focus();
    } else if (subTab === "picking" && currentPickingOrder && pickingLaserRef.current) {
      pickingLaserRef.current.focus();
    }
  }, [showNewOrderForm, subTab, currentPickingOrder]);

  // 5. CREATE NEW ORDER HANDLERS
  const handleAddProductToBuilder = (prod) => {
    const existing = selectedProductsForNewOrder.find(p => p.sku === prod.sku);
    if (existing) {
      setSelectedProductsForNewOrder(selectedProductsForNewOrder.map(p => p.sku === prod.sku ? { ...p, qty: p.qty + 1 } : p));
    } else {
      setSelectedProductsForNewOrder([...selectedProductsForNewOrder, { ...prod, qty: 1 }]);
    }
    audioService.playSuccess();
  };

  const handleUpdateBuilderQty = (sku, delta) => {
    setSelectedProductsForNewOrder(selectedProductsForNewOrder.map(p => {
      if (p.sku === sku) {
        const newQty = Math.max(1, p.qty + delta);
        return { ...p, qty: newQty };
      }
      return p;
    }));
  };

  const handleRemoveFromBuilder = (sku) => {
    setSelectedProductsForNewOrder(selectedProductsForNewOrder.filter(p => p.sku !== sku));
  };

  const handleSaveNewOrder = (e) => {
    if (e) e.preventDefault();
    if (!newOrderCustomer.trim()) {
      alert("Por favor ingresa el nombre del cliente.");
      return;
    }
    if (selectedProductsForNewOrder.length === 0) {
      alert("Selecciona al menos un producto para el pedido.");
      return;
    }

    const created = storageService.createOrder({
      customer: newOrderCustomer.trim(),
      destination: newOrderDestination.trim(),
      notes: newOrderNotes.trim(),
      items: selectedProductsForNewOrder.map(p => ({
        sku: p.sku,
        productName: p.name,
        requestedQty: p.qty,
        pickedQty: 0,
        serials: [],
        isSerialized: Boolean(p.isSerialized)
      }))
    });

    refreshOrders();
    audioService.playSuccess();
    setShowNewOrderForm(false);
    setSelectedOrderId(created.id);
    setNewOrderCustomer("");
    setSelectedProductsForNewOrder([]);
    setProductSearch("");
    setNotification(`✓ Pedido #${created.id} listo para Alistamiento.`);
    setTimeout(() => setNotification(""), 4000);
  };

  return (
    <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto", padding: "0.75rem 0.65rem", boxSizing: "border-box", overflowX: "hidden" }}>
      
      {/* Top Header Card */}
      <div className="px-glass-panel" style={{ padding: "0.85rem 1rem", marginBottom: "0.85rem" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem", flexWrap: "wrap", gap: "0.4rem" }}>
          <div>
            <span className="px-chip px-chip--active" style={{ fontSize: "0.65rem", padding: "1px 6px", background: "rgba(21, 101, 192, 0.1)", color: "var(--px-blue)" }}>
              WMS Zebra TC22 • Flujo de Despacho
            </span>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--px-text)", margin: "0.15rem 0 0 0", letterSpacing: "-0.02em" }}>
              📦 Despachos y Alistamiento
            </h1>
          </div>

          <button 
            type="button"
            className="px-btn px-btn--primary"
            onClick={() => setShowNewOrderForm(true)}
            style={{ 
              background: "var(--px-gradient-brand)", 
              minHeight: "44px", padding: "0 1rem", 
              fontWeight: "800", fontSize: "0.85rem", borderRadius: "10px",
              display: "flex", alignItems: "center", gap: "0.3rem"
            }}
          >
            <Plus size={16} /> + Crear Pedido
          </button>
        </div>

        {/* 3 Touch Mode Buttons for Zebra TC22 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.3rem" }}>
          <button 
            type="button"
            className={`px-btn ${subTab === "picking" ? "px-btn--primary" : "px-btn--ghost"}`}
            onClick={() => { setSubTab("picking"); setShowNewOrderForm(false); }}
            style={{ 
              background: subTab === "picking" ? "var(--px-blue)" : "var(--px-surface-sunken)", 
              color: subTab === "picking" ? "#fff" : "var(--px-text)",
              minHeight: "42px", fontWeight: "800", fontSize: "0.76rem", borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.2rem",
              padding: "0.2rem 0.3rem"
            }}
          >
            <Package size={14} /> Picking ({activePickingOrders.length})
          </button>

          <button 
            type="button"
            className={`px-btn ${subTab === "review" ? "px-btn--primary" : "px-btn--ghost"}`}
            onClick={() => { setSubTab("review"); setShowNewOrderForm(false); }}
            style={{ 
              background: subTab === "review" ? "var(--px-purple)" : "var(--px-surface-sunken)", 
              color: subTab === "review" ? "#fff" : "var(--px-text)",
              minHeight: "42px", fontWeight: "800", fontSize: "0.76rem", borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.2rem",
              padding: "0.2rem 0.3rem",
              position: "relative"
            }}
          >
            <ClipboardCheck size={14} /> Revisión ({pendingReviewOrders.length})
            {pendingReviewOrders.length > 0 && (
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--px-amber)", position: "absolute", top: "4px", right: "4px" }}></span>
            )}
          </button>

          <button 
            type="button"
            className={`px-btn ${subTab === "history" ? "px-btn--primary" : "px-btn--ghost"}`}
            onClick={() => { setSubTab("history"); setShowNewOrderForm(false); }}
            style={{ 
              background: subTab === "history" ? "var(--px-green)" : "var(--px-surface-sunken)", 
              color: subTab === "history" ? "#fff" : "var(--px-text)",
              minHeight: "42px", fontWeight: "800", fontSize: "0.76rem", borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.2rem",
              padding: "0.2rem 0.3rem"
            }}
          >
            <Truck size={14} /> Salidas ({historyOrders.length})
          </button>
        </div>

      </div>

      {notification && (
        <div className="px-badge px-badge--success" style={{ width: "100%", padding: "0.75rem", fontSize: "0.85rem", marginBottom: "0.85rem", textAlign: "center", display: "block", boxSizing: "border-box" }}>
          {notification}
        </div>
      )}

      {/* =========================================================================
          ZEBRA MOBILE-FIRST FORM: CREAR NUEVO PEDIDO
          ========================================================================= */}
      {showNewOrderForm && (
        <div className="px-glass-panel" style={{ border: "2px solid var(--px-blue)", padding: "1.1rem", marginBottom: "1rem" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", borderBottom: "1px solid rgba(215, 224, 240, 0.7)", paddingBottom: "0.6rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: "800", margin: 0, color: "var(--px-blue)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Plus size={18} /> Crear Pedido para Alistamiento
            </h2>
            <button className="px-btn px-btn--sm px-btn--icon" onClick={() => setShowNewOrderForm(false)}>
              <X size={16} />
            </button>
          </div>

          {/* Quick Customer Tap Chips for Zebra */}
          <div style={{ marginBottom: "0.85rem" }}>
            <label className="px-label" style={{ fontSize: "0.75rem", fontWeight: "700" }}>Cliente / Destinatario *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.4rem" }}>
              {["Banco de Bogotá", "Provexpress Cota", "Cliente Corporativo", "Sucursal Medellín", "Falabella"].map(c => (
                <button 
                  key={c}
                  type="button"
                  className={`px-chip ${newOrderCustomer === c ? "px-chip--active" : ""}`}
                  onClick={() => setNewOrderCustomer(c)}
                  style={{ fontSize: "0.75rem", padding: "4px 8px", cursor: "pointer" }}
                >
                  {c}
                </button>
              ))}
            </div>
            <input 
              type="text" 
              className="px-input" 
              placeholder="O escribe el nombre del cliente..."
              value={newOrderCustomer}
              onChange={(e) => setNewOrderCustomer(e.target.value)}
              style={{ fontSize: "0.92rem", fontWeight: "700", height: "44px", borderRadius: "10px" }}
            />
          </div>

          {/* 1. ZEBRA TC22 HARDWARE LASER RECEIVER BOX */}
          <div style={{ 
            padding: "0.75rem 0.65rem", 
            background: builderLaserFlash ? "rgba(22, 163, 74, 0.25)" : "rgba(22, 163, 74, 0.06)", 
            border: "2px solid var(--px-green)", 
            borderRadius: "14px", 
            marginBottom: "0.75rem",
            transition: "background 0.2s ease"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", color: "var(--px-green)", fontWeight: "800", fontSize: "0.88rem", marginBottom: "0.4rem" }}>
              <span className="px-live-dot" style={{ width: "8px", height: "8px" }}></span>
              <span>Láser Zebra Listo: Escanear Tóner a Despachar</span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleBuilderBarcodeScan(builderLaserInput); }} style={{ display: "flex", gap: "0.4rem", alignItems: "stretch", width: "100%" }}>
              <div style={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
                <input 
                  ref={builderLaserRef}
                  type="text" 
                  className="px-input" 
                  placeholder="Apunta el láser a la caja del tóner..."
                  value={builderLaserInput}
                  onChange={(e) => setBuilderLaserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      handleBuilderBarcodeScan(e.target.value);
                    }
                  }}
                  style={{ 
                    height: "46px", 
                    fontSize: "0.95rem", 
                    fontWeight: "800", 
                    borderRadius: "12px", 
                    paddingLeft: "2.2rem",
                    paddingRight: "0.6rem",
                    border: "1.5px solid var(--px-green)",
                    background: "var(--px-surface-sunken)",
                    boxSizing: "border-box",
                    width: "100%"
                  }}
                />
                <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <Barcode size={16} color="var(--px-green)" />
                </span>
              </div>

              <button 
                type="submit" 
                className="px-btn px-btn--primary"
                style={{ 
                  background: "var(--px-gradient-green)", 
                  width: "46px",
                  minWidth: "46px", 
                  height: "46px",
                  borderRadius: "12px", 
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  flexShrink: 0
                }}
                title="Sumar tóner escaneado (+1)"
              >
                <Plus size={20} />
              </button>
            </form>
            <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginTop: "0.35rem", textAlign: "center" }}>
              ⚡ Dispara a la caja del tóner y se sumará automáticamente (+1)
            </div>
          </div>

          {/* 2. Manual Search Fallback & Suggestions */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label className="px-label" style={{ fontSize: "0.75rem", fontWeight: "700", margin: 0 }}>
                O busca manualmente en el catálogo:
              </label>
              <span className="px-badge px-badge--success" style={{ fontSize: "0.72rem" }}>
                {selectedProductsForNewOrder.length} seleccionados
              </span>
            </div>

            <div style={{ position: "relative", marginBottom: "0.5rem" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--px-muted)" }} />
              <input 
                ref={prodSearchInputRef}
                type="text" 
                className="px-input" 
                placeholder="Filtrar por nombre o SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ paddingLeft: "2.3rem", height: "42px", fontSize: "0.88rem", borderRadius: "10px" }}
              />
            </div>

            {/* Product Suggestions (Large Touch Cards) */}
            <div style={{ maxHeight: "190px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.25rem", background: "rgba(244, 247, 255, 0.7)", borderRadius: "10px", border: "1px solid var(--px-border)" }}>
              {filteredProductsForOrder.map(p => {
                const inOrder = selectedProductsForNewOrder.find(sp => sp.sku === p.sku);
                return (
                  <div 
                    key={p.sku}
                    onClick={() => handleAddProductToBuilder(p)}
                    style={{ 
                      padding: "0.6rem 0.75rem", borderRadius: "10px", cursor: "pointer",
                      background: inOrder ? "rgba(21, 101, 192, 0.12)" : "#fff",
                      border: `1.5px solid ${inOrder ? "var(--px-blue)" : "rgba(215, 224, 240, 0.8)"}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center"
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span className="px-mono" style={{ fontWeight: "800", color: "var(--px-blue)", fontSize: "0.85rem" }}>
                          {p.sku}
                        </span>
                        {p.isSerialized && (
                          <span className="px-chip px-chip--active" style={{ fontSize: "0.6rem", padding: "1px 4px" }}>
                            🏷️ Con Serial
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--px-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", marginLeft: "0.5rem" }}>
                      {inOrder ? (
                        <span className="px-badge px-badge--success" style={{ fontSize: "0.72rem", fontWeight: "800" }}>
                          ✓ {inOrder.qty} {p.uom}
                        </span>
                      ) : (
                        <span className="px-btn px-btn--sm px-btn--secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }}>
                          + Agregar
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Products in Order Summary */}
          {selectedProductsForNewOrder.length > 0 && (
            <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--px-surface)", borderRadius: "12px", border: "1px solid var(--px-border)", boxShadow: "var(--px-neu-flat)" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: "800", color: "var(--px-blue)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <ClipboardCheck size={15} /> Resumen de Unidades a Alistar ({selectedProductsForNewOrder.reduce((s, p) => s + p.qty, 0)} u):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {selectedProductsForNewOrder.map(item => (
                  <div key={item.sku} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.65rem", background: "var(--px-surface-sunken)", borderRadius: "10px", border: "1px solid var(--px-border)", gap: "0.5rem" }}>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div className="px-mono" style={{ fontWeight: "800", fontSize: "0.85rem", color: "var(--px-text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.sku}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                        {item.name}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                      <button 
                        type="button" 
                        className="px-btn px-btn--sm px-btn--secondary" 
                        onClick={() => handleUpdateBuilderQty(item.sku, -1)}
                        style={{ width: "34px", height: "34px", minHeight: "34px", padding: 0, fontWeight: "800", borderRadius: "8px" }}
                      >
                        <Minus size={13} />
                      </button>
                      <span className="px-mono" style={{ fontWeight: "800", fontSize: "0.95rem", minWidth: "24px", textAlign: "center", color: "var(--px-text-strong)" }}>
                        {item.qty}
                      </span>
                      <button 
                        type="button" 
                        className="px-btn px-btn--sm px-btn--secondary" 
                        onClick={() => handleUpdateBuilderQty(item.sku, 1)}
                        style={{ width: "34px", height: "34px", minHeight: "34px", padding: 0, fontWeight: "800", borderRadius: "8px" }}
                      >
                        <Plus size={13} />
                      </button>
                      <button 
                        type="button" 
                        className="px-btn px-btn--sm px-btn--ghost" 
                        onClick={() => handleRemoveFromBuilder(item.sku)}
                        style={{ color: "var(--px-red)", padding: "4px", width: "28px", height: "28px", minHeight: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="Eliminar del pedido"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons: Stacked so the text NEVER truncates on Zebra TC22 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.85rem" }}>
            <button 
              type="button" 
              className="px-btn px-btn--primary" 
              onClick={handleSaveNewOrder}
              style={{ 
                width: "100%", 
                minHeight: "48px", 
                background: "var(--px-gradient-brand)", 
                borderRadius: "12px", 
                fontSize: "0.95rem", 
                fontWeight: "800",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: "var(--px-neu-btn-primary)"
              }}
            >
              🚀 Iniciar Alistamiento ({selectedProductsForNewOrder.reduce((s, p) => s + p.qty, 0)} {selectedProductsForNewOrder.reduce((s, p) => s + p.qty, 0) === 1 ? "Unidad" : "Unidades"})
            </button>

            <button 
              type="button" 
              className="px-btn px-btn--ghost" 
              onClick={() => setShowNewOrderForm(false)}
              style={{ width: "100%", minHeight: "36px", borderRadius: "10px", fontSize: "0.82rem", color: "var(--px-muted)" }}
            >
              Cancelar y Volver
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          STAGE 1: ALISTAMIENTO DE PEDIDO (PICKING)
          ========================================================================= */}
      {subTab === "picking" && !showNewOrderForm && (
        <div>
          
          {/* Order Selector Chips on Mobile */}
          {activePickingOrders.length > 1 && (
            <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
              {activePickingOrders.map(o => {
                const isSelected = currentPickingOrder && currentPickingOrder.id === o.id;
                return (
                  <button 
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`px-chip ${isSelected ? "px-chip--active" : ""}`}
                    style={{ 
                      padding: "6px 12px", borderRadius: "10px", fontSize: "0.78rem", whiteSpace: "nowrap",
                      background: isSelected ? "var(--px-blue)" : "rgba(255, 255, 255, 0.8)",
                      color: isSelected ? "#fff" : "var(--px-text)",
                      border: "1.5px solid var(--px-blue)", fontWeight: "700"
                    }}
                  >
                    #{o.id} • {o.customer.slice(0, 16)}...
                  </button>
                );
              })}
            </div>
          )}

          {currentPickingOrder ? (
            <div className="px-glass-panel" style={{ padding: "1.1rem" }}>
              
              {/* Order Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem", borderBottom: "1px solid rgba(215, 224, 240, 0.7)", paddingBottom: "0.65rem" }}>
                <div>
                  <span className="px-chip px-chip--active" style={{ fontSize: "0.68rem", marginBottom: "0.2rem", background: "rgba(21, 101, 192, 0.1)", color: "var(--px-blue)" }}>
                    Alistando Pedido #{currentPickingOrder.id}
                  </span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--px-text)", margin: "0.15rem 0" }}>
                    {currentPickingOrder.customer}
                  </h2>
                  <div style={{ fontSize: "0.75rem", color: "var(--px-muted)" }}>
                    Destino: {currentPickingOrder.destination}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span className="px-badge px-badge--warning" style={{ fontSize: "0.75rem", fontWeight: "800" }}>
                    Fase 1: Picking
                  </span>
                </div>
              </div>

              {/* Rejection Alert if returned */}
              {currentPickingOrder.status === "DEVUELTO" && (
                <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.08)", border: "1.5px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", marginBottom: "0.85rem", fontSize: "0.82rem", color: "var(--px-red)" }}>
                  <strong>⚠️ Observación del Revisor:</strong> {currentPickingOrder.rejectionReason}
                </div>
              )}

              {/* ZEBRA TC22 HARDWARE LASER PICKING VERIFIER BOX */}
              <div style={{ 
                padding: "0.75rem 0.65rem", 
                background: pickingLaserFlash ? "rgba(22, 163, 74, 0.25)" : "rgba(37, 99, 235, 0.06)", 
                border: `2px solid ${pickingLaserFlash ? "var(--px-green)" : "var(--px-blue)"}`, 
                borderRadius: "14px", 
                marginBottom: "0.85rem",
                transition: "background 0.2s ease"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", color: "var(--px-blue)", fontWeight: "800", fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                  <span className="px-live-dot" style={{ width: "8px", height: "8px" }}></span>
                  <span>Láser Zebra: Escanear Tóner para Confirmar Picking</span>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handlePickingBarcodeScan(pickingLaserInput); }} style={{ display: "flex", gap: "0.4rem", alignItems: "stretch", width: "100%" }}>
                  <div style={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
                    <input 
                      ref={pickingLaserRef}
                      type="text" 
                      className="px-input" 
                      placeholder="Disparar láser al tóner retirado..."
                      value={pickingLaserInput}
                      onChange={(e) => setPickingLaserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          handlePickingBarcodeScan(e.target.value);
                        }
                      }}
                      style={{ 
                        height: "46px", 
                        fontSize: "0.95rem", 
                        fontWeight: "800", 
                        borderRadius: "12px", 
                        paddingLeft: "2.2rem",
                        paddingRight: "0.6rem",
                        border: "1.5px solid var(--px-blue)",
                        background: "var(--px-surface-sunken)",
                        boxSizing: "border-box",
                        width: "100%"
                      }}
                    />
                    <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <Barcode size={16} color="var(--px-blue)" />
                    </span>
                  </div>

                  <button 
                    type="submit" 
                    className="px-btn px-btn--primary"
                    style={{ 
                      background: "var(--px-gradient-brand)", 
                      width: "46px",
                      minWidth: "46px", 
                      height: "46px",
                      borderRadius: "12px", 
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      flexShrink: 0
                    }}
                    title="Confirmar alistamiento con código"
                  >
                    <Check size={20} />
                  </button>
                </form>
                <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginTop: "0.35rem", textAlign: "center" }}>
                  ⚡ Apunta el láser al código de la caja para sumar y verificar automáticamente
                </div>
              </div>

              {/* Items in Order to Pick */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.1rem" }}>
                {currentPickingOrder.items.map((item, idx) => {
                  const isDone = (item.pickedQty || 0) >= item.requestedQty;
                  return (
                    <div 
                      key={item.sku}
                      style={{ 
                        padding: "0.9rem",
                        background: isDone ? "rgba(22, 163, 74, 0.06)" : "rgba(255, 255, 255, 0.95)",
                        border: `2px solid ${isDone ? "var(--px-green)" : "rgba(21, 101, 192, 0.3)"}`,
                        borderRadius: "14px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            {isDone && <CheckCircle2 size={16} color="var(--px-green)" />}
                            <span className="px-mono" style={{ fontWeight: "800", color: "var(--px-blue)", fontSize: "0.95rem" }}>
                              {item.sku}
                            </span>
                          </div>
                          <div style={{ fontWeight: "700", fontSize: "0.85rem", color: "var(--px-text-strong)", marginTop: "2px" }}>
                            {item.productName}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <span className={`px-badge ${isDone ? "px-badge--success" : "px-badge--warning"}`} style={{ fontSize: "0.8rem", fontWeight: "800" }}>
                            {item.pickedQty || 0} / {item.requestedQty} Alistados
                          </span>
                        </div>
                      </div>

                      {/* WORKFLOW FOR SERIALIZED ITEM (Burst Laser Scan on Zebra) */}
                      {item.isSerialized ? (
                        <div style={{ marginTop: "0.5rem", background: "rgba(21, 101, 192, 0.04)", padding: "0.65rem", borderRadius: "10px", border: "1px solid rgba(21, 101, 192, 0.15)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "var(--px-blue)" }}>
                              🔫 Escanear Número de Serie con Láser Zebra:
                            </span>
                          </div>

                          <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.4rem" }}>
                            <input 
                              type="text" 
                              className="px-input" 
                              placeholder="Disparar láser al serial..."
                              value={activeItemForScan === item.sku ? scanSerialInput : ""}
                              onFocus={() => setActiveItemForScan(item.sku)}
                              onChange={(e) => { setActiveItemForScan(item.sku); setScanSerialInput(e.target.value); }}
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddPickedSerial(item.sku, scanSerialInput); }}
                              style={{ height: "44px", fontSize: "0.95rem", fontWeight: "700", borderRadius: "10px" }}
                            />
                            <button 
                              type="button" 
                              className="px-btn px-btn--primary"
                              onClick={() => handleAddPickedSerial(item.sku, scanSerialInput)}
                              style={{ background: "var(--px-blue)", padding: "0 1rem", borderRadius: "10px", fontWeight: "700", fontSize: "0.82rem" }}
                            >
                              + Alistar
                            </button>
                          </div>

                          {/* Chips of picked serials */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.35rem" }}>
                            {(item.serials || []).map((sn, sIdx) => (
                              <span key={sn} className="px-chip px-chip--active" style={{ fontSize: "0.75rem", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: "5px", background: "#fff", borderColor: "var(--px-green)", fontWeight: "800" }}>
                                <span>#{sIdx + 1}: {sn}</span>
                                <X size={13} style={{ cursor: "pointer", color: "var(--px-red)" }} onClick={() => handleRemoveSerial(item.sku, sn)} />
                              </span>
                            ))}
                            {(!item.serials || item.serials.length === 0) && (
                              <span style={{ fontSize: "0.72rem", color: "var(--px-muted)", fontStyle: "italic" }}>
                                Escanea el serial de la caja para sumarlo automáticamente.
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* WORKFLOW FOR NON-SERIALIZED ITEM (Big Touch +/- Buttons) */
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", padding: "0.4rem 0.6rem", background: "rgba(244, 247, 255, 0.7)", borderRadius: "10px" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--px-muted)", fontWeight: "600" }}>
                            Cantidad Física Alistada:
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <button 
                              type="button"
                              className="px-btn px-btn--secondary"
                              onClick={() => handleDecrementNonSerialized(item.sku)}
                              style={{ width: "38px", height: "38px", padding: 0, fontWeight: "800", borderRadius: "10px", fontSize: "1.1rem" }}
                            >
                              <Minus size={15} />
                            </button>
                            <span className="px-mono" style={{ fontWeight: "800", fontSize: "1.15rem", minWidth: "28px", textAlign: "center" }}>
                              {item.pickedQty || 0}
                            </span>
                            <button 
                              type="button"
                              className="px-btn px-btn--secondary"
                              onClick={() => handleIncrementNonSerialized(item.sku)}
                              style={{ width: "38px", height: "38px", padding: 0, fontWeight: "800", borderRadius: "10px", fontSize: "1.1rem" }}
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Complete Picking Action */}
              <div style={{ borderTop: "1px solid rgba(215, 224, 240, 0.7)", paddingTop: "0.85rem" }}>
                <div style={{ marginBottom: "0.65rem" }}>
                  <label className="px-label" style={{ fontSize: "0.72rem" }}>Nota del Alistador (Opcional)</label>
                  <input 
                    type="text" 
                    className="px-input" 
                    placeholder="Ej. Embalado en pallet #2..."
                    value={pickerNote}
                    onChange={(e) => setPickerNote(e.target.value)}
                    style={{ fontSize: "0.82rem", height: "38px", borderRadius: "8px" }}
                  />
                </div>

                <button 
                  type="button"
                  className="px-btn px-btn--primary"
                  onClick={() => handleSubmitToReview(currentPickingOrder)}
                  style={{ 
                    width: "100%", minHeight: "52px", fontSize: "0.98rem", fontWeight: "800", 
                    background: "var(--px-gradient-brand)", borderRadius: "12px",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" 
                  }}
                >
                  <Send size={18} /> 📦 Finalizar Alistamiento ➔ Enviar a Revisión
                </button>
              </div>

            </div>
          ) : (
            <div className="px-glass-panel" style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--px-muted)" }}>
              No hay pedidos activos por alistar.
              <div style={{ marginTop: "0.75rem" }}>
                <button className="px-btn px-btn--primary" onClick={() => setShowNewOrderForm(true)} style={{ background: "var(--px-gradient-brand)", minHeight: "44px", borderRadius: "10px" }}>
                  + Crear Nuevo Pedido de Despacho
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          STAGE 2: REVISIÓN Y CONTROL DE SALIDA (QUALITY & DISPATCH)
          ========================================================================= */}
      {subTab === "review" && (
        <div>
          
          {/* Order Selector Chips for Review on Mobile */}
          {pendingReviewOrders.length > 1 && (
            <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
              {pendingReviewOrders.map(o => {
                const isSelected = currentReviewOrder && currentReviewOrder.id === o.id;
                return (
                  <button 
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`px-chip ${isSelected ? "px-chip--active" : ""}`}
                    style={{ 
                      padding: "6px 12px", borderRadius: "10px", fontSize: "0.78rem", whiteSpace: "nowrap",
                      background: isSelected ? "var(--px-purple)" : "rgba(255, 255, 255, 0.8)",
                      color: isSelected ? "#fff" : "var(--px-text)",
                      border: "1.5px solid var(--px-purple)", fontWeight: "700"
                    }}
                  >
                    #{o.id} • {o.customer.slice(0, 16)}...
                  </button>
                );
              })}
            </div>
          )}

          {currentReviewOrder ? (
            <div className="px-glass-panel" style={{ padding: "1.1rem" }}>
              
              {/* Review Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem", borderBottom: "1px solid rgba(215, 224, 240, 0.7)", paddingBottom: "0.65rem" }}>
                <div>
                  <span className="px-chip px-chip--active" style={{ fontSize: "0.68rem", marginBottom: "0.2rem", background: "rgba(106, 63, 160, 0.1)", color: "var(--px-purple)" }}>
                    Auditoría de Pedido #{currentReviewOrder.id}
                  </span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--px-text)", margin: "0.15rem 0" }}>
                    {currentReviewOrder.customer}
                  </h2>
                  <div style={{ fontSize: "0.75rem", color: "var(--px-muted)" }}>
                    Alistado por: <strong>{currentReviewOrder.pickerUser}</strong> • Destino: {currentReviewOrder.destination}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span className="px-badge" style={{ fontSize: "0.75rem", background: "rgba(106, 63, 160, 0.12)", color: "var(--px-purple)", fontWeight: "800" }}>
                    Fase 2: Control
                  </span>
                </div>
              </div>

              {currentReviewOrder.notes && (
                <div style={{ padding: "0.65rem 0.75rem", background: "rgba(215, 224, 240, 0.5)", borderRadius: "10px", marginBottom: "0.85rem", fontSize: "0.78rem" }}>
                  <strong>📝 Nota del Alistador:</strong> {currentReviewOrder.notes}
                </div>
              )}

              {/* Quality Checklist */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.1rem" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: "800", color: "var(--px-muted)", textTransform: "uppercase" }}>
                  Checklist de Seriales e Ítems a Validar:
                </div>

                {currentReviewOrder.items.map((item, idx) => (
                  <div 
                    key={item.sku}
                    style={{ 
                      padding: "0.85rem",
                      background: "rgba(255, 255, 255, 0.95)",
                      border: "1.5px solid rgba(22, 163, 74, 0.4)",
                      borderRadius: "14px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <CheckCircle2 size={16} color="var(--px-green)" />
                          <span className="px-mono" style={{ fontWeight: "800", color: "var(--px-blue)", fontSize: "0.92rem" }}>
                            {item.sku}
                          </span>
                        </div>
                        <div style={{ fontWeight: "700", fontSize: "0.82rem", color: "var(--px-text-strong)", marginTop: "2px" }}>
                          {item.productName}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span className="px-badge px-badge--success" style={{ fontSize: "0.78rem", fontWeight: "800" }}>
                          ✓ {item.pickedQty} de {item.requestedQty} Alistados
                        </span>
                      </div>
                    </div>

                    {/* Serial Numbers breakdown */}
                    {item.isSerialized && (
                      <div style={{ marginTop: "0.4rem", padding: "0.55rem 0.75rem", background: "rgba(22, 163, 74, 0.08)", border: "1px solid rgba(22, 163, 74, 0.25)", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: "800", color: "var(--px-green)", marginBottom: "0.3rem" }}>
                          🛡️ Números de Serie Verificados para Despacho:
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {(item.serials || []).map((sn, sIdx) => (
                            <span key={sn} className="px-chip px-chip--active" style={{ fontSize: "0.78rem", padding: "3px 8px", background: "#fff", borderColor: "var(--px-green)", fontWeight: "800" }}>
                              #{sIdx + 1}: {sn}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Reviewer Note */}
              <div style={{ marginBottom: "0.85rem" }}>
                <label className="px-label" style={{ fontSize: "0.72rem" }}>Observaciones del Revisor / Guía de Despacho (Opcional)</label>
                <input 
                  type="text" 
                  className="px-input" 
                  placeholder="Ej. Mercancía precintada y conforme..."
                  value={reviewerNote}
                  onChange={(e) => setReviewerNote(e.target.value)}
                  style={{ fontSize: "0.82rem", height: "40px", borderRadius: "8px" }}
                />
              </div>

              {/* Action Buttons: Return or Approve (Stacked on Zebra TC22) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.85rem" }}>
                <button 
                  type="button"
                  className="px-btn px-btn--primary"
                  onClick={() => handleApproveAndDispatch(currentReviewOrder.id)}
                  style={{ 
                    width: "100%",
                    minHeight: "48px", fontSize: "0.95rem", fontWeight: "800", 
                    background: "var(--px-green)", borderRadius: "12px",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                    boxShadow: "var(--px-neu-btn-primary)"
                  }}
                >
                  <Check size={18} /> Aprobar Salida Oficial en BC
                </button>

                <button 
                  type="button"
                  className="px-btn px-btn--ghost"
                  onClick={() => setRejectionModalOrder(currentReviewOrder)}
                  style={{ width: "100%", minHeight: "36px", borderRadius: "10px", fontSize: "0.82rem", color: "var(--px-red)", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}
                >
                  <RotateCcw size={14} /> Devolver Pedido para Ajuste
                </button>
              </div>

            </div>
          ) : (
            <div className="px-glass-panel" style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--px-muted)", fontSize: "0.85rem" }}>
              ✓ No hay pedidos pendientes de revisión en este momento.
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          STAGE 3: HISTORIAL DE DESPACHADOS
          ========================================================================= */}
      {subTab === "history" && (
        <div className="px-glass-panel" style={{ padding: "1.1rem" }}>
          <div style={{ marginBottom: "0.85rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: "800", margin: 0, display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Truck size={16} color="var(--px-green)" /> Historial de Pedidos Despachados ({historyOrders.length})
            </h2>
            <span style={{ fontSize: "0.72rem", color: "var(--px-muted)" }}>
              Transmitidos en tiempo real a Microsoft Dynamics 365 Business Central Cloud
            </span>
          </div>

          {historyOrders.length === 0 ? (
            <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--px-muted)", fontSize: "0.82rem" }}>
              Aún no hay pedidos despachados.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {historyOrders.map(o => (
                <div 
                  key={o.id}
                  style={{ 
                    padding: "0.85rem 1rem",
                    background: "rgba(22, 163, 74, 0.05)",
                    border: "1px solid rgba(22, 163, 74, 0.25)",
                    borderRadius: "12px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.4rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span className="px-mono" style={{ fontWeight: "800", color: "var(--px-green)", fontSize: "0.92rem" }}>
                          #{o.id}
                        </span>
                        <span className="px-badge px-badge--success" style={{ fontSize: "0.68rem" }}>
                          🟢 DESPACHADO OFICIAL
                        </span>
                      </div>
                      <div style={{ fontWeight: "700", fontSize: "0.85rem", color: "var(--px-text-strong)", marginTop: "2px" }}>
                        {o.customer}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "0.72rem", color: "var(--px-muted)" }}>
                      <div>Despachado: <strong>{o.dispatchedAt || o.submittedToReviewAt}</strong></div>
                      <div>Revisor: <strong>{o.reviewerUser || "Supervisor"}</strong> • Alistador: <strong>{o.pickerUser}</strong></div>
                    </div>
                  </div>

                  {/* Dispatched Lines */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.4rem", paddingTop: "0.4rem", borderTop: "1px solid rgba(22, 163, 74, 0.15)" }}>
                    {o.items.map(it => (
                      <span key={it.sku} className="px-chip" style={{ fontSize: "0.72rem", background: "rgba(255, 255, 255, 0.8)", borderColor: "rgba(22, 163, 74, 0.3)" }}>
                        <strong>{it.sku}</strong>: {it.pickedQty} unid. {it.serials && it.serials.length > 0 && `(SN: ${it.serials.join(", ")})`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: REJECT ORDER BACK TO PICKING */}
      {rejectionModalOrder && (
        <div className="px-drawer-overlay" onClick={() => setRejectionModalOrder(null)}>
          <div className="px-drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--px-red)", margin: 0, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <AlertTriangle size={16} /> Devolver Pedido #{rejectionModalOrder.id}
              </h2>
              <button className="px-btn px-btn--sm px-btn--icon" onClick={() => setRejectionModalOrder(null)}>
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--px-muted)", margin: "0 0 0.75rem 0" }}>
              El pedido regresará a la bandeja de Alistamiento para que el operario de bodega corrija los seriales o cantidades.
            </p>

            <div style={{ marginBottom: "0.85rem" }}>
              <label className="px-label" style={{ fontSize: "0.72rem" }}>Motivo de la Devolución *</label>
              <textarea 
                className="px-input" 
                rows="3"
                placeholder="Ej. Serial físico no coincide con el empaque, falta 1 unidad..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ width: "100%", borderRadius: "8px", fontSize: "0.8rem", padding: "0.5rem" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="px-btn px-btn--secondary" onClick={() => setRejectionModalOrder(null)}>
                Cancelar
              </button>
              <button 
                type="button" 
                className="px-btn px-btn--primary" 
                onClick={handleConfirmRejection}
                style={{ background: "var(--px-red)" }}
              >
                Confirmar Devolución
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}