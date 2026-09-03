import React, { useState } from "react";
import { storageService } from "../services/storage";
import { bcService } from "../services/bc-api";

export function Settings({ onResetData }) {
  const [config, setConfig] = useState(storageService.getConfig());
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    storageService.saveConfig(config);
    setStatus({ type: "success", text: "Configuración guardada correctamente." });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleTest = async () => {
    setTesting(true);
    const res = await bcService.testConnection();
    setTesting(false);
    setStatus({ type: "success", text: res.message });
  };

  return (
    <div className="px-shell px-shell--compact" style={{ padding: "1.5rem 1rem" }}>
      
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--px-text)", margin: 0 }}>
          Conexión API Microsoft Dynamics 365 Business Central
        </h1>
        <p style={{ margin: 0, color: "var(--px-muted)", fontSize: "0.85rem" }}>
          Parámetros de integración OData v4 y REST APIs para sincronización de inventario
        </p>
      </div>

      {status && (
        <div className={`px-badge px-badge--${status.type}`} style={{ width: "100%", padding: "0.85rem", marginBottom: "1.25rem", textAlign: "center", display: "block" }}>
          {status.text}
        </div>
      )}

      <form onSubmit={handleSave} className="px-panel" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--px-text)", marginBottom: "1rem" }}>
          ⚙️ Parámetros del Entorno
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label className="px-label">Tenant ID (Directorio Microsoft Entra)</label>
            <input 
              type="text" 
              className="px-input"
              value={config.tenantId}
              onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
            />
          </div>

          <div className="px-grid px-grid--split" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label className="px-label">Entorno (Environment)</label>
              <select 
                className="px-select"
                value={config.environment}
                onChange={(e) => setConfig({ ...config, environment: e.target.value })}
              >
                <option value="Production">Production</option>
                <option value="Sandbox">Sandbox</option>
              </select>
            </div>
            <div>
              <label className="px-label">Nombre de Empresa (Company)</label>
              <input 
                type="text" 
                className="px-input"
                value={config.companyId}
                onChange={(e) => setConfig({ ...config, companyId: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="px-label">Endpoint Base de APIs Business Central</label>
            <input 
              type="text" 
              className="px-input"
              value={config.apiUrl}
              onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <button 
              type="button" 
              className="px-btn px-btn--secondary"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? "Probando..." : "🔌 Probar Conexión API"}
            </button>
            <button type="submit" className="px-btn px-btn--primary" style={{ background: "var(--px-gradient-brand)" }}>
              💾 Guardar Parámetros
            </button>
          </div>
        </div>
      </form>

      <div className="px-panel" style={{ border: "1px solid var(--px-border)" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--px-red)", marginBottom: "0.5rem" }}>
          🗑️ Zona de Mantenimiento
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--px-muted)", marginBottom: "1rem" }}>
          Restaura la base de datos de productos a los 2.426 items oficiales iniciales.
        </p>
        <button 
          type="button" 
          className="px-btn px-btn--ghost"
          style={{ color: "var(--px-red)", borderColor: "var(--px-red)" }}
          onClick={() => {
            if (confirm("¿Restaurar inventario a los 2.426 productos iniciales?")) {
              storageService.resetToInitial();
              onResetData();
              alert("Inventario restaurado al catálogo inicial.");
            }
          }}
        >
          Restaurar Base de Datos Inicial
        </button>
      </div>

    </div>
  );
}