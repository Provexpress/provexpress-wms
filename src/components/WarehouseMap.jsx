import React, { useState, useMemo } from "react";
import { 
  Boxes, Search, Eye, Filter, ArrowDownLeft, 
  ArrowUpRight, QrCode, Layers, ShieldCheck, CheckCircle2, 
  AlertTriangle, MapPin, X, Package, Download, Barcode,
  Layers3, HelpCircle, ChevronRight, Sparkles, Building2,
  Maximize2, LayoutGrid, ListFilter
} from "lucide-react";
import { BarcodeGenerator } from "./BarcodeGenerator";

export function WarehouseMap({ products, onSelectProductForZebra, onGoToZebra }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRackFilter, setSelectedRackFilter] = useState("ALL"); // ALL, A, B, C, PISO
  const [activeBinId, setActiveBinId] = useState("COTA-B2"); // Default inspected bin
  const [viewMode, setViewMode] = useState("RACKS"); // 'RACKS' | 'TABLE'
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);

  const formatCOP = (val) => {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val || 0);
  };

  // Exact Bins Definition for Bodega Cota:
  // Estante A: 4 niveles (A1, A2, A3, A4)
  // Estante B: 4 niveles (B1, B2, B3, B4)
  // Estante C: 2 niveles (C1, C2)
  // Zona Tarimas: Piso 3 Contratos (PISO-3)
  const BIN_DEFINITIONS = [
    // RACK A (4 niveles)
    { id: "COTA-A1", rack: "A", rackName: "Estante A", tier: 1, tierName: "Nivel 1 • Superior (Arriba)", capacity: 200, color: "#2563EB" },
    { id: "COTA-A2", rack: "A", rackName: "Estante A", tier: 2, tierName: "Nivel 2 • Medio Superior", capacity: 150, color: "#2563EB" },
    { id: "COTA-A3", rack: "A", rackName: "Estante A", tier: 3, tierName: "Nivel 3 • Medio Inferior", capacity: 150, color: "#2563EB" },
    { id: "COTA-A4", rack: "A", rackName: "Estante A", tier: 4, tierName: "Nivel 4 • Base / Piso", capacity: 100, color: "#2563EB" },
    
    // RACK B (4 niveles)
    { id: "COTA-B1", rack: "B", rackName: "Estante B", tier: 1, tierName: "Nivel 1 • Superior (Arriba)", capacity: 150, color: "#10B981" },
    { id: "COTA-B2", rack: "B", rackName: "Estante B", tier: 2, tierName: "Nivel 2 • Medio Superior", capacity: 200, color: "#10B981" },
    { id: "COTA-B3", rack: "B", rackName: "Estante B", tier: 3, tierName: "Nivel 3 • Medio Inferior", capacity: 150, color: "#10B981" },
    { id: "COTA-B4", rack: "B", rackName: "Estante B", tier: 4, tierName: "Nivel 4 • Base / Piso", capacity: 100, color: "#10B981" },
    
    // RACK C (2 niveles)
    { id: "COTA-C1", rack: "C", rackName: "Estante C", tier: 1, tierName: "Nivel 1 • Superior (Arriba)", capacity: 150, color: "#7C3AED" },
    { id: "COTA-C2", rack: "C", rackName: "Estante C", tier: 2, tierName: "Nivel 2 • Base / Inferior", capacity: 150, color: "#7C3AED" },
    
    // ZONA PISO 3
    { id: "COTA-PISO-3", rack: "PISO", rackName: "Zona Tarimas", tier: 1, tierName: "Piso 3 • Contratos", capacity: 150, color: "#D97706" }
  ];

  // Group products by bin
  const binDataMap = useMemo(() => {
    const map = {};
    BIN_DEFINITIONS.forEach(b => {
      map[b.id] = {
        ...b,
        products: [],
        totalUnits: 0,
        totalValuation: 0,
        skuCount: 0
      };
    });

    products.forEach(p => {
      const s = Number(p.stock) || 0;
      if (s <= 0 || !p.barcode) return; // Solo productos con existencia física y barcode real
      const bId = p.bin || "COTA-B2";
      if (!map[bId]) {
        map[bId] = {
          id: bId,
          rack: bId.includes("A") ? "A" : bId.includes("B") ? "B" : bId.includes("C") ? "C" : "PISO",
          rackName: bId.includes("A") ? "Estante A" : bId.includes("B") ? "Estante B" : bId.includes("C") ? "Estante C" : "Zona Tarimas",
          tier: 1,
          tierName: bId,
          capacity: 150,
          color: "#2563EB",
          products: [],
          totalUnits: 0,
          totalValuation: 0,
          skuCount: 0
        };
      }
      map[bId].products.push(p);
      map[bId].totalUnits += Number(p.stock) || 0;
      map[bId].totalValuation += (Number(p.stock) || 0) * (Number(p.unitCost) || 120000);
      map[bId].skuCount += 1;
    });

    return map;
  }, [products]);

  // Search matches
  const searchMatchedBins = useMemo(() => {
    if (!searchQuery.trim()) return new Set();
    const q = searchQuery.toLowerCase().trim();
    const qStripped = q.replace(/^0+/, "");
    const matched = new Set();

    products.forEach(p => {
      const s = Number(p.stock) || 0;
      if (s <= 0 || !p.barcode) return; // Solo buscar productos con existencia física y barcode
      const bStripped = (p.barcode || "").replace(/^0+/, "");
      const match = 
        p.sku.toLowerCase().includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.oemCode && p.oemCode.toLowerCase().includes(q)) ||
        (p.compatibility && p.compatibility.toLowerCase().includes(q)) ||
        (p.bin && p.bin.toLowerCase().includes(q)) ||
        (p.barcode && (p.barcode.includes(q) || bStripped.includes(qStripped))) ||
        (p.barcode12 && p.barcode12.includes(q));

      if (match && p.bin) {
        matched.add(p.bin);
      }
    });

    return matched;
  }, [products, searchQuery]);

  // If search matches bins, auto-select the first matched bin
  React.useEffect(() => {
    if (searchMatchedBins.size > 0) {
      const first = Array.from(searchMatchedBins)[0];
      if (first && first !== activeBinId) {
        setActiveBinId(first);
      }
    }
  }, [searchMatchedBins]);

  // Global totals
  const globalTotalUnits = useMemo(() => products.reduce((sum, p) => (p.barcode && Number(p.stock) > 0) ? sum + Number(p.stock) : sum, 0), [products]);
  const globalTotalVal = useMemo(() => products.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.unitCost) || 120000)), 0), [products]);

  // Physical Racks Layout
  const racks = [
    { key: "A", name: "Estante A", levelsLabel: "4 Niveles (A1 a A4)", subtitle: "Alta Rotación & Mayor Demanda", color: "var(--px-blue)", borderColor: "#2563EB", bins: ["COTA-A1", "COTA-A2", "COTA-A3", "COTA-A4"] },
    { key: "B", name: "Estante B", levelsLabel: "4 Niveles (B1 a B4)", subtitle: "Stock Intermedio & Variedad", color: "var(--px-green)", borderColor: "#10B981", bins: ["COTA-B1", "COTA-B2", "COTA-B3", "COTA-B4"] },
    { key: "C", name: "Estante C", levelsLabel: "2 Niveles (C1 y C2)", subtitle: "Formatos Especiales & Color", color: "var(--px-purple)", borderColor: "#7C3AED", bins: ["COTA-C1", "COTA-C2"] },
    { key: "PISO", name: "Zona Tarimas", levelsLabel: "Piso 3 Contratos", subtitle: "Lotes Contractuales HP / Kyocera", color: "#D97706", borderColor: "#D97706", bins: ["COTA-PISO-3"] }
  ];

  const visibleRacks = selectedRackFilter === "ALL" ? racks : racks.filter(r => r.key === selectedRackFilter);
  const currentActiveBin = binDataMap[activeBinId] || binDataMap["COTA-B2"] || {};

  // Filter products in current active bin if user is searching
  const filteredActiveProducts = useMemo(() => {
    if (!currentActiveBin?.products) return [];
    if (!searchQuery.trim()) return currentActiveBin.products;
    const q = searchQuery.toLowerCase().trim();
    const qStripped = q.replace(/^0+/, "");

    return currentActiveBin.products.filter(p => {
      const bStripped = (p.barcode || "").replace(/^0+/, "");
      return (
        p.sku.toLowerCase().includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.oemCode && p.oemCode.toLowerCase().includes(q)) ||
        (p.compatibility && p.compatibility.toLowerCase().includes(q)) ||
        (p.barcode && (p.barcode.includes(q) || bStripped.includes(qStripped)))
      );
    });
  }, [currentActiveBin, searchQuery]);

  return (
    <div className="px-section-page" style={{ padding: "1.25rem 1rem", maxWidth: "1500px", margin: "0 auto", boxSizing: "border-box" }}>
      
      {/* 1. Page Header with Clean Title & Actions */}
      <div className="px-card" style={{ marginBottom: "1rem", padding: "1rem 1.4rem", background: "var(--px-surface)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
              <span className="px-chip" style={{ color: "var(--px-blue)", fontWeight: "800", background: "rgba(37, 99, 235, 0.08)" }}>
                <MapPin size={13} /> Bodega Cota Principal
              </span>
              <span className="px-chip" style={{ color: "var(--px-green)", fontWeight: "700", background: "rgba(16, 185, 129, 0.08)" }}>
                3 Racks (10 Niveles) + 1 Zona Tarimas
              </span>
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0, letterSpacing: "-0.02em" }}>
              Mapa Físico de Estanterías y Ubicaciones
            </h1>
            <p style={{ margin: "0.15rem 0 0 0", color: "var(--px-muted)", fontSize: "0.82rem" }}>
              Haz clic en cualquier nivel de los estantes para inspeccionar sus referencias, stocks y códigos de barras en tiempo real
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ display: "flex", background: "var(--px-surface-sunken)", padding: "3px", borderRadius: "8px", border: "1px solid var(--px-border)" }}>
              <button 
                className={`px-btn px-btn--sm ${viewMode === "RACKS" ? "px-btn--primary" : "px-btn--ghost"}`}
                onClick={() => setViewMode("RACKS")}
                style={{ padding: "4px 10px", fontSize: "0.75rem", height: "30px" }}
              >
                <LayoutGrid size={13} /> Vista Estantería
              </button>
              <button 
                className={`px-btn px-btn--sm ${viewMode === "TABLE" ? "px-btn--primary" : "px-btn--ghost"}`}
                onClick={() => setViewMode("TABLE")}
                style={{ padding: "4px 10px", fontSize: "0.75rem", height: "30px" }}
              >
                <ListFilter size={13} /> Vista Lista
              </button>
            </div>

            <button 
              className="px-btn px-btn--primary px-btn--sm"
              onClick={onGoToZebra}
              style={{ height: "36px" }}
            >
              <ArrowDownLeft size={15} /> + Entrada (Zebra)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (Clean, High-Readability Numbers) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        
        <div className="px-card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid var(--px-blue)" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--px-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Físico Contado</span>
          <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--px-text-strong)", marginTop: "2px", fontFamily: "var(--px-font-ui)" }}>
            {new Intl.NumberFormat("es-CO").format(globalTotalUnits)} <span style={{ fontSize: "0.78rem", color: "var(--px-muted)", fontWeight: "600" }}>unidades</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--px-green)", fontWeight: "700", marginTop: "2px" }}>
            125 referencias clasificadas
          </div>
        </div>

        <div className="px-card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid var(--px-green)" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--px-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Valuación de Almacén</span>
          <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--px-text-strong)", marginTop: "2px", fontFamily: "var(--px-font-ui)" }}>
            {formatCOP(globalTotalVal)}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--px-muted)", marginTop: "2px" }}>
            Costo FIFO: $120.000 COP / unid
          </div>
        </div>

        <div className="px-card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid var(--px-purple)" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--px-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Distribución de Racks</span>
          <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--px-text-strong)", marginTop: "2px", fontFamily: "var(--px-font-ui)" }}>
            11 Ubicaciones <span style={{ fontSize: "0.78rem", color: "var(--px-muted)", fontWeight: "600" }}>físicas</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--px-blue)", fontWeight: "700", marginTop: "2px" }}>
            Estante A (4) • Estante B (4) • Estante C (2) • Piso
          </div>
        </div>

        <div className="px-card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #D97706" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "var(--px-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Espacio Seleccionado</span>
          <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "#D97706", marginTop: "2px", fontFamily: "var(--px-font-ui)" }}>
            {activeBinId} <span style={{ fontSize: "0.78rem", color: "var(--px-muted)", fontWeight: "600" }}>({currentActiveBin.totalUnits || 0} u)</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--px-muted)", marginTop: "2px" }}>
            {currentActiveBin.rackName} • {currentActiveBin.tierName}
          </div>
        </div>

      </div>

      {/* 3. Search & Interactive Finder Toolbar */}
      <div className="px-card" style={{ marginBottom: "1rem", padding: "0.75rem 1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
          
          {/* Search Box */}
          <div style={{ flex: "1 1 320px", position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--px-muted)" }} />
            <input 
              type="text" 
              className="px-input" 
              placeholder="🔍 Buscar SKU, Barcode, Modelo o Ubicación (ej: 13803244427, CF258A, TK-1175, COTA-A4)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "2.1rem", height: "36px", fontSize: "0.82rem" }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            <button 
              className={`px-chip ${selectedRackFilter === "ALL" ? "px-chip--active" : ""}`}
              onClick={() => setSelectedRackFilter("ALL")}
              style={{ cursor: "pointer", height: "36px", padding: "0 12px", fontWeight: "700" }}
            >
              Todos los Racks
            </button>
            <button 
              className={`px-chip ${selectedRackFilter === "A" ? "px-chip--active" : ""}`}
              onClick={() => setSelectedRackFilter("A")}
              style={{ cursor: "pointer", height: "36px", padding: "0 12px", color: "var(--px-blue)", fontWeight: "700" }}
            >
              Estante A (4 niveles • 299 u)
            </button>
            <button 
              className={`px-chip ${selectedRackFilter === "B" ? "px-chip--active" : ""}`}
              onClick={() => setSelectedRackFilter("B")}
              style={{ cursor: "pointer", height: "36px", padding: "0 12px", color: "var(--px-green)", fontWeight: "700" }}
            >
              Estante B (4 niveles • 238 u)
            </button>
            <button 
              className={`px-chip ${selectedRackFilter === "C" ? "px-chip--active" : ""}`}
              onClick={() => setSelectedRackFilter("C")}
              style={{ cursor: "pointer", height: "36px", padding: "0 12px", color: "var(--px-purple)", fontWeight: "700" }}
            >
              Estante C (2 niveles • 145 u)
            </button>
            <button 
              className={`px-chip ${selectedRackFilter === "PISO" ? "px-chip--active" : ""}`}
              onClick={() => setSelectedRackFilter("PISO")}
              style={{ cursor: "pointer", height: "36px", padding: "0 12px", color: "#D97706", fontWeight: "700" }}
            >
              Piso 3 (73 u)
            </button>
          </div>

          {searchQuery && (
            <button 
              className="px-btn px-btn--ghost px-btn--sm"
              onClick={() => setSearchQuery("")}
              style={{ fontSize: "0.75rem", height: "36px" }}
            >
              Limpiar Búsqueda
            </button>
          )}

        </div>

        {searchQuery && searchMatchedBins.size > 0 && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--px-blue)", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="px-live-dot"></span> Ubicaciones coincidentes: {Array.from(searchMatchedBins).join(", ")} (resaltadas con halo luminoso)
          </div>
        )}
      </div>

      {/* 4. MAIN INTERACTIVE LAYOUT: RACKS ELEVATION (LEFT/TOP) + LIVE SHELF INSPECTOR (RIGHT/BOTTOM) */}
      {viewMode === "RACKS" ? (
        <div style={{ display: "grid", gridTemplateColumns: selectedRackFilter === "ALL" ? "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" : "1fr", gap: "1rem", marginBottom: "1.25rem" }}>
          
          {visibleRacks.map(rack => {
            const rackTotalUnits = rack.bins.reduce((sum, bId) => sum + (binDataMap[bId]?.totalUnits || 0), 0);
            const rackTotalVal = rack.bins.reduce((sum, bId) => sum + (binDataMap[bId]?.totalValuation || 0), 0);
            const rackSkuCount = rack.bins.reduce((sum, bId) => sum + (binDataMap[bId]?.skuCount || 0), 0);

            return (
              <div 
                key={rack.key} 
                className="px-card" 
                style={{ 
                  padding: "0.9rem", 
                  borderTop: `4px solid ${rack.borderColor}`,
                  background: "var(--px-surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                }}
              >
                
                {/* Rack Frame Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--px-border)", paddingBottom: "0.5rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: rack.borderColor, display: "inline-block" }}></span>
                      <h2 style={{ fontSize: "1.05rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0 }}>
                        {rack.name}
                      </h2>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--px-muted)", marginTop: "1px" }}>
                      {rack.levelsLabel}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1rem", fontWeight: "800", color: "var(--px-text-strong)", fontFamily: "var(--px-font-ui)" }}>
                      {rackTotalUnits} <span style={{ fontSize: "0.7rem", color: "var(--px-muted)" }}>unid.</span>
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--px-muted)" }}>
                      {rackSkuCount} SKUs
                    </div>
                  </div>
                </div>

                {/* Physical Shelf Levels */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {rack.bins.map((binId, tierIdx) => {
                    const binInfo = binDataMap[binId] || {};
                    const isSelected = activeBinId === binId;
                    const isMatch = searchMatchedBins.has(binId);
                    const occupancyPct = Math.min(100, Math.round((binInfo.totalUnits / (binInfo.capacity || 150)) * 100));

                    // Short title for tier
                    const shortTierName = binId.replace("COTA-", "");

                    return (
                      <div 
                        key={binId}
                        onClick={() => setActiveBinId(binId)}
                        style={{ 
                          padding: "0.7rem 0.85rem",
                          borderRadius: "8px",
                          border: isSelected 
                            ? `2px solid ${rack.borderColor}` 
                            : isMatch 
                            ? "2px solid var(--px-blue)" 
                            : "1px solid var(--px-border)",
                          background: isSelected 
                            ? "var(--px-surface-raised)" 
                            : isMatch 
                            ? "rgba(37, 99, 235, 0.06)" 
                            : "var(--px-surface-sunken)",
                          boxShadow: isSelected 
                            ? `0 4px 12px ${rack.borderColor}25` 
                            : isMatch 
                            ? "0 0 12px rgba(37, 99, 235, 0.3)" 
                            : "none",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          position: "relative"
                        }}
                      >
                        
                        {/* Shelf Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ 
                              fontSize: "0.82rem", 
                              fontWeight: "800", 
                              color: isSelected ? "#FFFFFF" : rack.borderColor, 
                              background: isSelected ? rack.borderColor : `${rack.borderColor}18`,
                              padding: "2px 7px", 
                              borderRadius: "4px",
                              fontFamily: "var(--px-font-ui)"
                            }}>
                              {binId}
                            </span>
                            <span style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--px-text-strong)" }}>
                              {binInfo.tierName ? binInfo.tierName.split("•")[1] || binInfo.tierName : binId}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <span style={{ fontSize: "0.92rem", fontWeight: "800", color: "var(--px-text-strong)", fontFamily: "var(--px-font-ui)" }}>
                              {binInfo.totalUnits} <span style={{ fontSize: "0.7rem", color: "var(--px-muted)", fontWeight: "600" }}>u</span>
                            </span>
                            <ChevronRight size={14} style={{ color: isSelected ? rack.borderColor : "var(--px-muted)", opacity: isSelected ? 1 : 0.4 }} />
                          </div>
                        </div>

                        {/* Occupancy Progress Bar */}
                        <div style={{ width: "100%", height: "5px", background: "rgba(0,0,0,0.06)", borderRadius: "3px", overflow: "hidden", marginBottom: "0.35rem" }}>
                          <div style={{ 
                            width: `${occupancyPct}%`, 
                            height: "100%", 
                            background: rack.borderColor, 
                            borderRadius: "3px" 
                          }}></div>
                        </div>

                        {/* Meta info & sample chips */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--px-muted)" }}>
                          <span>
                            <strong>{binInfo.skuCount}</strong> SKUs almacenados
                          </span>
                          <span style={{ fontWeight: "700", color: "var(--px-text-strong)" }}>
                            {formatCOP(binInfo.totalValuation)}
                          </span>
                        </div>

                        {/* Live pulsating dot if search match */}
                        {isMatch && (
                          <div style={{ position: "absolute", top: "6px", right: "6px" }}>
                            <span className="px-live-dot" style={{ width: "7px", height: "7px" }}></span>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}

        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="px-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
          <div className="px-table-wrap">
            <table className="px-table">
              <thead>
                <tr>
                  <th>Código de Ubicación</th>
                  <th>Estante Físico</th>
                  <th>Nivel / Altura</th>
                  <th style={{ textAlign: "right" }}>Referencias (SKUs)</th>
                  <th style={{ textAlign: "right" }}>Unidades Físicas</th>
                  <th style={{ textAlign: "right" }}>Valuación Almacenada</th>
                  <th style={{ textAlign: "center" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {BIN_DEFINITIONS.map(b => {
                  const data = binDataMap[b.id] || {};
                  return (
                    <tr 
                      key={b.id} 
                      onClick={() => { setActiveBinId(b.id); setViewMode("RACKS"); }}
                      style={{ cursor: "pointer", background: activeBinId === b.id ? "rgba(37,99,235,0.06)" : undefined }}
                    >
                      <td>
                        <span style={{ fontWeight: "800", color: "var(--px-blue)", padding: "2px 8px", background: "rgba(37,99,235,0.1)", borderRadius: "4px" }}>
                          {b.id}
                        </span>
                      </td>
                      <td><strong>{b.rackName}</strong></td>
                      <td>{b.tierName}</td>
                      <td style={{ textAlign: "right" }}><strong>{data.skuCount || 0}</strong></td>
                      <td style={{ textAlign: "right", fontWeight: "800", color: "var(--px-green)" }}>{data.totalUnits || 0} u</td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>{formatCOP(data.totalValuation || 0)}</td>
                      <td style={{ textAlign: "center" }}>
                        <button className="px-btn px-btn--ghost px-btn--sm" style={{ padding: "3px 8px", fontSize: "0.72rem" }}>
                          Ver Productos →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. DEDICATED LIVE SHELF INSPECTOR (Rich Product List of Active Bin) */}
      <div className="px-card" style={{ padding: "1.2rem", background: "var(--px-surface)", borderTop: "4px solid var(--px-blue)" }}>
        
        {/* Inspector Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem", borderBottom: "1px solid var(--px-border)", paddingBottom: "0.85rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.25rem" }}>
              <span style={{ fontSize: "1.05rem", fontWeight: "800", color: "#FFFFFF", background: "var(--px-blue)", padding: "3px 10px", borderRadius: "5px" }}>
                {activeBinId}
              </span>
              <span className="px-chip" style={{ color: "var(--px-green)", fontWeight: "700" }}>
                {currentActiveBin.rackName} • {currentActiveBin.tierName}
              </span>
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0 }}>
              Contenido de la Ubicación {activeBinId}
            </h2>
            <p style={{ margin: "0.15rem 0 0 0", color: "var(--px-muted)", fontSize: "0.8rem" }}>
              {currentActiveBin.skuCount || 0} referencias de tóner almacenadas • {currentActiveBin.totalUnits || 0} unidades físicas • Valuación: {formatCOP(currentActiveBin.totalValuation || 0)}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button 
              className="px-btn px-btn--primary px-btn--sm"
              onClick={onGoToZebra}
            >
              <ArrowDownLeft size={14} /> + Recibir Lote en esta Ubicación
            </button>
          </div>
        </div>

        {/* Shelf Products Table */}
        <div className="px-table-wrap" style={{ maxHeight: "420px", overflowY: "auto" }}>
          <table className="px-table">
            <thead>
              <tr>
                <th style={{ width: "160px" }}>Código SKU / Barcode</th>
                <th>Descripción del Producto / Modelo</th>
                <th style={{ width: "110px" }}>Marca</th>
                <th style={{ width: "90px", textAlign: "right" }}>Stock Real</th>
                <th style={{ width: "120px", textAlign: "right" }}>Valuación</th>
                <th style={{ width: "100px", textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredActiveProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--px-muted)" }}>
                    No hay productos en esta ubicación con el filtro actual.
                  </td>
                </tr>
              ) : (
                filteredActiveProducts.map(p => (
                  <tr key={p.sku}>
                    <td>
                      <div 
                        style={{ fontWeight: "800", color: "var(--px-blue)", fontSize: "0.82rem", cursor: "pointer" }}
                        onClick={() => setSelectedItemForModal(p)}
                        title="Haz clic para ver código de barras y ficha técnica"
                      >
                        {p.sku}
                      </div>
                      {p.barcode && (
                        <div style={{ fontSize: "0.7rem", color: "var(--px-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Barcode size={12} /> {p.barcode}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: "700", fontSize: "0.84rem", color: "var(--px-text-strong)" }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginTop: "2px" }}>
                        {p.compatibility || p.description}
                      </div>
                    </td>
                    <td>
                      <span className="px-chip" style={{ fontSize: "0.72rem", padding: "1px 8px" }}>
                        {p.brand}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span style={{ 
                        fontWeight: "800", 
                        fontSize: "0.95rem", 
                        color: p.stock > 0 ? "var(--px-green)" : "var(--px-red)",
                        fontFamily: "var(--px-font-ui)"
                      }}>
                        {p.stock} <span style={{ fontSize: "0.72rem", color: "var(--px-muted)" }}>{p.uom || "unid"}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontSize: "0.84rem", fontWeight: "700", fontFamily: "var(--px-font-ui)" }}>
                      {formatCOP(p.totalValue)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: "0.3rem" }}>
                        <button 
                          className="px-btn px-btn--ghost px-btn--sm"
                          style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                          onClick={() => setSelectedItemForModal(p)}
                          title="Ver Código de Barras y Ficha"
                        >
                          <Eye size={13} />
                        </button>
                        <button 
                          className="px-btn px-btn--primary px-btn--sm"
                          style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                          onClick={() => {
                            if (onSelectProductForZebra) onSelectProductForZebra(p);
                          }}
                          title="Recibir en Zebra"
                        >
                          <ArrowDownLeft size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* 6. Product Technical Sheet & Dual Barcode Modal */}
      {selectedItemForModal && (
        <div className="px-drawer-overlay" onClick={() => setSelectedItemForModal(null)}>
          <div className="px-drawer-card" style={{ maxWidth: "700px", width: "95vw", boxSizing: "border-box", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.25rem" }}>
                  <span className="px-chip" style={{ color: "var(--px-blue)", fontWeight: "800" }}>
                    Ficha Técnica
                  </span>
                  <span className="px-chip" style={{ color: "var(--px-green)", fontWeight: "700" }}>
                    {selectedItemForModal.brand}
                  </span>
                </div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0 }}>
                  {selectedItemForModal.name}
                </h2>
                <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "var(--px-blue)", marginTop: "3px" }}>
                  SKU: {selectedItemForModal.sku} • Ubicación: {selectedItemForModal.bin || "COTA-B2"}
                </div>
              </div>

              <button className="px-btn px-btn--ghost px-btn--icon" onClick={() => setSelectedItemForModal(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Dual Barcode Display - Clean Contained Cards */}
            <div style={{ display: "grid", gridTemplateColumns: selectedItemForModal.barcode ? "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" : "1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              {selectedItemForModal.barcode && (
                <div style={{ textAlign: "center", padding: "0.75rem 0.85rem", background: "#FFFFFF", borderRadius: "10px", border: "1px solid #CBD5E1", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", boxSizing: "border-box", overflow: "hidden" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "#2563EB", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.04em" }}>
                    Código de Barras EAN / UPC
                  </div>
                  <BarcodeGenerator value={selectedItemForModal.barcode} text={selectedItemForModal.barcode} height={44} />
                </div>
              )}
              <div style={{ textAlign: "center", padding: "0.75rem 0.85rem", background: "#FFFFFF", borderRadius: "10px", border: "1px solid #CBD5E1", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", boxSizing: "border-box", overflow: "hidden" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "#64748B", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.04em" }}>
                  Código SKU Provexpress
                </div>
                <BarcodeGenerator value={selectedItemForModal.sku} text={selectedItemForModal.sku} height={44} />
              </div>
            </div>

            {/* Specifications */}
            <div style={{ background: "var(--px-surface-sunken)", padding: "0.85rem 1rem", borderRadius: "8px", border: "1px solid var(--px-border)", marginBottom: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.6rem", fontSize: "0.78rem" }}>
                <div>
                  <span style={{ color: "var(--px-muted)", display: "block" }}>Impresoras Compatibles:</span>
                  <strong style={{ color: "var(--px-text-strong)" }}>{selectedItemForModal.compatibility || "Múltiples series"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--px-muted)", display: "block" }}>Rendimiento Estimado:</span>
                  <strong style={{ color: "var(--px-text-strong)" }}>{selectedItemForModal.yield || "N/A"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--px-muted)", display: "block" }}>Existencias en Ubicación:</span>
                  <strong style={{ color: "var(--px-green)" }}>{selectedItemForModal.stock} Unidades</strong>
                </div>
                <div>
                  <span style={{ color: "var(--px-muted)", display: "block" }}>Valuación FIFO:</span>
                  <strong style={{ color: "var(--px-text-strong)" }}>{formatCOP(selectedItemForModal.totalValue)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button className="px-btn px-btn--secondary" onClick={() => setSelectedItemForModal(null)}>
                Cerrar
              </button>
              <button 
                className="px-btn px-btn--primary"
                onClick={() => {
                  const itm = selectedItemForModal;
                  setSelectedItemForModal(null);
                  if (onSelectProductForZebra) onSelectProductForZebra(itm);
                }}
              >
                <ArrowDownLeft size={15} /> Recibir en Zebra TC22
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
