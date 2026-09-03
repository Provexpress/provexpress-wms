import React, { useState, useMemo } from "react";
import { 
  Download, Search, ArrowDownLeft, ArrowUpRight, 
  ClipboardList, Filter, ShieldCheck, CheckCircle2, 
  ChevronLeft, ChevronRight, Clock, AlertCircle, FileSpreadsheet, FileText
} from "lucide-react";
import { reportService } from "../services/reportService";

export function Kardex({ movements }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [successMessage, setSuccessMessage] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return movements.filter(m => {
      const matchSearch = !q || 
        (m.sku && m.sku.toLowerCase().includes(q)) || 
        (m.productName && m.productName.toLowerCase().includes(q)) || 
        (m.serialNo && m.serialNo.toLowerCase().includes(q)) || 
        (m.note && m.note.toLowerCase().includes(q)) || 
        (m.user && m.user.toLowerCase().includes(q)) ||
        (m.id && m.id.toString().includes(q));
      const matchType = typeFilter === "ALL" || m.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [movements, search, typeFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportExcel = () => {
    if (movements.length === 0) {
      alert("No hay movimientos registrados para exportar.");
      return;
    }
    reportService.exportKardexToExcel(movements, typeFilter);
    setSuccessMessage("¡Libro de Kardex en Excel (.xlsx) descargado exitosamente!");
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const handleExportPdf = () => {
    if (movements.length === 0) {
      alert("No hay movimientos registrados para exportar.");
      return;
    }
    reportService.exportKardexToPdf(movements, typeFilter);
    setSuccessMessage("¡Informe Oficial de Kardex en PDF descargado exitosamente!");
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  return (
    <div className="px-section-page" style={{ padding: "1.25rem 1rem", maxWidth: "1440px", margin: "0 auto", boxSizing: "border-box" }}>
      
      {/* 1. Header Card */}
      <div className="px-card" style={{ marginBottom: "1rem", padding: "1.25rem 1.4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.3rem" }}>
              <span className="px-chip" style={{ color: "var(--px-green)", borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.06)", fontWeight: "800" }}>
                <span className="px-live-dot"></span> Auditoría Continua en Vivo
              </span>
              <span className="px-chip" style={{ color: "var(--px-blue)", borderColor: "rgba(37,99,235,0.3)", background: "rgba(37,99,235,0.06)", fontWeight: "700" }}>
                {movements.length} Registros Totales
              </span>
            </div>
            <h1 style={{ fontSize: "1.45rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0, letterSpacing: "-0.02em" }}>
              Kardex de Auditoría y Trazabilidad
            </h1>
            <p style={{ margin: "0.2rem 0 0 0", color: "var(--px-muted)", fontSize: "0.82rem" }}>
              Historial cronológico inmutable generado automáticamente por cada escaneo y despacho
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button 
              type="button"
              className="px-btn px-btn--secondary px-btn--sm" 
              onClick={handleExportExcel}
              style={{ color: "var(--px-green)", borderColor: "rgba(16,185,129,0.4)" }}
            >
              <FileSpreadsheet size={15} /> Exportar Excel (.xlsx)
            </button>
            <button 
              type="button"
              className="px-btn px-btn--secondary px-btn--sm" 
              onClick={handleExportPdf}
              style={{ color: "var(--px-blue)", borderColor: "rgba(37,99,235,0.4)" }}
            >
              <FileText size={15} /> Exportar PDF (.pdf)
            </button>
          </div>
        </div>

        {successMessage && (
          <div className="px-badge px-badge--success" style={{ width: "100%", justifyContent: "center", padding: "0.5rem", fontSize: "0.8rem", marginTop: "0.85rem" }}>
            <CheckCircle2 size={15} /> {successMessage}
          </div>
        )}
      </div>

      {/* 2. Search and Filter Bar */}
      <div className="px-card" style={{ marginBottom: "1rem", padding: "0.85rem 1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
          
          {/* Search Box */}
          <div style={{ flex: "1 1 240px", position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--px-muted)" }} />
            <input 
              type="text" 
              className="px-input" 
              placeholder="Buscar por SKU, producto, serial o ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: "2rem", height: "36px", fontSize: "0.82rem" }}
            />
          </div>

          {/* Type Filter Pills */}
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            <button
              className={`px-chip ${typeFilter === "ALL" ? "px-chip--active" : ""}`}
              onClick={() => { setTypeFilter("ALL"); setCurrentPage(1); }}
              style={{ cursor: "pointer", height: "36px", padding: "0 12px" }}
            >
              Todos ({movements.length})
            </button>
            <button
              className={`px-chip ${typeFilter === "ENTRADA" ? "px-chip--active" : ""}`}
              onClick={() => { setTypeFilter("ENTRADA"); setCurrentPage(1); }}
              style={{ cursor: "pointer", height: "36px", padding: "0 12px", color: "var(--px-green)" }}
            >
              <ArrowDownLeft size={13} /> Entradas ({movements.filter(m => m.type === "ENTRADA").length})
            </button>
            <button
              className={`px-chip ${typeFilter === "SALIDA" ? "px-chip--active" : ""}`}
              onClick={() => { setTypeFilter("SALIDA"); setCurrentPage(1); }}
              style={{ cursor: "pointer", height: "36px", padding: "0 12px", color: "var(--px-red)" }}
            >
              <ArrowUpRight size={13} /> Salidas ({movements.filter(m => m.type === "SALIDA").length})
            </button>
            <button
              className={`px-chip ${typeFilter === "CONTEO" ? "px-chip--active" : ""}`}
              onClick={() => { setTypeFilter("CONTEO"); setCurrentPage(1); }}
              style={{ cursor: "pointer", height: "36px", padding: "0 12px", color: "var(--px-amber)" }}
            >
              <ClipboardList size={13} /> Conteos ({movements.filter(m => m.type === "CONTEO").length})
            </button>
          </div>

        </div>
      </div>

      {/* 3. High Contrast Kardex Table */}
      <div className="px-table-wrap">
        <table className="px-table">
          <thead>
            <tr>
              <th style={{ width: "95px" }}>ID Reg.</th>
              <th style={{ width: "140px" }}>Fecha / Hora</th>
              <th style={{ width: "95px", textAlign: "center" }}>Tipo</th>
              <th style={{ width: "145px" }}>Código SKU</th>
              <th>Descripción del Producto</th>
              <th style={{ width: "70px", textAlign: "right" }}>Cant.</th>
              <th style={{ width: "120px" }}>Ubicación</th>
              <th style={{ width: "115px" }}>Operador</th>
              <th>Observaciones / Seriales</th>
              <th style={{ width: "110px", textAlign: "center" }}>Estado BC</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--px-muted)" }}>
                  <AlertCircle size={24} style={{ display: "block", margin: "0 auto 0.5rem auto", opacity: 0.5 }} />
                  No se encontraron movimientos registrados con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              paginated.map((m) => {
                const isEntrada = m.type === "ENTRADA";
                const isSalida = m.type === "SALIDA";
                const isConteo = m.type === "CONTEO";

                const serials = m.serialList && m.serialList.length > 0 
                  ? m.serialList.join(", ") 
                  : (m.serialNo && m.serialNo !== "N/A" ? m.serialNo : "");

                return (
                  <tr key={m.id}>
                    <td>
                      <span className="px-mono" style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--px-muted)" }}>
                        {m.id}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.76rem", color: "var(--px-muted)", whiteSpace: "nowrap" }}>
                      {m.timestamp}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {isEntrada && <span className="px-badge px-badge--success">ENTRADA</span>}
                      {isSalida && <span className="px-badge px-badge--danger">SALIDA</span>}
                      {isConteo && <span className="px-badge px-badge--warning">CONTEO</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className="px-mono" style={{ 
                        fontWeight: "800", 
                        color: "var(--px-blue)", 
                        fontSize: "0.82rem",
                        background: "rgba(37, 99, 235, 0.08)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        border: "1px solid rgba(37, 99, 235, 0.2)"
                      }}>
                        {m.sku}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--px-text-strong)", fontSize: "0.83rem" }}>
                        {m.productName || "Suministro"}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="px-mono" style={{ 
                        fontSize: "0.92rem", 
                        fontWeight: "800",
                        color: isSalida ? "var(--px-red)" : isEntrada ? "var(--px-green)" : "var(--px-amber)"
                      }}>
                        {isSalida ? `-${m.quantity}` : `+${m.quantity}`}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.76rem", fontWeight: "600", color: "var(--px-muted)" }}>
                      {m.bin || m.location || "COTA-SUM-01"}
                    </td>
                    <td style={{ fontSize: "0.76rem", color: "var(--px-muted)" }}>
                      {m.user || "Terminal Zebra"}
                    </td>
                    <td>
                      <div style={{ fontSize: "0.76rem", color: "var(--px-text)" }}>
                        {m.note || "Sin observaciones"}
                      </div>
                      {serials && (
                        <div className="px-mono" style={{ fontSize: "0.7rem", color: "var(--px-blue)", marginTop: "2px" }}>
                          S/N: {serials}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="px-badge px-badge--success" style={{ fontSize: "0.68rem" }}>
                        <CheckCircle2 size={12} /> BC SYNC
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Pagination */}
      {totalPages > 1 && (
        <div className="px-pagination" style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "0.76rem", color: "var(--px-muted)" }}>
            Mostrando {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)} a {Math.min(filtered.length, currentPage * pageSize)} de {filtered.length} movimientos
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

    </div>
  );
}
