import React, { useState, useMemo } from "react";
import { 
  DollarSign, Package, Tag, AlertTriangle, X, Filter, ChevronRight, 
  Layers, TrendingUp, CheckCircle2, QrCode, ShieldCheck, 
  ArrowDownLeft, ArrowUpRight, ClipboardList, Activity, FileSpreadsheet, 
  ArrowRight, Search, Eye, Download, Check, FileText, Zap, BarChart3, 
  PieChart, Clock, Award, AlertCircle
} from "lucide-react";
import { storageService } from "../services/storage";
import { ReportsModal } from "./ReportsModal";

export function Dashboard({ products, onSelectProduct, onGoToZebra, onOperateProduct, onGoToKardex, onGoToOutbound }) {
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  const formatCOP = (val) => {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val || 0);
  };

  const getProductCost = (p) => {
    if (p.unitCost && Number(p.unitCost) > 0) return Number(p.unitCost);
    if (p.totalValue && p.stock && Number(p.stock) > 0) return Math.round(Number(p.totalValue) / Number(p.stock));
    if (p.unitPrice && Number(p.unitPrice) > 0) return Math.round(Number(p.unitPrice) * 0.75);
    return 120000;
  };

  const enrichedProducts = useMemo(() => {
    return products.map(p => {
      const cost = getProductCost(p);
      const stock = Number(p.stock) || 0;
      return {
        ...p,
        stock,
        unitCost: cost,
        totalValue: stock * cost,
        brand: p.brand || "Genérico / Otras"
      };
    });
  }, [products]);

  // Global KPIs
  const totalValuation = useMemo(() => enrichedProducts.reduce((sum, p) => sum + p.totalValue, 0), [enrichedProducts]);
  const totalUnits = useMemo(() => enrichedProducts.reduce((sum, p) => sum + p.stock, 0), [enrichedProducts]);
  const inStockProducts = useMemo(() => enrichedProducts.filter(p => p.stock > 0), [enrichedProducts]);
  const lowStockProducts = useMemo(() => enrichedProducts.filter(p => p.stock > 0 && p.stock <= 3), [enrichedProducts]);
  const outOfStockProducts = useMemo(() => enrichedProducts.filter(p => p.stock === 0), [enrichedProducts]);

  const healthRate = useMemo(() => {
    if (enrichedProducts.length === 0) return 100;
    return Math.round((inStockProducts.length / enrichedProducts.length) * 100);
  }, [enrichedProducts, inStockProducts]);

  // Kardex Stats
  const kardexData = useMemo(() => {
    const kardex = storageService.getKardex() || [];
    let totalEntradasUnits = 0;
    let totalSalidasUnits = 0;
    let totalConteosUnits = 0;
    let entradasCount = 0;
    let salidasCount = 0;
    let conteosCount = 0;

    kardex.forEach(m => {
      const qty = Number(m.quantity) || 0;
      if (m.type === "ENTRADA") {
        totalEntradasUnits += qty;
        entradasCount += 1;
      } else if (m.type === "SALIDA") {
        totalSalidasUnits += qty;
        salidasCount += 1;
      } else if (m.type === "CONTEO") {
        totalConteosUnits += qty;
        conteosCount += 1;
      }
    });

    return {
      recentMovements: kardex.slice(0, 6),
      totalMovements: kardex.length,
      totalEntradasUnits,
      totalSalidasUnits,
      totalConteosUnits,
      entradasCount,
      salidasCount,
      conteosCount,
      netBalance: totalEntradasUnits - totalSalidasUnits
    };
  }, []);

  // Brand Distribution Analytics
  const brandStats = useMemo(() => {
    const map = {};
    enrichedProducts.forEach(p => {
      const b = p.brand || "Otras";
      if (!map[b]) map[b] = { brand: b, units: 0, value: 0, skus: 0 };
      map[b].units += p.stock;
      map[b].value += p.totalValue;
      map[b].skus += 1;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [enrichedProducts]);

  // Top 5 High Value References
  const topValuedProducts = useMemo(() => {
    return [...enrichedProducts].sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
  }, [enrichedProducts]);

  // Critical items needing immediate action
  const criticalAlerts = useMemo(() => {
    return [...outOfStockProducts, ...lowStockProducts].slice(0, 6);
  }, [outOfStockProducts, lowStockProducts]);

  return (
    <div style={{ padding: "1.25rem 1rem", maxWidth: "1440px", margin: "0 auto", boxSizing: "border-box", overflowX: "hidden" }}>
      
      {/* 1. Executive Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.25rem" }}>
            <span className="px-chip" style={{ color: "var(--px-blue)", fontWeight: "800" }}>
              <Activity size={13} /> Centro de Analítica Operativa
            </span>
            <span className="px-chip" style={{ color: "var(--px-green)", fontWeight: "700" }}>
              <span className="px-live-dot"></span> Sincronizado BC Cloud
            </span>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0, letterSpacing: "-0.02em" }}>
            Métricas y Rendimiento de Bodega
          </h1>
          <p style={{ margin: "0.15rem 0 0 0", color: "var(--px-muted)", fontSize: "0.82rem" }}>
            Monitoreo en tiempo real de valorización, rotación, flujo operativo y alertas críticas en Cota
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button 
            className="px-btn px-btn--secondary px-btn--sm"
            onClick={() => setIsReportsOpen(true)}
            style={{ color: "var(--px-blue)", borderColor: "rgba(37,99,235,0.35)" }}
          >
            <FileText size={14} /> Informes (Excel / PDF)
          </button>

          <button 
            className="px-btn px-btn--secondary px-btn--sm"
            onClick={onSelectProduct}
          >
            <Package size={14} /> Ver Catálogo Maestro ({enrichedProducts.length})
          </button>

          <button 
            className="px-btn px-btn--primary px-btn--sm"
            onClick={onGoToZebra}
          >
            <ArrowDownLeft size={15} /> + Entrada (Zebra)
          </button>
        </div>
      </div>

      {/* 2. Top 4 Hero Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "0.85rem", marginBottom: "1.25rem" }}>
        
        {/* Card 1: Valuación Total FIFO */}
        <div className="px-card" style={{ padding: "1.1rem", borderLeft: "4px solid var(--px-blue)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--px-muted)", textTransform: "uppercase" }}>
              Valuación Total FIFO
            </span>
            <span className="px-chip" style={{ fontSize: "0.65rem", color: "var(--px-blue)", padding: "1px 6px" }}>
              Activo
            </span>
          </div>
          <div className="px-mono" style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--px-text-strong)" }}>
            {formatCOP(totalValuation)}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--px-green)", fontWeight: "700", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "4px" }}>
            <TrendingUp size={13} /> {enrichedProducts.length} referencias auditadas
          </div>
        </div>

        {/* Card 2: Unidades Físicas en Bodega */}
        <div className="px-card" style={{ padding: "1.1rem", borderLeft: "4px solid var(--px-green)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--px-muted)", textTransform: "uppercase" }}>
              Unidades en Bodega
            </span>
            <span className="px-live-dot"></span>
          </div>
          <div className="px-mono" style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--px-text-strong)" }}>
            {new Intl.NumberFormat("es-CO").format(totalUnits)} <span style={{ fontSize: "0.82rem", color: "var(--px-muted)", fontWeight: "600" }}>unid.</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginTop: "0.25rem" }}>
            {inStockProducts.length} referencias disponibles para despacho
          </div>
        </div>

        {/* Card 3: Tasa de Disponibilidad / Salud */}
        <div className="px-card" style={{ padding: "1.1rem", borderLeft: "4px solid var(--px-cyan)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--px-muted)", textTransform: "uppercase" }}>
              Salud del Catálogo
            </span>
            <span className="px-chip" style={{ fontSize: "0.65rem", color: "var(--px-cyan)", padding: "1px 6px" }}>
              {healthRate}%
            </span>
          </div>
          <div className="px-mono" style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--px-text-strong)" }}>
            {healthRate}% <span style={{ fontSize: "0.82rem", color: "var(--px-green)", fontWeight: "700" }}>Óptimo</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginTop: "0.25rem" }}>
            {outOfStockProducts.length} agotados • {lowStockProducts.length} en stock bajo
          </div>
        </div>

        {/* Card 4: Flujo Operativo Neto */}
        <div className="px-card" style={{ padding: "1.1rem", borderLeft: "4px solid var(--px-amber)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--px-muted)", textTransform: "uppercase" }}>
              Transacciones Registradas
            </span>
            <span className="px-badge px-badge--success" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
              {kardexData.totalMovements} Trans.
            </span>
          </div>
          <div className="px-mono" style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--px-text-strong)" }}>
            {kardexData.entradasCount + kardexData.salidasCount} <span style={{ fontSize: "0.82rem", color: "var(--px-muted)", fontWeight: "600" }}>operaciones</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--px-blue)", fontWeight: "700", marginTop: "0.25rem" }}>
            +{kardexData.totalEntradasUnits} entradas / -{kardexData.totalSalidasUnits} salidas
          </div>
        </div>

      </div>

      {/* 3. Operational Flow & Brand Distribution (2 Columns) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
        
        {/* Panel A: Rendimiento y Balance de Flujo */}
        <div className="px-card" style={{ padding: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0 }}>
                Balance de Flujo Operativo
              </h3>
              <span style={{ fontSize: "0.72rem", color: "var(--px-muted)" }}>Volumen acumulado por tipo de movimiento</span>
            </div>
            <button 
              className="px-btn px-btn--ghost px-btn--sm"
              onClick={onGoToKardex}
              style={{ fontSize: "0.74rem" }}
            >
              Ver Kardex <ArrowRight size={13} />
            </button>
          </div>

          {/* Progress Bar 1: Entradas */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: "700", marginBottom: "0.3rem" }}>
              <span style={{ color: "var(--px-green)", display: "flex", alignItems: "center", gap: "4px" }}>
                <ArrowDownLeft size={14} /> Recepciones (Entradas)
              </span>
              <span className="px-mono" style={{ color: "var(--px-text-strong)" }}>
                +{new Intl.NumberFormat("es-CO").format(kardexData.totalEntradasUnits)} unid. ({kardexData.entradasCount} reg.)
              </span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "var(--px-surface-sunken)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--px-border)" }}>
              <div style={{ width: `${Math.min(100, Math.max(10, (kardexData.totalEntradasUnits / (kardexData.totalEntradasUnits + kardexData.totalSalidasUnits + 1)) * 100))}%`, height: "100%", background: "var(--px-green)", borderRadius: "4px" }}></div>
            </div>
          </div>

          {/* Progress Bar 2: Despachos */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: "700", marginBottom: "0.3rem" }}>
              <span style={{ color: "var(--px-red)", display: "flex", alignItems: "center", gap: "4px" }}>
                <ArrowUpRight size={14} /> Despachos (Salidas)
              </span>
              <span className="px-mono" style={{ color: "var(--px-text-strong)" }}>
                -{new Intl.NumberFormat("es-CO").format(kardexData.totalSalidasUnits)} unid. ({kardexData.salidasCount} reg.)
              </span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "var(--px-surface-sunken)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--px-border)" }}>
              <div style={{ width: `${Math.min(100, Math.max(10, (kardexData.totalSalidasUnits / (kardexData.totalEntradasUnits + kardexData.totalSalidasUnits + 1)) * 100))}%`, height: "100%", background: "var(--px-red)", borderRadius: "4px" }}></div>
            </div>
          </div>

          {/* Progress Bar 3: Conteos */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: "700", marginBottom: "0.3rem" }}>
              <span style={{ color: "var(--px-amber)", display: "flex", alignItems: "center", gap: "4px" }}>
                <ClipboardList size={14} /> Conteos Físicos de Auditoría
              </span>
              <span className="px-mono" style={{ color: "var(--px-text-strong)" }}>
                {kardexData.totalConteosUnits} unid. ({kardexData.conteosCount} reg.)
              </span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "var(--px-surface-sunken)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--px-border)" }}>
              <div style={{ width: "100%", height: "100%", background: "var(--px-amber)", borderRadius: "4px" }}></div>
            </div>
          </div>

        </div>

        {/* Panel B: Distribución por Marca de Fabricante */}
        <div className="px-card" style={{ padding: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0 }}>
                Participación por Fabricante (Tóner)
              </h3>
              <span style={{ fontSize: "0.72rem", color: "var(--px-muted)" }}>Valuación y proporción de stock por marca</span>
            </div>
            <span className="px-chip" style={{ fontSize: "0.68rem" }}>
              {brandStats.length} Marcas
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "175px", overflowY: "auto", paddingRight: "4px" }}>
            {brandStats.map(b => {
              const pct = totalValuation > 0 ? Math.round((b.value / totalValuation) * 100) : 0;
              return (
                <div key={b.brand}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: "700", color: "var(--px-text-strong)" }}>
                      {b.brand} <span style={{ color: "var(--px-muted)", fontWeight: "500" }}>({b.skus} SKUs • {b.units} unid.)</span>
                    </span>
                    <span className="px-mono" style={{ fontWeight: "800", color: "var(--px-blue)" }}>
                      {formatCOP(b.value)} <span style={{ fontSize: "0.7rem", color: "var(--px-muted)" }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "var(--px-surface-sunken)", borderRadius: "3px", overflow: "hidden", border: "1px solid var(--px-border)" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--px-blue)", borderRadius: "3px" }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 4. Critical Stock Radar & Live Activity Stream (2 Columns) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
        
        {/* Radar de Alertas Críticas */}
        <div className="px-card" style={{ padding: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <AlertTriangle size={16} color="var(--px-amber)" />
              <h3 style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0 }}>
                Radar de Reabastecimiento Crítico
              </h3>
            </div>
            <button 
              className="px-btn px-btn--ghost px-btn--sm"
              onClick={onSelectProduct}
              style={{ fontSize: "0.74rem" }}
            >
              Ver Catálogo <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {criticalAlerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--px-muted)", fontSize: "0.82rem" }}>
                <CheckCircle2 size={24} color="var(--px-green)" style={{ margin: "0 auto 0.4rem auto", display: "block" }} />
                Todos los productos cuentan con niveles óptimos de stock.
              </div>
            ) : (
              criticalAlerts.map(p => {
                const isOut = p.stock === 0;
                return (
                  <div 
                    key={p.sku} 
                    style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      padding: "0.55rem 0.75rem", 
                      background: "var(--px-surface-sunken)", 
                      borderRadius: "var(--px-radius-sm)", 
                      border: "1px solid var(--px-border)" 
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span className="px-mono" style={{ fontSize: "0.78rem", fontWeight: "800", color: "var(--px-blue)" }}>
                          {p.sku}
                        </span>
                        <span className={`px-badge ${isOut ? "px-badge--danger" : "px-badge--warning"}`} style={{ fontSize: "0.65rem", padding: "1px 5px" }}>
                          {isOut ? "AGOTADO" : `${p.stock} UNID.`}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.76rem", fontWeight: "600", color: "var(--px-text-strong)", marginTop: "2px" }}>
                        {p.name}
                      </div>
                    </div>

                    <button 
                      className="px-btn px-btn--primary px-btn--sm"
                      onClick={() => onOperateProduct(p)}
                      style={{ fontSize: "0.72rem", padding: "0.25rem 0.55rem", minHeight: "28px" }}
                      title="Registrar entrada en Zebra"
                    >
                      <ArrowDownLeft size={13} /> Recibir
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Feed de Actividad en Vivo */}
        <div className="px-card" style={{ padding: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <Clock size={16} color="var(--px-blue)" />
              <h3 style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0 }}>
                Registro de Actividad en Tiempo Real
              </h3>
            </div>
            <button 
              className="px-btn px-btn--ghost px-btn--sm"
              onClick={onGoToKardex}
              style={{ fontSize: "0.74rem" }}
            >
              Ver Historial <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {kardexData.recentMovements.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--px-muted)", fontSize: "0.82rem" }}>
                No hay movimientos registrados recientemente.
              </div>
            ) : (
              kardexData.recentMovements.map(m => {
                const isEntrada = m.type === "ENTRADA";
                const isSalida = m.type === "SALIDA";
                return (
                  <div 
                    key={m.id}
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      padding: "0.55rem 0.75rem", 
                      background: "var(--px-surface-sunken)", 
                      borderRadius: "var(--px-radius-sm)", 
                      border: "1px solid var(--px-border)" 
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                      <div style={{ 
                        width: "28px", height: "28px", borderRadius: "6px", 
                        background: isEntrada ? "rgba(16,185,129,0.15)" : isSalida ? "rgba(239,68,68,0.15)" : "rgba(217,119,6,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: isEntrada ? "var(--px-green)" : isSalida ? "var(--px-red)" : "var(--px-amber)"
                      }}>
                        {isEntrada ? <ArrowDownLeft size={15} /> : isSalida ? <ArrowUpRight size={15} /> : <ClipboardList size={15} />}
                      </div>
                      <div>
                        <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--px-text-strong)" }}>
                          {m.type}: <span className="px-mono" style={{ color: "var(--px-blue)" }}>{m.sku}</span> ({m.type === "SALIDA" ? `-${m.quantity}` : `+${m.quantity}`})
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--px-muted)" }}>
                          {m.timestamp} • {m.user || "Terminal Zebra"}
                        </div>
                      </div>
                    </div>

                    <span className="px-badge px-badge--success" style={{ fontSize: "0.65rem", padding: "1px 5px" }}>
                      <CheckCircle2 size={11} /> BC Cloud
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 5. Top 5 Fast Value References (High-Impact SKUs) */}
      <div className="px-card" style={{ padding: "1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
          <div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0 }}>
              Top 5 Referencias de Mayor Impacto en Valorización
            </h3>
            <span style={{ fontSize: "0.72rem", color: "var(--px-muted)" }}>Productos con mayor concentración de capital en bodega</span>
          </div>
          <button 
            className="px-btn px-btn--secondary px-btn--sm"
            onClick={onSelectProduct}
            style={{ fontSize: "0.74rem" }}
          >
            Abrir Catálogo Completo <ArrowRight size={13} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
          {topValuedProducts.map((p, idx) => (
            <div 
              key={p.sku} 
              className="px-interactive-card" 
              onClick={() => onOperateProduct(p)}
              style={{ padding: "0.85rem" }}
              title="Haz clic para inspeccionar o recibir en Zebra"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                <span className="px-chip" style={{ fontSize: "0.65rem", color: idx === 0 ? "#F59E0B" : "var(--px-muted)", borderColor: idx === 0 ? "rgba(245,158,11,0.4)" : undefined, padding: "1px 6px" }}>
                  #{idx + 1} en Valor
                </span>
                <span className="px-mono" style={{ fontSize: "0.78rem", fontWeight: "800", color: "var(--px-green)" }}>
                  {p.stock} {p.uom}
                </span>
              </div>
              <div className="px-mono" style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--px-blue)", marginBottom: "2px" }}>
                {p.sku}
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--px-text-strong)", lineHeight: 1.2, marginBottom: "0.4rem" }}>
                {p.name}
              </div>
              <div style={{ borderTop: "1px solid var(--px-border)", paddingTop: "0.35rem", display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                <span style={{ color: "var(--px-muted)" }}>{p.brand}</span>
                <span className="px-mono" style={{ fontWeight: "800", color: "var(--px-text-strong)" }}>{formatCOP(p.totalValue)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Reports Modal */}
      <ReportsModal 
        products={enrichedProducts}
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
      />

    </div>
  );
}
