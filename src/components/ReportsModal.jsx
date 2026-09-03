import React, { useState } from "react";
import { 
  FileSpreadsheet, FileText, Download, X, 
  CheckCircle2, AlertCircle, Building2, Calendar, ShieldCheck, DollarSign
} from "lucide-react";
import { reportService } from "../services/reportService";

export function ReportsModal({ products, isOpen, onClose }) {
  const [reportType, setReportType] = useState("ALL"); // ALL, LOW_STOCK, IN_STOCK
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  const formatCOP = (val) => {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val || 0);
  };

  const getFilteredData = () => {
    if (reportType === "LOW_STOCK") {
      return products.filter(p => p.stock <= 3);
    }
    if (reportType === "IN_STOCK") {
      return products.filter(p => p.stock > 0);
    }
    return products;
  };

  const currentData = getFilteredData();
  const totalValuation = currentData.reduce((sum, p) => sum + (p.stock * (p.unitCost || 120000)), 0);
  const totalUnits = currentData.reduce((sum, p) => sum + p.stock, 0);

  // 1. Descarga Directa de Archivo Excel (.XLSX)
  const handleExportExcel = () => {
    setIsGenerating(true);
    setSuccessMessage("");
    try {
      reportService.exportToExcel(currentData, reportType);
      setSuccessMessage("¡Archivo Excel (.xlsx) generado y descargado con éxito!");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      console.error(err);
      alert("Error generando Excel: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Descarga Directa de Documento PDF (.PDF) Vectorial
  const handleExportPdf = () => {
    setIsGenerating(true);
    setSuccessMessage("");
    try {
      reportService.exportToPdf(currentData, reportType);
      setSuccessMessage("¡Informe PDF con membrete y firmas generado y descargado!");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      console.error(err);
      alert("Error generando PDF: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="px-drawer-overlay" onClick={onClose}>
      <div 
        className="px-drawer-card" 
        style={{ maxWidth: "750px", maxHeight: "92vh", overflowY: "auto" }} 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.2rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.25rem" }}>
              <span className="px-chip" style={{ color: "var(--px-blue)", fontWeight: "800" }}>
                Centro de Informes
              </span>
              <span className="px-chip" style={{ color: "var(--px-green)", fontWeight: "700" }}>
                Auditoría Oficial
              </span>
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0 }}>
              Generación de Informes de Inventario
            </h2>
            <p style={{ margin: "0.15rem 0 0 0", color: "var(--px-muted)", fontSize: "0.82rem" }}>
              Exporta reportes estructurados en formato <strong>Excel (.xlsx)</strong> o documentos vectoriales en <strong>PDF</strong> con membrete y firmas
            </p>
          </div>
          <button className="px-btn px-btn--ghost px-btn--icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Filter Selection for Report */}
        <div style={{ background: "var(--px-surface-sunken)", padding: "1rem", borderRadius: "var(--px-radius-md)", border: "1px solid var(--px-border)", marginBottom: "1.25rem" }}>
          <label style={{ fontSize: "0.78rem", fontWeight: "800", color: "var(--px-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
            Selecciona el Alcance del Informe:
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
            <button
              className={`px-interactive-card ${reportType === "ALL" ? "is-selected" : ""}`}
              onClick={() => setReportType("ALL")}
              style={{ padding: "0.75rem", textAlign: "left" }}
            >
              <div style={{ fontWeight: "700", fontSize: "0.85rem", color: "var(--px-text-strong)" }}>Inventario Maestro Completo</div>
              <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginTop: "2px" }}>{products.length} Referencias totales</div>
            </button>

            <button
              className={`px-interactive-card ${reportType === "LOW_STOCK" ? "is-selected" : ""}`}
              onClick={() => setReportType("LOW_STOCK")}
              style={{ padding: "0.75rem", textAlign: "left" }}
            >
              <div style={{ fontWeight: "700", fontSize: "0.85rem", color: "var(--px-amber)" }}>Alerta Stock Crítico</div>
              <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginTop: "2px" }}>Referencias con existencia ≤ 3</div>
            </button>

            <button
              className={`px-interactive-card ${reportType === "IN_STOCK" ? "is-selected" : ""}`}
              onClick={() => setReportType("IN_STOCK")}
              style={{ padding: "0.75rem", textAlign: "left" }}
            >
              <div style={{ fontWeight: "700", fontSize: "0.85rem", color: "var(--px-green)" }}>Existencias Disponibles</div>
              <div style={{ fontSize: "0.72rem", color: "var(--px-muted)", marginTop: "2px" }}>Solo productos con stock &gt; 0</div>
            </button>
          </div>
        </div>

        {/* Report Preview Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div className="px-card" style={{ padding: "0.85rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--px-muted)", fontWeight: "700", textTransform: "uppercase" }}>Ítems en Informe</span>
            <div className="px-mono" style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--px-text-strong)", marginTop: "2px" }}>
              {currentData.length} SKUs
            </div>
          </div>
          <div className="px-card" style={{ padding: "0.85rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--px-muted)", fontWeight: "700", textTransform: "uppercase" }}>Total Unidades</span>
            <div className="px-mono" style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--px-blue)", marginTop: "2px" }}>
              {new Intl.NumberFormat("es-CO").format(totalUnits)} unid.
            </div>
          </div>
          <div className="px-card" style={{ padding: "0.85rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--px-muted)", fontWeight: "700", textTransform: "uppercase" }}>Valuación FIFO</span>
            <div className="px-mono" style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--px-green)", marginTop: "2px" }}>
              {formatCOP(totalValuation)}
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="px-badge px-badge--success" style={{ width: "100%", justifyContent: "center", padding: "0.55rem", fontSize: "0.82rem", marginBottom: "1rem" }}>
            <CheckCircle2 size={16} /> {successMessage}
          </div>
        )}

        {/* Action Buttons: 2 Real Professional Downloads */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
          
          {/* 1. EXCEL (.XLSX) REPORT */}
          <div className="px-card" style={{ padding: "1.1rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--px-green)", marginBottom: "0.4rem" }}>
                <FileSpreadsheet size={20} />
                <span style={{ fontWeight: "800", fontSize: "0.95rem" }}>Libro Excel Profesional (.xlsx)</span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--px-muted)", margin: "0 0 1rem 0" }}>
                Genera un archivo binario nativo de Microsoft Excel con formato numérico de moneda, anchos de columna autoajustados y fila de sumatorias contables.
              </p>
            </div>
            <button 
              className="px-btn px-btn--secondary"
              onClick={handleExportExcel}
              disabled={isGenerating}
              style={{ width: "100%", borderColor: "rgba(16,185,129,0.4)", color: "var(--px-green)" }}
            >
              <Download size={15} /> Descargar Archivo Excel (.xlsx)
            </button>
          </div>

          {/* 2. PDF VECTORIAL DOCUMENT */}
          <div className="px-card" style={{ padding: "1.1rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--px-blue)", marginBottom: "0.4rem" }}>
                <FileText size={20} />
                <span style={{ fontWeight: "800", fontSize: "0.95rem" }}>Documento PDF Oficial (.pdf)</span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--px-muted)", margin: "0 0 1rem 0" }}>
                Genera y descarga un documento vectorial en PDF con membrete corporativo Provexpress SAS, tarjetas ejecutivas, tabla paginada y casillas de firma.
              </p>
            </div>
            <button 
              className="px-btn px-btn--primary"
              onClick={handleExportPdf}
              disabled={isGenerating}
              style={{ width: "100%" }}
            >
              <Download size={15} /> Descargar Informe en PDF (.pdf)
            </button>
          </div>

        </div>

        {/* Footer info */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.85rem", borderTop: "1px solid var(--px-border)", fontSize: "0.74rem", color: "var(--px-muted)" }}>
          <span>Generado el: {new Date().toLocaleString("es-CO")}</span>
          <span>Provexpress WMS • Dynamics 365 Cloud</span>
        </div>

      </div>
    </div>
  );
}
