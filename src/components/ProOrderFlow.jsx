import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Briefcase, ShoppingCart, Package, FileText, Truck, MapPin, CheckCircle2, 
  Clock, ArrowRight, User, ShieldCheck, Sparkles, Plus, Search, X, 
  AlertCircle, Check, Play, Pause, RotateCcw, Send, ChevronRight, Eye, RefreshCw, Layers
} from "lucide-react";
import { storageService } from "../services/storage";
import { bcService } from "../services/bc-api";
import { audioService } from "../services/audio";

export function ProOrderFlow({ products, onOrderUpdated }) {
  const [proOrders, setProOrders] = useState(storageService.getProOrders());
  const [activeStageFilter, setActiveStageFilter] = useState("ALL");
  
  // Selected Order for 360 Modal
  const [inspectOrder, setInspectOrder] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Commercial Order Form State
  const [newCustomer, setNewCustomer] = useState("");
  const [newAgent, setNewAgent] = useState("Carolina Gómez (Comercial)");
  const [newZone, setNewZone] = useState("Bogotá Urbana");
  const [newPriority, setNewPriority] = useState("Normal");
  const [newNotes, setNewNotes] = useState("");
  const [selectedProds, setSelectedProds] = useState([]);
  const [prodSearch, setProdSearch] = useState("");

  // =========================================================================
  // STEP-BY-STEP CALM INTERACTIVE DEMO SIMULATOR STATE
  // =========================================================================
  const [demoActive, setDemoActive] = useState(false);
  const [demoCurrentStep, setDemoCurrentStep] = useState(1); // 1 to 6
  const [demoOrder, setDemoOrder] = useState(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayTimerRef = useRef(null);

  useEffect(() => {
    setProOrders(storageService.getProOrders());
  }, []);

  const refreshData = () => {
    const updated = storageService.getProOrders();
    setProOrders([...updated]);
    if (onOrderUpdated) onOrderUpdated();
  };

  // KPIs count by stage
  const stageCounts = useMemo(() => {
    const counts = { COMERCIAL: 0, COMPRAS: 0, LOGISTICA: 0, FACTURACION: 0, DESPACHO: 0, ENTREGADO: 0 };
    proOrders.forEach(o => {
      if (counts[o.stage] !== undefined) counts[o.stage]++;
    });
    return counts;
  }, [proOrders]);

  const filteredOrders = useMemo(() => {
    if (activeStageFilter === "ALL") return proOrders;
    return proOrders.filter(o => o.stage === activeStageFilter);
  }, [proOrders, activeStageFilter]);

  // Zone SLA definitions
  const ZONES = [
    { name: "Zona Sabana / Cota", sla: "1 - 2 Horas", icon: "🏭" },
    { name: "Bogotá Urbana", sla: "4 - 6 Horas", icon: "🏙️" },
    { name: "Medellín / Antioquia", sla: "24 Horas", icon: "🚚" },
    { name: "Cali / Valle", sla: "24 Horas", icon: "🌴" },
    { name: "Barranquilla / Costa", sla: "48 Horas", icon: "✈️" },
    { name: "Nacional / Otras", sla: "48 - 72 Horas", icon: "🗺️" }
  ];

  // 1. CREATE COMMERCIAL ORDER
  const handleCreateCommercialOrder = (e) => {
    if (e) e.preventDefault();
    if (!newCustomer.trim() || selectedProds.length === 0) {
      alert("Por favor ingresa cliente y al menos 1 producto.");
      return;
    }

    const created = storageService.createProOrder({
      customer: newCustomer.trim(),
      commercialAgent: newAgent,
      deliveryZone: newZone,
      priority: newPriority,
      notes: newNotes,
      items: selectedProds.map(p => {
        const found = products.find(prod => prod.sku === p.sku);
        return {
          sku: p.sku,
          productName: p.name,
          qty: p.qty,
          stockAvailable: found ? found.stock : 5,
          checkedByPurchasing: false,
          serials: [],
          isSerialized: Boolean(p.isSerialized)
        };
      })
    });

    refreshData();
    audioService.playSuccess();
    setShowCreateModal(false);
    setNewCustomer("");
    setSelectedProds([]);
    setProdSearch("");
    setActiveStageFilter("ALL");
  };

  // 2. PURCHASING: TOGGLE ITEM CHECK
  const handleTogglePurchasingCheck = (order, itemSku) => {
    const updatedItems = order.items.map(it => {
      if (it.sku === itemSku) {
        return { ...it, checkedByPurchasing: !it.checkedByPurchasing };
      }
      return it;
    });

    storageService.advanceProOrderStage(order.id, order.stage, { items: updatedItems });
    refreshData();
  };

  // 2. PURCHASING: APPROVE STOCK & ADVANCE TO LOGISTICS
  const handleApprovePurchasing = (order) => {
    const allChecked = order.items.every(it => it.checkedByPurchasing);
    if (!allChecked) {
      if (!window.confirm("Hay ítems sin marcar en el checklist de compras. ¿Deseas autorizar el paso a Logística?")) {
        return;
      }
    }

    storageService.advanceProOrderStage(order.id, "LOGISTICA", {
      user: "Andrés Pulido (Compras)",
      note: "Disponibilidad de inventario 100% validada en Bodega Cota."
    });

    refreshData();
    audioService.playSuccess();
  };

  // 3. LOGISTICS: ASSIGN OPERATOR & COMPLETE PICKING
  const handleCompleteLogistics = (order) => {
    const pickedItems = order.items.map((it, idx) => {
      const serials = it.isSerialized && it.serials.length === 0
        ? Array.from({ length: it.qty }, (_, i) => `SN-${it.sku.slice(0, 4)}-${Date.now().toString().slice(-4)}-0${i + 1}`)
        : it.serials;
      return { ...it, serials };
    });

    storageService.advanceProOrderStage(order.id, "FACTURACION", {
      assignedOperator: "Carlos Mendoza (Zebra #1)",
      items: pickedItems,
      user: "Carlos Mendoza (Bodega Zebra)",
      note: `Alistamiento completado en Zebra TC22 por Carlos Mendoza.`
    });

    refreshData();
    audioService.playSuccess();
  };

  // 4. INVOICING: EMIT INVOICE & DISPATCH LINE TO BUSINESS CENTRAL
  const handleEmitInvoice = async (order) => {
    const invNo = "FAC-2026-" + Math.floor(1000 + Math.random() * 9000);

    for (const it of order.items) {
      await bcService.postMovement({
        type: "SALIDA",
        sku: it.sku,
        productName: it.productName,
        quantity: it.qty,
        serialNo: it.serials.join(", "),
        serialList: it.serials,
        location: "COTA",
        bin: "COTA-EXP-01",
        user: "Facturación Provexpress / Business Central",
        note: `Factura ${invNo} Pedido #${order.id} (${order.customer})`
      });
    }

    storageService.advanceProOrderStage(order.id, "DESPACHO", {
      invoiceNo: invNo,
      user: "Sandra Vega (Facturación)",
      note: `Factura ${invNo} emitida. Movimiento asentado en Business Central. Notificado a Comercial.`
    });

    refreshData();
    audioService.playSuccess();
  };

  // 5. DISPATCH: ASSIGN CARRIER & TRACKING
  const handleDispatchOrder = (order) => {
    const guideNo = `GUIA-PX-${Math.floor(100000 + Math.random() * 900000)}`;

    storageService.advanceProOrderStage(order.id, "ENTREGADO", {
      carrier: "Flota Propia Provexpress (Móvil #1)",
      trackingNumber: guideNo,
      user: "Muelle de Despacho",
      note: `Mercancía rotulada y despachada en muelle con Flota Propia (Guía: ${guideNo}).`
    });

    refreshData();
    audioService.playSuccess();
  };

  // =========================================================================
  // CALM STEP-BY-STEP SIMULATOR ENGINE (Controlled Pace)
  // =========================================================================
  const handleStartCalmDemo = () => {
    const newDemo = storageService.createProOrder({
      customer: "Nutresa Colombia S.A. (Demo Pro)",
      commercialAgent: "Carolina Gómez (Comercial)",
      deliveryZone: "Bogotá Urbana",
      priority: "Alta",
      notes: "Pedido corporativo para demostración guiada paso a paso",
      items: [
        {
          sku: "TEC-ZEB-001",
          productName: "Handheld Zebra TC22 Android (Bodega COTA)",
          qty: 2,
          stockAvailable: 5,
          checkedByPurchasing: true,
          serials: ["SN-DEMO-2026-01", "SN-DEMO-2026-02"],
          isSerialized: true
        }
      ]
    });

    setDemoOrder(newDemo);
    setDemoActive(true);
    setDemoCurrentStep(1);
    setIsAutoPlaying(false);
    setActiveStageFilter("ALL");
    refreshData();
    audioService.playSuccess();
  };

  const handleNextDemoStep = async () => {
    if (!demoOrder) return;
    const nextStep = demoCurrentStep + 1;

    if (nextStep === 2) {
      // Step 2: Compras check
      storageService.advanceProOrderStage(demoOrder.id, "COMPRAS", {
        user: "Andrés Pulido (Compras)",
        note: "Compras recibe el pedido e inicia validación de existencias en Bodega Cota."
      });
    } else if (nextStep === 3) {
      // Step 3: Compras approves -> Logistics
      storageService.advanceProOrderStage(demoOrder.id, "LOGISTICA", {
        user: "Andrés Pulido (Compras)",
        note: "Checklist de stock 100% verificado. Transferido a Bodega Cota para Picking."
      });
    } else if (nextStep === 4) {
      // Step 4: Logistics -> Invoicing
      storageService.advanceProOrderStage(demoOrder.id, "FACTURACION", {
        assignedOperator: "Carlos Mendoza (Zebra #1)",
        user: "Carlos Mendoza (Bodega Zebra)",
        note: "Alistamiento completado en Zebra TC22 con seriales SN-DEMO-2026-01 y 02."
      });
    } else if (nextStep === 5) {
      // Step 5: Invoicing -> Dispatch
      const inv = "FAC-2026-" + Math.floor(1000 + Math.random() * 9000);
      storageService.advanceProOrderStage(demoOrder.id, "DESPACHO", {
        invoiceNo: inv,
        user: "Sandra Vega (Facturación)",
        note: `Factura ${inv} generada y sincronizada con Business Central. Notificado a Comercial.`
      });
    } else if (nextStep === 6) {
      // Step 6: Dispatch -> Delivered
      const gd = "GUIA-PX-98241";
      storageService.advanceProOrderStage(demoOrder.id, "ENTREGADO", {
        carrier: "Flota Propia Provexpress (Móvil #1)",
        trackingNumber: gd,
        user: "Muelle Despacho & Transporte",
        note: `Entregado en Bogotá Urbana a satisfacción en 4.5 horas (dentro del SLA).`
      });
    }

    setDemoCurrentStep(Math.min(6, nextStep));
    refreshData();
    audioService.playSuccess();
  };

  const handlePrevDemoStep = () => {
    setDemoCurrentStep(Math.max(1, demoCurrentStep - 1));
  };

  const handleCloseDemo = () => {
    setDemoActive(false);
    setIsAutoPlaying(false);
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
  };

  // Auto-play calm loop (5 seconds per stage)
  useEffect(() => {
    if (isAutoPlaying && demoActive) {
      autoPlayTimerRef.current = setInterval(() => {
        setDemoCurrentStep(prev => {
          if (prev >= 6) {
            setIsAutoPlaying(false);
            return 6;
          }
          handleNextDemoStep();
          return prev + 1;
        });
      }, 5000);
    } else {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    }
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isAutoPlaying, demoActive, demoCurrentStep]);

  // Demo step descriptions
  const DEMO_STEPS_INFO = [
    {
      step: 1,
      role: "👤 1. Área Comercial (Ventas)",
      actor: "Carolina Gómez (Asesora Comercial)",
      action: "Creación del Pedido de Venta",
      details: "El comercial registra el pedido para Nutresa Colombia. Selecciona destino 'Bogotá Urbana' y el sistema calcula automáticamente el SLA de entrega (4 - 6 Horas).",
      statusMsg: "🟡 Pedido creado y transmitido automáticamente a la bandeja de Compras.",
      color: "var(--px-blue)"
    },
    {
      step: 2,
      role: "🛒 2. Área de Compras (Abastecimiento)",
      actor: "Andrés Pulido (Compras)",
      action: "Validación de Existencias en Inventario",
      details: "Compras inspecciona el checklist de productos solicitados. Valida contra Business Central que hay 5 unidades en stock en Bodega Cota.",
      statusMsg: "📋 Checklist de stock en verificación. El comercial puede ver en su radar que Compras está revisando.",
      color: "var(--px-amber)"
    },
    {
      step: 3,
      role: "📱 3. Logística & Bodega (Picking en Zebra)",
      actor: "Carlos Mendoza (Operario Zebra #1)",
      action: "Alistamiento Físico y Captura de Seriales",
      details: "Se asigna el pedido a la terminal Zebra TC22 de Carlos Mendoza. Escanea con el láser los 2 números de serie físicos (SN-DEMO-2026-01 y 02).",
      statusMsg: "📦 Picking finalizado y auditado. Enviado a Facturación para cierre fiscal.",
      color: "var(--px-blue)"
    },
    {
      step: 4,
      role: "🧾 4. Facturación & Business Central",
      actor: "Sandra Vega (Facturación)",
      action: "Emisión de Factura y Descuento Contable",
      details: "Facturación valida los seriales alistados, emite la Factura Oficial FAC-2026-8942 y asienta la salida directamente en Microsoft Dynamics 365 Business Central Cloud.",
      statusMsg: "⚡ Facturado con éxito. El Asesor Comercial recibe notificación de pedido listo.",
      color: "var(--px-purple)"
    },
    {
      step: 5,
      role: "🚚 5. Muelle de Despacho & Transporte",
      actor: "Muelle Despacho Cota",
      action: "Embalaje, Rotulado y Asignación de Guía",
      details: "Se embala el paquete en estiba sellada, se genera la Guía GUIA-PX-98241 y se asigna al vehículo de Flota Propia Provexpress (Móvil #1).",
      statusMsg: "🛣️ En ruta hacia Bogotá Urbana.",
      color: "var(--px-cyan)"
    },
    {
      step: 6,
      role: "🟢 6. Zona de Entrega (Destino Final)",
      actor: "Transportadora & Cliente Nutresa",
      action: "Entrega a Satisfacción con Firma Digital",
      details: "La mercancía llega a la sede de Nutresa en Bogotá Urbana en 4.5 horas, cumpliendo con el SLA pactado. Se firma el recibido digital.",
      statusMsg: "🎉 ¡Ciclo Completo Exitoso! Trazabilidad 360° guardada permanentemente en el sistema.",
      color: "var(--px-green)"
    }
  ];

  const currentStepData = DEMO_STEPS_INFO[demoCurrentStep - 1] || DEMO_STEPS_INFO[0];

  return (
    <div style={{ width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "0.85rem 0.75rem", boxSizing: "border-box" }}>
      
      {/* Top Banner & Control Deck */}
      <div className="px-glass-panel" style={{ padding: "1.1rem 1.25rem", marginBottom: "1rem", border: "1.5px solid rgba(26, 43, 107, 0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
              <span className="px-chip px-chip--active" style={{ fontSize: "0.68rem", background: "linear-gradient(135deg, rgba(26, 43, 107, 0.12), rgba(21, 101, 192, 0.15))", color: "var(--px-blue)", fontWeight: "800" }}>
                <Sparkles size={11} /> Pipeline Operacional End-to-End
              </span>
              <span className="px-badge px-badge--success" style={{ fontSize: "0.68rem" }}>
                6 Fases Conectadas
              </span>
            </div>
            <h1 style={{ fontSize: "1.45rem", fontWeight: "800", color: "var(--px-text)", margin: 0, letterSpacing: "-0.02em" }}>
              ⚡ Flujo Pro: Comercial ➔ Compras ➔ Logística ➔ Facturación ➔ Entrega
            </h1>
            <p style={{ margin: "0.2rem 0 0 0", color: "var(--px-muted)", fontSize: "0.82rem" }}>
              Trazabilidad 360° en tiempo real con tiempos de entrega (SLA) dinámicos por zona
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button 
              type="button"
              className="px-btn px-btn--secondary"
              onClick={handleStartCalmDemo}
              style={{ background: "rgba(106, 63, 160, 0.12)", color: "var(--px-purple)", border: "1.5px solid var(--px-purple)", fontWeight: "800", fontSize: "0.85rem", borderRadius: "10px", padding: "0.55rem 0.95rem" }}
            >
              <Play size={14} /> 🧪 Abrir Demostración Guiada (Paso a Paso)
            </button>

            <button 
              type="button"
              className="px-btn px-btn--primary"
              onClick={() => setShowCreateModal(true)}
              style={{ background: "var(--px-gradient-brand)", fontWeight: "800", fontSize: "0.85rem", borderRadius: "10px", padding: "0.55rem 1.1rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
            >
              <Plus size={16} /> + Nuevo Pedido Comercial
            </button>
          </div>
        </div>

        {/* 6 Stages KPI Stepper Filter */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.4rem", marginTop: "1rem" }}>
          
          <button 
            type="button"
            className={`px-btn ${activeStageFilter === "ALL" ? "px-btn--primary" : "px-btn--ghost"}`}
            onClick={() => setActiveStageFilter("ALL")}
            style={{ minHeight: "44px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: "800", background: activeStageFilter === "ALL" ? "var(--px-text)" : "rgba(244, 247, 255, 0.7)", color: activeStageFilter === "ALL" ? "#fff" : "var(--px-text)" }}
          >
            Todos ({proOrders.length})
          </button>

          <button 
            type="button"
            className={`px-btn ${activeStageFilter === "COMPRAS" ? "px-btn--primary" : "px-btn--ghost"}`}
            onClick={() => setActiveStageFilter("COMPRAS")}
            style={{ minHeight: "44px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: "800", background: activeStageFilter === "COMPRAS" ? "var(--px-amber)" : "rgba(244, 247, 255, 0.7)", color: activeStageFilter === "COMPRAS" ? "#fff" : "var(--px-text)" }}
          >
            🛒 Compras ({stageCounts.COMPRAS})
          </button>

          <button 
            type="button"
            className={`px-btn ${activeStageFilter === "LOGISTICA" ? "px-btn--primary" : "px-btn--ghost"}`}
            onClick={() => setActiveStageFilter("LOGISTICA")}
            style={{ minHeight: "44px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: "800", background: activeStageFilter === "LOGISTICA" ? "var(--px-blue)" : "rgba(244, 247, 255, 0.7)", color: activeStageFilter === "LOGISTICA" ? "#fff" : "var(--px-text)" }}
          >
            📱 Logística ({stageCounts.LOGISTICA})
          </button>

          <button 
            type="button"
            className={`px-btn ${activeStageFilter === "FACTURACION" ? "px-btn--primary" : "px-btn--ghost"}`}
            onClick={() => setActiveStageFilter("FACTURACION")}
            style={{ minHeight: "44px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: "800", background: activeStageFilter === "FACTURACION" ? "var(--px-purple)" : "rgba(244, 247, 255, 0.7)", color: activeStageFilter === "FACTURACION" ? "#fff" : "var(--px-text)" }}
          >
            🧾 Facturación ({stageCounts.FACTURACION})
          </button>

          <button 
            type="button"
            className={`px-btn ${activeStageFilter === "DESPACHO" ? "px-btn--primary" : "px-btn--ghost"}`}
            onClick={() => setActiveStageFilter("DESPACHO")}
            style={{ minHeight: "44px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: "800", background: activeStageFilter === "DESPACHO" ? "var(--px-cyan)" : "rgba(244, 247, 255, 0.7)", color: activeStageFilter === "DESPACHO" ? "#fff" : "var(--px-text)" }}
          >
            🚚 Despacho ({stageCounts.DESPACHO})
          </button>

          <button 
            type="button"
            className={`px-btn ${activeStageFilter === "ENTREGADO" ? "px-btn--primary" : "px-btn--ghost"}`}
            onClick={() => setActiveStageFilter("ENTREGADO")}
            style={{ minHeight: "44px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: "800", background: activeStageFilter === "ENTREGADO" ? "var(--px-green)" : "rgba(244, 247, 255, 0.7)", color: activeStageFilter === "ENTREGADO" ? "#fff" : "var(--px-text)" }}
          >
            🟢 Entregados ({stageCounts.ENTREGADO})
          </button>

        </div>
      </div>

      {/* =========================================================================
          CALM STEP-BY-STEP INTERACTIVE DEMO PRESENTATION DECK
          ========================================================================= */}
      {demoActive && (
        <div className="px-glass-panel" style={{ padding: "1.25rem", marginBottom: "1.25rem", border: "2px solid var(--px-purple)", background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 240, 255, 0.9))", boxShadow: "0 8px 32px rgba(106, 63, 160, 0.15)" }}>
          
          {/* Header of Demo Deck */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid rgba(106, 63, 160, 0.2)", paddingBottom: "0.75rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span className="px-badge" style={{ background: "var(--px-purple)", color: "#fff", fontWeight: "800" }}>
                  Paso {demoCurrentStep} de 6
                </span>
                <span style={{ fontWeight: "800", fontSize: "1.1rem", color: "var(--px-text)" }}>
                  {currentStepData.role}
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--px-muted)", marginTop: "2px" }}>
                Responsable: <strong>{currentStepData.actor}</strong> • Acción: <strong>{currentStepData.action}</strong>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <button 
                type="button" 
                className="px-btn px-btn--sm px-btn--secondary"
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "4px" }}
              >
                {isAutoPlaying ? <Pause size={13} /> : <Play size={13} />}
                {isAutoPlaying ? "Pausar Auto (5s)" : "Reproducir Auto (5s)"}
              </button>
              <button className="px-btn px-btn--sm px-btn--icon" onClick={handleCloseDemo}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 6 Visual Stage Nodes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.4rem", marginBottom: "1.25rem" }}>
            {DEMO_STEPS_INFO.map((st) => {
              const isPast = demoCurrentStep > st.step;
              const isCurrent = demoCurrentStep === st.step;

              return (
                <div 
                  key={st.step}
                  onClick={() => setDemoCurrentStep(st.step)}
                  style={{ 
                    padding: "0.5rem 0.4rem", borderRadius: "10px", textAlign: "center", cursor: "pointer",
                    background: isCurrent ? "rgba(106, 63, 160, 0.15)" : isPast ? "rgba(22, 163, 74, 0.08)" : "rgba(215, 224, 240, 0.4)",
                    border: `2px solid ${isCurrent ? "var(--px-purple)" : isPast ? "var(--px-green)" : "transparent"}`,
                    transition: "all 0.3s ease"
                  }}
                >
                  <div style={{ 
                    width: "24px", height: "24px", borderRadius: "50%", margin: "0 auto 4px auto",
                    background: isCurrent ? "var(--px-purple)" : isPast ? "var(--px-green)" : "rgba(215, 224, 240, 0.8)",
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "0.75rem"
                  }}>
                    {isPast ? "✓" : st.step}
                  </div>
                  <div style={{ fontSize: "0.68rem", fontWeight: "700", color: isCurrent ? "var(--px-purple)" : "var(--px-text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {st.role.split(" ")[1]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Narrative Card for Current Step */}
          <div style={{ padding: "1rem", background: "#ffffff", borderRadius: "14px", border: "1.5px solid rgba(106, 63, 160, 0.25)", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.95rem", fontWeight: "800", color: currentStepData.color }}>
                {currentStepData.action}
              </div>
              <span className="px-badge px-badge--success" style={{ fontSize: "0.72rem" }}>
                {currentStepData.statusMsg}
              </span>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--px-text)", lineHeight: "1.5", margin: "0 0 0.75rem 0" }}>
              {currentStepData.details}
            </p>

            {/* Live Order Simulation Data Badge */}
            {demoOrder && (
              <div style={{ padding: "0.6rem 0.85rem", background: "rgba(244, 247, 255, 0.8)", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem" }}>
                <div>
                  <strong>Pedido:</strong> #{demoOrder.id} ({demoOrder.customer}) • <strong>Destino:</strong> {demoOrder.deliveryZone} (SLA: {demoOrder.slaHours})
                </div>
                <button 
                  type="button" 
                  className="px-btn px-btn--sm px-btn--ghost" 
                  onClick={() => setInspectOrder(demoOrder)}
                  style={{ color: "var(--px-blue)", fontWeight: "700", padding: "2px 6px" }}
                >
                  <Eye size={12} /> Ver Timeline 360°
                </button>
              </div>
            )}
          </div>

          {/* Stepper Navigation Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button 
              type="button" 
              className="px-btn px-btn--secondary"
              disabled={demoCurrentStep === 1}
              onClick={handlePrevDemoStep}
              style={{ fontSize: "0.82rem", borderRadius: "8px" }}
            >
              ← Paso Anterior
            </button>

            <span style={{ fontSize: "0.8rem", color: "var(--px-muted)", fontWeight: "600" }}>
              Haz clic en "Siguiente Paso" a tu propio ritmo para explicar cada fase
            </span>

            {demoCurrentStep < 6 ? (
              <button 
                type="button" 
                className="px-btn px-btn--primary"
                onClick={handleNextDemoStep}
                style={{ background: "var(--px-purple)", fontSize: "0.85rem", fontWeight: "800", borderRadius: "8px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                Avanzar a Paso {demoCurrentStep + 1} →
              </button>
            ) : (
              <button 
                type="button" 
                className="px-btn px-btn--primary"
                onClick={handleCloseDemo}
                style={{ background: "var(--px-green)", fontSize: "0.85rem", fontWeight: "800", borderRadius: "8px" }}
              >
                🎉 Finalizar Demostración
              </button>
            )}
          </div>

        </div>
      )}

      {/* Orders Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: "1rem" }}>
        {filteredOrders.map(order => {
          const totalUnits = order.items.reduce((s, it) => s + it.qty, 0);

          return (
            <div 
              key={order.id}
              className="px-glass-panel"
              style={{ 
                padding: "1.1rem", 
                border: `1.5px solid ${order.stage === "ENTREGADO" ? "rgba(22, 163, 74, 0.3)" : order.stage === "COMPRAS" ? "rgba(245, 158, 11, 0.35)" : "rgba(21, 101, 192, 0.3)"}`,
                display: "flex", flexDirection: "column", justifyContent: "space-between"
              }}
            >
              <div>
                {/* Header Card */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span className="px-mono" style={{ fontWeight: "800", fontSize: "0.95rem", color: "var(--px-blue)" }}>
                        #{order.id}
                      </span>
                      {order.priority === "Alta" && (
                        <span className="px-badge px-badge--danger" style={{ fontSize: "0.65rem" }}>
                          ⚡ Prioridad Alta
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: "800", fontSize: "0.92rem", color: "var(--px-text-strong)", marginTop: "2px" }}>
                      {order.customer}
                    </div>
                  </div>

                  {/* Stage Badge */}
                  <div>
                    {order.stage === "COMPRAS" && <span className="px-badge px-badge--warning" style={{ fontSize: "0.72rem", fontWeight: "800" }}>🛒 1. En Compras (Validar Stock)</span>}
                    {order.stage === "LOGISTICA" && <span className="px-badge" style={{ fontSize: "0.72rem", background: "rgba(21, 101, 192, 0.12)", color: "var(--px-blue)", fontWeight: "800" }}>📱 2. En Logística (Picking)</span>}
                    {order.stage === "FACTURACION" && <span className="px-badge" style={{ fontSize: "0.72rem", background: "rgba(106, 63, 160, 0.12)", color: "var(--px-purple)", fontWeight: "800" }}>🧾 3. En Facturación & BC</span>}
                    {order.stage === "DESPACHO" && <span className="px-badge" style={{ fontSize: "0.72rem", background: "rgba(8, 145, 178, 0.12)", color: "var(--px-cyan)", fontWeight: "800" }}>🚚 4. Muelle Despacho</span>}
                    {order.stage === "ENTREGADO" && <span className="px-badge px-badge--success" style={{ fontSize: "0.72rem", fontWeight: "800" }}>🟢 5. Entregado Conforme</span>}
                  </div>
                </div>

                {/* Info Pills: Commercial, Zone, SLA */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem", fontSize: "0.74rem" }}>
                  <span className="px-chip" style={{ background: "rgba(244, 247, 255, 0.8)" }}>
                    👤 Asesor: <strong>{order.commercialAgent}</strong>
                  </span>
                  <span className="px-chip" style={{ background: "rgba(244, 247, 255, 0.8)" }}>
                    📍 Destino: <strong>{order.deliveryZone}</strong>
                  </span>
                  <span className="px-chip" style={{ background: "rgba(22, 163, 74, 0.08)", color: "var(--px-green)", borderColor: "var(--px-green)" }}>
                    ⏱️ SLA: <strong>{order.slaHours}</strong>
                  </span>
                </div>

                {/* Items in Order */}
                <div style={{ padding: "0.6rem 0.75rem", background: "rgba(255, 255, 255, 0.9)", borderRadius: "10px", border: "1px solid rgba(215, 224, 240, 0.8)", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: "800", color: "var(--px-muted)", marginBottom: "0.35rem", textTransform: "uppercase" }}>
                    Líneas Solicitadas ({totalUnits} unidades):
                  </div>
                  {order.items.map(it => (
                    <div key={it.sku} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", padding: "2px 0" }}>
                      <div>
                        <span className="px-mono" style={{ fontWeight: "700", color: "var(--px-blue)" }}>{it.sku}</span>
                        <span style={{ marginLeft: "6px", color: "var(--px-text)" }}>{it.productName}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <span className="px-badge" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
                          x{it.qty}
                        </span>
                        {order.stage === "COMPRAS" && (
                          <button 
                            type="button" 
                            onClick={() => handleTogglePurchasingCheck(order, it.sku)}
                            style={{ background: it.checkedByPurchasing ? "var(--px-green)" : "rgba(215, 224, 240, 0.8)", border: "none", color: "#fff", borderRadius: "5px", padding: "2px 6px", cursor: "pointer", fontSize: "0.68rem", fontWeight: "800" }}
                          >
                            {it.checkedByPurchasing ? "✓ Stock OK" : "Validar"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Meta details if advanced */}
                {order.invoiceNo && (
                  <div style={{ fontSize: "0.75rem", color: "var(--px-purple)", fontWeight: "700", marginBottom: "0.4rem" }}>
                    🧾 Factura Oficial: {order.invoiceNo} (Asentada en Business Central)
                  </div>
                )}
                {order.trackingNumber && (
                  <div style={{ fontSize: "0.75rem", color: "var(--px-blue)", fontWeight: "700", marginBottom: "0.4rem" }}>
                    🚚 Guía de Transporte: {order.trackingNumber} ({order.carrier})
                  </div>
                )}
              </div>

              {/* Action Controls by Stage */}
              <div style={{ borderTop: "1px solid rgba(215, 224, 240, 0.7)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
                
                {/* 1. STAGE: COMPRAS ACTION */}
                {order.stage === "COMPRAS" && (
                  <button 
                    type="button"
                    className="px-btn px-btn--primary"
                    onClick={() => handleApprovePurchasing(order)}
                    style={{ width: "100%", background: "var(--px-amber)", fontWeight: "800", minHeight: "44px", borderRadius: "10px", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}
                  >
                    <ShoppingCart size={15} /> 🛒 Aprobar Stock ➔ Pasar a Logística
                  </button>
                )}

                {/* 2. STAGE: LOGISTICS ACTION */}
                {order.stage === "LOGISTICA" && (
                  <button 
                    type="button"
                    className="px-btn px-btn--primary"
                    onClick={() => handleCompleteLogistics(order)}
                    style={{ width: "100%", background: "var(--px-blue)", fontWeight: "800", minHeight: "44px", borderRadius: "10px", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}
                  >
                    <Package size={15} /> 📱 Finalizar Picking ➔ Pasar a Facturación
                  </button>
                )}

                {/* 3. STAGE: INVOICING ACTION */}
                {order.stage === "FACTURACION" && (
                  <button 
                    type="button"
                    className="px-btn px-btn--primary"
                    onClick={() => handleEmitInvoice(order)}
                    style={{ width: "100%", background: "var(--px-purple)", fontWeight: "800", minHeight: "44px", borderRadius: "10px", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}
                  >
                    <FileText size={15} /> 🧾 Facturar & Asentar en BC ➔ Pasar a Despacho
                  </button>
                )}

                {/* 4. STAGE: DISPATCH ACTION */}
                {order.stage === "DESPACHO" && (
                  <button 
                    type="button"
                    className="px-btn px-btn--primary"
                    onClick={() => handleDispatchOrder(order)}
                    style={{ width: "100%", background: "var(--px-cyan)", color: "#fff", fontWeight: "800", minHeight: "44px", borderRadius: "10px", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}
                  >
                    <Truck size={15} /> 🚚 Despachar en Muelle con {order.carrier}
                  </button>
                )}

                {/* 5. STAGE: DELIVERED */}
                {order.stage === "ENTREGADO" && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--px-green)", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle2 size={15} /> Ciclo Completado
                    </span>
                    <button 
                      type="button" 
                      className="px-btn px-btn--sm px-btn--ghost"
                      onClick={() => setInspectOrder(order)}
                      style={{ fontSize: "0.75rem", color: "var(--px-blue)", fontWeight: "700" }}
                    >
                      <Eye size={13} /> Ver Trazabilidad 360°
                    </button>
                  </div>
                )}

                {/* Button to open 360 Timeline for any active order */}
                {order.stage !== "ENTREGADO" && (
                  <div style={{ marginTop: "0.4rem", textAlign: "center" }}>
                    <button 
                      type="button" 
                      className="px-btn px-btn--sm px-btn--ghost"
                      onClick={() => setInspectOrder(order)}
                      style={{ fontSize: "0.72rem", color: "var(--px-muted)", display: "inline-flex", alignItems: "center", gap: "3px" }}
                    >
                      <Clock size={12} /> Ver Línea de Tiempo del Pedido ({order.timeline.length} eventos)
                    </button>
                  </div>
                )}

              </div>

            </div>
          );
        })}
      </div>

      {/* MODAL: 360° ORDER TIMELINE TRACKER */}
      {inspectOrder && (
        <div className="px-drawer-overlay" onClick={() => setInspectOrder(null)}>
          <div className="px-drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", borderBottom: "1px solid rgba(215, 224, 240, 0.7)", paddingBottom: "0.75rem" }}>
              <div>
                <span className="px-chip px-chip--active" style={{ fontSize: "0.68rem", marginBottom: "0.2rem", background: "rgba(21, 101, 192, 0.1)", color: "var(--px-blue)" }}>
                  Trazabilidad 360° del Pedido #{inspectOrder.id}
                </span>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--px-text)", margin: "0.15rem 0" }}>
                  {inspectOrder.customer}
                </h2>
                <div style={{ fontSize: "0.75rem", color: "var(--px-muted)" }}>
                  Asesor: <strong>{inspectOrder.commercialAgent}</strong> • Destino: <strong>{inspectOrder.deliveryZone}</strong> (SLA: {inspectOrder.slaHours})
                </div>
              </div>

              <button className="px-btn px-btn--sm px-btn--icon" onClick={() => setInspectOrder(null)}>
                <X size={16} />
              </button>
            </div>

            {/* Stepper Visual Timeline */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1rem" }}>
              {inspectOrder.timeline.map((evt, idx) => (
                <div key={idx} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ 
                      width: "26px", height: "26px", borderRadius: "50%", 
                      background: idx === inspectOrder.timeline.length - 1 ? "var(--px-blue)" : "var(--px-green)",
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "0.75rem"
                    }}>
                      ✓
                    </div>
                    {idx < inspectOrder.timeline.length - 1 && (
                      <div style={{ width: "2px", height: "35px", background: "var(--px-green)", margin: "2px 0" }}></div>
                    )}
                  </div>

                  <div style={{ flex: 1, padding: "0.55rem 0.75rem", background: "rgba(244, 247, 255, 0.8)", borderRadius: "10px", border: "1px solid rgba(215, 224, 240, 0.8)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                      <span className="px-badge px-badge--success" style={{ fontSize: "0.68rem" }}>
                        {evt.stage}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "var(--px-muted)" }}>
                        {evt.time}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--px-text-strong)" }}>
                      {evt.user}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--px-muted)", marginTop: "2px" }}>
                      {evt.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "right", borderTop: "1px solid rgba(215, 224, 240, 0.7)", paddingTop: "0.75rem" }}>
              <button type="button" className="px-btn px-btn--secondary" onClick={() => setInspectOrder(null)}>
                Cerrar Trazabilidad
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CREATE COMMERCIAL ORDER */}
      {showCreateModal && (
        <div className="px-drawer-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="px-drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "800", margin: 0, color: "var(--px-blue)" }}>
                👤 1. Crear Nuevo Pedido Comercial
              </h2>
              <button className="px-btn px-btn--sm px-btn--icon" onClick={() => setShowCreateModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateCommercialOrder} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              
              <div>
                <label className="px-label" style={{ fontSize: "0.75rem" }}>Nombre del Cliente / Empresa *</label>
                <input 
                  type="text" 
                  className="px-input" 
                  required
                  placeholder="Ej. Banco de Bogotá, Falabella, Nutresa..."
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                  style={{ height: "42px", fontSize: "0.9rem", fontWeight: "700" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label className="px-label" style={{ fontSize: "0.75rem" }}>Asesor Comercial</label>
                  <select 
                    className="px-select"
                    value={newAgent}
                    onChange={(e) => setNewAgent(e.target.value)}
                    style={{ height: "42px", fontSize: "0.82rem" }}
                  >
                    <option value="Carolina Gómez (Comercial)">Carolina Gómez</option>
                    <option value="Julián Morales (Comercial)">Julián Morales</option>
                    <option value="Valeria Torres (Comercial)">Valeria Torres</option>
                    <option value="Andrés Pulido (Comercial)">Andrés Pulido</option>
                  </select>
                </div>

                <div>
                  <label className="px-label" style={{ fontSize: "0.75rem" }}>Prioridad</label>
                  <select 
                    className="px-select"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    style={{ height: "42px", fontSize: "0.82rem" }}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Alta">⚡ Alta Prioridad</option>
                    <option value="Urgente">🚨 Urgente (Despacho Inmediato)</option>
                  </select>
                </div>
              </div>

              {/* Zone Selector with SLA */}
              <div>
                <label className="px-label" style={{ fontSize: "0.75rem" }}>Zona de Entrega & Destino (Calcula SLA de Transporte):</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
                  {ZONES.map(z => (
                    <div 
                      key={z.name}
                      onClick={() => setNewZone(z.name)}
                      style={{ 
                        padding: "0.5rem 0.65rem", borderRadius: "10px", cursor: "pointer",
                        background: newZone === z.name ? "rgba(21, 101, 192, 0.12)" : "rgba(244, 247, 255, 0.7)",
                        border: `1.5px solid ${newZone === z.name ? "var(--px-blue)" : "rgba(215, 224, 240, 0.7)"}`,
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.78rem", fontWeight: "700" }}>{z.icon} {z.name}</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--px-green)", fontWeight: "700" }}>SLA: {z.sla}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Picker */}
              <div>
                <label className="px-label" style={{ fontSize: "0.75rem" }}>Seleccionar Productos a Solicitar ({selectedProds.length} seleccionados):</label>
                <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem", padding: "0.3rem", background: "rgba(244, 247, 255, 0.6)", borderRadius: "10px", border: "1px solid var(--px-border)" }}>
                  {products.slice(0, 20).map(p => {
                    const isSelected = selectedProds.some(sp => sp.sku === p.sku);
                    return (
                      <div 
                        key={p.sku}
                        onClick={() => {
                          if (isSelected) setSelectedProds(selectedProds.filter(sp => sp.sku !== p.sku));
                          else setSelectedProds([...selectedProds, { ...p, qty: 1 }]);
                        }}
                        style={{ 
                          padding: "0.4rem 0.6rem", borderRadius: "8px", cursor: "pointer",
                          background: isSelected ? "rgba(21, 101, 192, 0.15)" : "#fff",
                          border: `1px solid ${isSelected ? "var(--px-blue)" : "rgba(215, 224, 240, 0.6)"}`,
                          display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}
                      >
                        <span className="px-mono" style={{ fontSize: "0.8rem", fontWeight: "700" }}>{p.sku} - {p.name}</span>
                        <span className="px-badge px-badge--success" style={{ fontSize: "0.65rem" }}>Stock: {p.stock}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button type="button" className="px-btn px-btn--secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="px-btn px-btn--primary" style={{ background: "var(--px-gradient-brand)" }}>
                  + Ingresar Pedido ➔ Enviar a Compras
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}