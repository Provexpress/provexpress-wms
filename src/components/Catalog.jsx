import React, { useState, useMemo } from "react";
import { 
  Search, Eye, X, ChevronLeft, ChevronRight, 
  Package, Tag, Filter, QrCode, ShieldCheck, 
  CheckCircle2, AlertCircle, ArrowDownLeft, Barcode,
  Printer, Droplet, FileSpreadsheet, Layers
} from "lucide-react";
import { storageService } from "../services/storage";
import { BarcodeGenerator } from "./BarcodeGenerator";

export function Catalog({ products, onSelectProduct, onGoToZebra }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [colorFilter, setColorFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const [selectedItem, setSelectedItem] = useState(null);
  const [serialSearch, setSerialSearch] = useState("");

  const formatCOP = (val) => {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val || 0);
  };

  const getProductCost = (p) => {
    if (p.unitCost && Number(p.unitCost) > 0) return Number(p.unitCost);
    if (p.totalValue && p.stock && Number(p.stock) > 0) return Math.round(Number(p.totalValue) / Number(p.stock));
    if (p.unitPrice && Number(p.unitPrice) > 0) return Math.round(Number(p.unitPrice) * 0.75);
    return 120000;
  };

  // Compute live stock dynamically considering serials / kardex
  const enrichedProducts = useMemo(() => {
    const kardex = storageService.getKardex() || [];
    return products.map(p => {
      const skuMovements = kardex.filter(m => m.sku.toUpperCase() === p.sku.toUpperCase());
      const activeSerials = new Set();
      skuMovements.forEach(m => {
        const list = m.serialList || (m.serialNo && m.serialNo !== "N/A" ? m.serialNo.split(",").map(s => s.trim()) : []);
        list.forEach(sn => {
          if (sn && sn !== "N/A") {
            if (m.type === "ENTRADA" || m.type === "CONTEO") activeSerials.add(sn);
            else if (m.type === "SALIDA") activeSerials.delete(sn);
          }
        });
      });

      let liveStock = Number(p.stock) || 0;
      if (activeSerials.size > 0) {
        liveStock = activeSerials.size;
      }

      const cost = getProductCost(p);

      return {
        ...p,
        brand: p.brand || "Genérico / Otras",
        color: p.color || "Negro",
        yield: p.yield || "Estándar",
        compatibility: p.compatibility || "Equipos Láser Compatibles",
        oemCode: p.oemCode || p.sku.replace("SIM-TON-", ""),
        stock: liveStock,
        unitCost: cost,
        totalValue: Math.round(liveStock * cost)
      };
    });
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set(enrichedProducts.map(p => p.category));
    return ["ALL", ...Array.from(set).sort()];
  }, [enrichedProducts]);

  const brands = useMemo(() => {
    const set = new Set(enrichedProducts.map(p => p.brand));
    return ["ALL", ...Array.from(set).sort()];
  }, [enrichedProducts]);

  const colors = useMemo(() => {
    const set = new Set(enrichedProducts.map(p => p.color));
    return ["ALL", ...Array.from(set).sort()];
  }, [enrichedProducts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return enrichedProducts.filter(p => {
      const qStripped = q.replace(/^0+/, "");
      const bStripped = (p.barcode || "").replace(/^0+/, "");
      const matchSearch = !q || 
        p.sku.toLowerCase().includes(q) || 
        p.name.toLowerCase().includes(q) || 
        p.category.toLowerCase().includes(q) || 
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.compatibility && p.compatibility.toLowerCase().includes(q)) ||
        (p.oemCode && p.oemCode.toLowerCase().includes(q)) ||
        (p.barcode && (p.barcode.includes(q) || bStripped.includes(qStripped))) ||
        (p.barcode12 && p.barcode12.includes(q));
      
      const matchCat = categoryFilter === "ALL" || p.category === categoryFilter;
      const matchBrand = brandFilter === "ALL" || p.brand === brandFilter;
      const matchColor = colorFilter === "ALL" || p.color === colorFilter;
      
      let matchStock = true;
      if (stockFilter === "IN_STOCK") matchStock = p.stock > 0;
      else if (stockFilter === "LOW_STOCK") matchStock = p.stock > 0 && p.stock <= 3;
      else if (stockFilter === "OUT_OF_STOCK") matchStock = p.stock === 0;
      else if (stockFilter === "SERIALIZED") matchStock = p.isSerialized;

      return matchSearch && matchCat && matchBrand && matchStock && matchColor;
    });
  }, [enrichedProducts, search, categoryFilter, brandFilter, stockFilter, colorFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Serial list for inspected product
  const itemSerials = useMemo(() => {
    if (!selectedItem) return [];
    const kardex = storageService.getKardex() || [];
    const skuMovements = kardex.filter(m => m.sku.toUpperCase() === selectedItem.sku.toUpperCase());
    const map = new Map();
    [...skuMovements].reverse().forEach(m => {
      const list = m.serialList || (m.serialNo && m.serialNo !== "N/A" ? m.serialNo.split(",").map(s => s.trim()) : []);
      list.forEach(sn => {
        if (sn && sn !== "N/A") {
          if (m.type === "ENTRADA" || m.type === "CONTEO") {
            map.set(sn, { sn, status: "EN_BODEGA", timestamp: m.timestamp, user: m.user, note: m.note });
          } else if (m.type === "SALIDA") {
            map.set(sn, { sn, status: "DESPACHADO", timestamp: m.timestamp, user: m.user, note: m.note });
          }
        }
      });
    });
    return Array.from(map.values());
  }, [selectedItem]);

  const filteredItemSerials = useMemo(() => {
    if (!serialSearch.trim()) return itemSerials;
    const q = serialSearch.toLowerCase().trim();
    return itemSerials.filter(s => s.sn.toLowerCase().includes(q));
  }, [itemSerials, serialSearch]);

  const getColorBadge = (colorName) => {
    const c = (colorName || "").toLowerCase();
    if (c.includes("cian") || c.includes("cyan")) {
      return <span className="px-chip" style={{ color: "#0284C7", background: "rgba(2,132,199,0.1)", borderColor: "rgba(2,132,199,0.3)", padding: "1px 6px", fontSize: "0.68rem" }}>🔵 Cian</span>;
    }
    if (c.includes("magenta")) {
      return <span className="px-chip" style={{ color: "#D946EF", background: "rgba(217,70,239,0.1)", borderColor: "rgba(217,70,239,0.3)", padding: "1px 6px", fontSize: "0.68rem" }}>🟣 Magenta</span>;
    }
    if (c.includes("amarillo") || c.includes("yellow")) {
      return <span className="px-chip" style={{ color: "#D97706", background: "rgba(217,119,6,0.1)", borderColor: "rgba(217,119,6,0.3)", padding: "1px 6px", fontSize: "0.68rem" }}>🟡 Amarillo</span>;
    }
    return <span className="px-chip" style={{ color: "var(--px-text-strong)", background: "rgba(15,23,42,0.08)", borderColor: "var(--px-border)", padding: "1px 6px", fontSize: "0.68rem" }}>⚫ Negro</span>;
  };

  return (
    <div className="px-section-page" style={{ padding: "1.25rem 1rem", maxWidth: "1440px", margin: "0 auto", boxSizing: "border-box" }}>
      
      {/* 1. Header */}
      <div className="px-card" style={{ marginBottom: "1rem", padding: "1.2rem 1.4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.25rem" }}>
              <span className="px-chip" style={{ color: "var(--px-blue)", fontWeight: "800" }}>
                Catálogo Maestro Oficial
              </span>
              <span className="px-chip" style={{ color: "var(--px-green)", fontWeight: "700" }}>
                125 Referencias Suministros
              </span>
            </div>
            <h1 style={{ fontSize: "1.45rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0, letterSpacing: "-0.02em" }}>
              Catálogo de Suministros y Compatibilidad
            </h1>
            <p style={{ margin: "0.15rem 0 0 0", color: "var(--px-muted)", fontSize: "0.82rem" }}>
              Especificaciones completas de tóner, impresoras compatibles, rendimientos y valuación contable en Cota
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button 
              className="px-btn px-btn--primary px-btn--sm"
              onClick={onGoToZebra}
            >
              <ArrowDownLeft size={15} /> + Nueva Entrada (Zebra)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="px-card" style={{ marginBottom: "1rem", padding: "0.85rem 1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
          
          {/* Search Box */}
          <div style={{ flex: "1 1 240px", position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--px-muted)" }} />
            <input 
              type="text" 
              className="px-input" 
              placeholder="Buscar por SKU, Modelo de Impresora, Código OEM o Marca..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: "2rem", height: "36px", fontSize: "0.82rem" }}
            />
          </div>

          {/* Brand Filter */}
          <div style={{ flex: "1 1 130px" }}>
            <select 
              className="px-select" 
              value={brandFilter}
              onChange={(e) => { setBrandFilter(e.target.value); setCurrentPage(1); }}
              style={{ height: "36px", fontSize: "0.82rem" }}
            >
              <option value="ALL">Todas las Marcas ({brands.length - 1})</option>
              {brands.filter(b => b !== "ALL").map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Color Filter */}
          <div style={{ flex: "1 1 120px" }}>
            <select 
              className="px-select" 
              value={colorFilter}
              onChange={(e) => { setColorFilter(e.target.value); setCurrentPage(1); }}
              style={{ height: "36px", fontSize: "0.82rem" }}
            >
              <option value="ALL">Todos los Colores</option>
              {colors.filter(c => c !== "ALL").map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div style={{ flex: "1 1 130px" }}>
            <select 
              className="px-select" 
              value={stockFilter}
              onChange={(e) => { setStockFilter(e.target.value); setCurrentPage(1); }}
              style={{ height: "36px", fontSize: "0.82rem" }}
            >
              <option value="ALL">Todos los Estados</option>
              <option value="IN_STOCK">En Stock ({enrichedProducts.filter(p => p.stock > 0).length})</option>
              <option value="LOW_STOCK">Stock Bajo (≤ 3)</option>
              <option value="OUT_OF_STOCK">Agotados (0)</option>
            </select>
          </div>

          {(search || categoryFilter !== "ALL" || brandFilter !== "ALL" || colorFilter !== "ALL" || stockFilter !== "ALL") && (
            <button 
              className="px-btn px-btn--ghost px-btn--sm"
              onClick={() => { setSearch(""); setCategoryFilter("ALL"); setBrandFilter("ALL"); setColorFilter("ALL"); setStockFilter("ALL"); setCurrentPage(1); }}
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
            >
              Limpiar
            </button>
          )}

        </div>
      </div>

      {/* 3. Desktop High Contrast Table */}
      <div className="px-desktop-table px-table-wrap">
        <table className="px-table">
          <thead>
            <tr>
              <th style={{ width: "165px", minWidth: "165px" }}>Código SKU</th>
              <th>Descripción y Compatibilidad Técnica</th>
              <th style={{ width: "95px", textAlign: "center" }}>Color</th>
              <th style={{ width: "115px" }}>Marca</th>
              <th style={{ width: "110px" }}>Rendimiento</th>
              <th style={{ textAlign: "right", width: "90px" }}>Existencias</th>
              <th style={{ textAlign: "right", width: "115px" }}>Costo Unit.</th>
              <th style={{ textAlign: "right", width: "125px" }}>Valuación</th>
              <th style={{ textAlign: "center", width: "95px" }}>Estado</th>
              <th style={{ textAlign: "center", width: "55px" }}>Ficha</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--px-muted)" }}>
                  <AlertCircle size={24} style={{ display: "block", margin: "0 auto 0.5rem auto", opacity: 0.5 }} />
                  No se encontraron suministros con los criterios de búsqueda aplicados.
                </td>
              </tr>
            ) : (
              paginated.map((item) => {
                const isLow = item.stock > 0 && item.stock <= 3;
                const isOut = item.stock === 0;

                return (
                  <tr key={item.sku} style={{ cursor: "pointer" }} onClick={() => setSelectedItem(item)}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className="px-mono" style={{ 
                        fontWeight: "800", 
                        color: "var(--px-blue)", 
                        fontSize: "0.82rem",
                        background: "rgba(37, 99, 235, 0.08)",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        border: "1px solid rgba(37, 99, 235, 0.25)",
                        display: "inline-block",
                        whiteSpace: "nowrap"
                      }}>
                        {item.sku}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--px-text-strong)", fontSize: "0.84rem" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span>OEM: <strong style={{ color: "var(--px-blue)" }}>{item.oemCode}</strong></span>
                        <span>•</span>
                        <span>Ubicación: <strong>{item.bin || "COTA-SUM-01"}</strong></span>
                        <span>•</span>
                        <span style={{ color: "var(--px-text)" }}>{item.compatibility}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {getColorBadge(item.color)}
                    </td>
                    <td>
                      <span className="px-chip" style={{ fontSize: "0.72rem", padding: "2px 8px", fontWeight: "700" }}>
                        {item.brand}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.74rem", color: "var(--px-muted)", fontWeight: "600" }}>
                        {item.yield}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="px-mono" style={{ 
                        fontSize: "0.95rem", 
                        fontWeight: "800", 
                        color: isOut ? "var(--px-red)" : isLow ? "var(--px-amber)" : "var(--px-green)" 
                      }}>
                        {item.stock} <span style={{ fontSize: "0.72rem", color: "var(--px-muted)" }}>{item.uom || "PCS"}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontSize: "0.82rem", color: "var(--px-muted)", whiteSpace: "nowrap" }}>
                      {formatCOP(item.unitCost)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "700", fontSize: "0.85rem", color: "var(--px-text-strong)", whiteSpace: "nowrap" }}>
                      {formatCOP(item.totalValue)}
                    </td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      {isOut && <span className="px-badge px-badge--danger">Agotado</span>}
                      {isLow && <span className="px-badge px-badge--warning">Bajo Stock</span>}
                      {!isOut && !isLow && <span className="px-badge px-badge--success">Disponible</span>}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button 
                        className="px-btn px-btn--ghost px-btn--icon"
                        style={{ width: "26px", height: "26px" }}
                        onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                        title="Ver Ficha Técnica y Código de Barras"
                      >
                        <Eye size={14} color="var(--px-blue)" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Mobile Cards */}
      <div className="px-mobile-cards">
        {paginated.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--px-muted)", fontSize: "0.82rem" }}>
            No se encontraron suministros con los filtros aplicados.
          </div>
        ) : (
          paginated.map(item => {
            const isLow = item.stock > 0 && item.stock <= 3;
            const isOut = item.stock === 0;

            return (
              <div key={item.sku} className="px-product-card" onClick={() => setSelectedItem(item)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.3rem" }}>
                  <span className="px-mono" style={{ fontWeight: "800", color: "var(--px-blue)", fontSize: "0.85rem", background: "rgba(37, 99, 235, 0.08)", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(37, 99, 235, 0.2)" }}>
                    {item.sku}
                  </span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {getColorBadge(item.color)}
                    <span className={`px-badge ${isOut ? "px-badge--danger" : isLow ? "px-badge--warning" : "px-badge--success"}`}>
                      {item.stock} {item.uom || "PCS"}
                    </span>
                  </div>
                </div>
                <div style={{ fontWeight: "700", color: "var(--px-text-strong)", fontSize: "0.84rem", marginBottom: "0.25rem", lineHeight: 1.3 }}>
                  {item.name}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginBottom: "0.35rem" }}>
                  Compatibilidad: {item.compatibility}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.74rem", color: "var(--px-muted)", borderTop: "1px solid var(--px-border)", paddingTop: "0.35rem" }}>
                  <span>{item.brand} • {item.yield}</span>
                  <span className="px-mono" style={{ fontWeight: "700", color: "var(--px-text-strong)" }}>
                    {formatCOP(item.totalValue)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Pagination */}
      {totalPages > 1 && (
        <div className="px-pagination" style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "0.76rem", color: "var(--px-muted)" }}>
            Mostrando {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)} a {Math.min(filtered.length, currentPage * pageSize)} de {filtered.length} referencias
          </div>

          <div style={{ display: "flex", gap: "0.35rem" }}>
            <button 
              className="px-page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button 
                key={page}
                className={`px-page-btn ${currentPage === page ? "is-active" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}

            <button 
              className="px-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 6. Product Detail & Barcode Modal */}
      {selectedItem && (() => {
        const liveItem = products.find(p => p.sku === selectedItem.sku) || selectedItem;
        return (
          <div className="px-drawer-overlay" onClick={() => setSelectedItem(null)}>
            <div className="px-drawer-card" style={{ maxWidth: "680px", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.3rem" }}>
                  <span className="px-chip" style={{ color: "var(--px-blue)", fontWeight: "700" }}>
                    Ficha Técnica Oficial
                  </span>
                  {getColorBadge(selectedItem.color)}
                  <span className="px-chip" style={{ color: "var(--px-green)", fontWeight: "700" }}>
                    {selectedItem.brand}
                  </span>
                </div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0, lineHeight: 1.3 }}>
                  {selectedItem.name}
                </h2>
                <div className="px-mono" style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--px-blue)", marginTop: "3px" }}>
                  SKU: {selectedItem.sku} • OEM: {selectedItem.oemCode}
                </div>
              </div>
              <button 
                className="px-btn px-btn--ghost px-btn--icon"
                onClick={() => setSelectedItem(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Barcode Preview - Dual Format (EAN Manufacturer & Internal SKU) */}
            <div style={{ display: "grid", gridTemplateColumns: selectedItem.barcode ? "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" : "1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              {selectedItem.barcode && (
                <div style={{ textAlign: "center", padding: "0.75rem 0.85rem", background: "#FFFFFF", borderRadius: "10px", border: "1px solid #CBD5E1", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", boxSizing: "border-box", overflow: "hidden" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "#2563EB", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.04em" }}>
                    Código de Barras Original EAN / UPC
                  </div>
                  <BarcodeGenerator value={selectedItem.barcode} text={selectedItem.barcode} height={44} />
                </div>
              )}
              <div style={{ textAlign: "center", padding: "0.75rem 0.85rem", background: "#FFFFFF", borderRadius: "10px", border: "1px solid #CBD5E1", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", boxSizing: "border-box", overflow: "hidden" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "#64748B", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.04em" }}>
                  Código SKU Interno Provexpress
                </div>
                <BarcodeGenerator value={selectedItem.sku} text={selectedItem.sku} height={44} />
              </div>
            </div>

            {/* Technical Specifications Grid */}
            <div style={{ background: "var(--px-surface-sunken)", padding: "0.85rem 1rem", borderRadius: "var(--px-radius-md)", border: "1px solid var(--px-border)", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "var(--px-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                Especificaciones del Cartucho
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.6rem", fontSize: "0.78rem" }}>
                <div>
                  <span style={{ color: "var(--px-muted)", display: "block" }}>Impresoras Compatibles:</span>
                  <strong style={{ color: "var(--px-text-strong)" }}>{selectedItem.compatibility}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--px-muted)", display: "block" }}>Rendimiento Estimado:</span>
                  <strong style={{ color: "var(--px-text-strong)" }}>{selectedItem.yield}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--px-muted)", display: "block" }}>Ubicación en Bodega:</span>
                  <strong style={{ color: "var(--px-blue)" }}>{selectedItem.bin || "COTA-SUM-01"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--px-muted)", display: "block" }}>Código Fabricante (OEM):</span>
                  <strong className="px-mono" style={{ color: "var(--px-text-strong)" }}>{selectedItem.oemCode}</strong>
                </div>
              </div>
            </div>

            {/* Valuation & Stock Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.6rem", marginBottom: "1rem" }}>
              <div className="px-card" style={{ padding: "0.75rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--px-muted)", textTransform: "uppercase", fontWeight: "700" }}>Existencias</span>
                <div className="px-mono" style={{ fontSize: "1.15rem", fontWeight: "800", color: liveItem.stock > 0 ? "var(--px-green)" : "var(--px-red)" }}>
                  {liveItem.stock} {liveItem.uom || "PCS"}
                </div>
              </div>
              <div className="px-card" style={{ padding: "0.75rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--px-muted)", textTransform: "uppercase", fontWeight: "700" }}>Costo Unit.</span>
                <div className="px-mono" style={{ fontSize: "1.05rem", fontWeight: "800", color: "var(--px-text-strong)" }}>
                  {formatCOP(liveItem.unitCost)}
                </div>
              </div>
              <div className="px-card" style={{ padding: "0.75rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--px-muted)", textTransform: "uppercase", fontWeight: "700" }}>Valuación FIFO</span>
                <div className="px-mono" style={{ fontSize: "1.05rem", fontWeight: "800", color: "var(--px-text-strong)" }}>
                  {formatCOP(liveItem.totalValue)}
                </div>
              </div>
            </div>

            {/* Serials if present */}
            {selectedItem.isSerialized && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--px-muted)", textTransform: "uppercase" }}>
                    Seriales Registrados ({filteredItemSerials.filter(s => s.status === "EN_BODEGA").length} en bodega)
                  </span>
                  <input 
                    type="text" 
                    placeholder="Filtrar serial..." 
                    value={serialSearch}
                    onChange={(e) => setSerialSearch(e.target.value)}
                    style={{ fontSize: "0.74rem", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--px-border)", background: "var(--px-surface-sunken)" }}
                  />
                </div>
                <div style={{ maxHeight: "110px", overflowY: "auto", border: "1px solid var(--px-border)", borderRadius: "var(--px-radius-sm)", padding: "0.4rem", background: "var(--px-surface-sunken)" }}>
                  {filteredItemSerials.length === 0 ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--px-muted)", textAlign: "center", padding: "0.4rem" }}>
                      No hay seriales registrados para esta referencia.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {filteredItemSerials.map(s => (
                        <span key={s.sn} className="px-mono" style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: "4px", background: s.status === "EN_BODEGA" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: s.status === "EN_BODEGA" ? "var(--px-green)" : "var(--px-red)", border: "1px solid var(--px-border)" }}>
                          {s.sn} ({s.status === "EN_BODEGA" ? "DISPONIBLE" : "DESPACHADO"})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button 
                className="px-btn px-btn--secondary"
                onClick={() => setSelectedItem(null)}
              >
                Cerrar
              </button>
              {onSelectProduct && (
                <button 
                  className="px-btn px-btn--primary"
                  onClick={() => {
                    const item = selectedItem;
                    setSelectedItem(null);
                    onSelectProduct(item);
                  }}
                >
                  <ArrowDownLeft size={15} /> Recibir en Zebra TC22
                </button>
              )}
            </div>

          </div>
        </div>
        );
      })()}

    </div>
  );
}
