import React, { useState, useEffect } from "react";
import { RefreshCw, Moon, Sun, BarChart3, Search, QrCode, FileText, Settings, Truck, Sparkles, Package, Zap } from "lucide-react";
import { audioService } from "../services/audio";
import { storageService } from "../services/storage";

export function Header({ activeTab, setActiveTab, currentRole, setCurrentRole, isDark, setIsDark, isSyncing, onManualSync, totalItemsCount, onOpenDemo }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString("es-CO"));

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString("es-CO")), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header className="px-nav-bar" style={{ width: "100%", overflowX: "hidden" }}>
        <div className="px-brand-strip"></div>
        <div style={{ 
          maxWidth: "1380px", 
          margin: "0 auto", 
          padding: "0.4rem 0.75rem", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          gap: "0.5rem", 
          width: "100%", 
          boxSizing: "border-box" 
        }}>
          
          {/* Brand & Logo (Compact, Never shrink) */}
          <div 
            style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexShrink: 0, cursor: "pointer" }} 
            onClick={() => setActiveTab("dashboard")}
          >
            <div style={{
              width: "32px", height: "32px", minWidth: "32px", borderRadius: "9px",
              background: "var(--px-gradient-brand)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: "800", fontSize: "0.92rem",
              boxShadow: "0 2px 8px rgba(26, 43, 107, 0.2)"
            }}>
              PX
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.92rem", fontWeight: "800", color: "var(--px-text)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                  PROVEXPRESS
                </span>
                <span className="px-chip px-chip--active" style={{ fontSize: "0.58rem", padding: "1px 5px", background: "rgba(22, 163, 74, 0.12)", color: "var(--px-green)", borderColor: "var(--px-green)", display: "inline-flex", alignItems: "center", gap: "2px", whiteSpace: "nowrap" }}>
                  <span className="px-live-dot"></span>
                  <span>BC ({totalItemsCount || "2.428"})</span>
                </span>
              </div>
              <div style={{ fontSize: "0.62rem", color: "var(--px-muted)", whiteSpace: "nowrap" }}>
                Bodega Cota • {time}
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Middle, Responsive, Clean Pills) */}
          <nav className="px-tabs px-nav-tabs-desktop" style={{ margin: 0, display: "flex", gap: "0.25rem", flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none" }}>
            <button className={`px-tab ${activeTab === "dashboard" ? "is-active" : ""}`} onClick={() => setActiveTab("dashboard")} style={{ padding: "0.35rem 0.65rem", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
              📊 Dashboard
            </button>
            <button className={`px-tab ${activeTab === "catalog" ? "is-active" : ""}`} onClick={() => setActiveTab("catalog")} style={{ padding: "0.35rem 0.65rem", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
              🔍 Catálogo
            </button>
            <button className={`px-tab ${activeTab === "zebra" ? "is-active" : ""}`} onClick={() => setActiveTab("zebra")} style={{ padding: "0.35rem 0.65rem", fontSize: "0.78rem", background: activeTab === "zebra" ? "var(--px-gradient-brand)" : "transparent", color: activeTab === "zebra" ? "#fff" : "inherit", fontWeight: "700", whiteSpace: "nowrap" }}>
              📥 Entradas
            </button>
            <button className={`px-tab ${activeTab === "outbound" ? "is-active" : ""}`} onClick={() => setActiveTab("outbound")} style={{ padding: "0.35rem 0.65rem", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
              📦 Despachos
            </button>
            <button className={`px-tab ${activeTab === "pro" ? "is-active" : ""}`} onClick={() => setActiveTab("pro")} style={{ padding: "0.35rem 0.65rem", fontSize: "0.78rem", background: activeTab === "pro" ? "linear-gradient(135deg, rgba(26,43,107,0.15), rgba(106,63,160,0.25))" : "transparent", color: activeTab === "pro" ? "var(--px-purple)" : "inherit", fontWeight: "800", whiteSpace: "nowrap", border: activeTab === "pro" ? "1px solid var(--px-purple)" : "none" }}>
              ⚡ Flujo Pro
            </button>
            <button className={`px-tab ${activeTab === "kardex" ? "is-active" : ""}`} onClick={() => setActiveTab("kardex")} style={{ padding: "0.35rem 0.65rem", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
              📜 Kardex
            </button>
          </nav>

          {/* Right Tools: Sync, Role, Theme (Never shrink) */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
            
            <button 
              className="px-btn px-btn--sm px-btn--ghost" 
              onClick={onManualSync} 
              disabled={isSyncing}
              title="Sincronizar con Business Central"
              style={{ display: "flex", alignItems: "center", gap: "0.2rem", padding: "0.25rem 0.45rem", borderRadius: "8px", minHeight: "30px" }}
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span style={{ fontSize: "0.7rem", fontWeight: "600" }}>Sync</span>
            </button>

            <select 
              className="px-select" 
              value={currentRole} 
              onChange={(e) => {
                setCurrentRole(e.target.value);
                storageService.setUserRole(e.target.value);
              }}
              style={{ padding: "0.25rem 0.35rem", fontSize: "0.7rem", width: "auto", maxWidth: "95px", fontWeight: "600", borderRadius: "8px", height: "30px" }}
            >
              <option value="Gerencia">👤 Gerencia</option>
              <option value="Supervisor">👔 Supervisor</option>
              <option value="Bodega Zebra">📱 Zebra</option>
            </select>

            <button 
              className="px-btn px-btn--sm px-btn--icon" 
              onClick={() => setIsDark(!isDark)}
              title={isDark ? "Modo Claro" : "Modo Oscuro"}
              style={{ width: "28px", height: "28px", minWidth: "28px", borderRadius: "8px" }}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Zebra TC22 Optimized) */}
      <nav className="px-mobile-bottom-nav">
        <button className={`px-bottom-nav-item ${activeTab === "dashboard" ? "is-active" : ""}`} onClick={() => setActiveTab("dashboard")}>
          <BarChart3 size={17} />
          <span>Dashboard</span>
        </button>
        <button className={`px-bottom-nav-item ${activeTab === "catalog" ? "is-active" : ""}`} onClick={() => setActiveTab("catalog")}>
          <Search size={17} />
          <span>Catálogo</span>
        </button>
        <button className={`px-bottom-nav-item zebra-highlight ${activeTab === "zebra" ? "is-active" : ""}`} onClick={() => setActiveTab("zebra")} style={{ background: activeTab === "zebra" ? "var(--px-surface-soft)" : "transparent" }}>
          <QrCode size={19} color={activeTab === "zebra" ? "var(--px-blue)" : "currentColor"} />
          <span style={{ fontWeight: activeTab === "zebra" ? "800" : "600" }}>Entradas</span>
        </button>
        <button className={`px-bottom-nav-item ${activeTab === "outbound" ? "is-active" : ""}`} onClick={() => setActiveTab("outbound")}>
          <Truck size={17} />
          <span>Despachos</span>
        </button>
        <button className={`px-bottom-nav-item ${activeTab === "pro" ? "is-active" : ""}`} onClick={() => setActiveTab("pro")} style={{ color: activeTab === "pro" ? "var(--px-purple)" : "inherit" }}>
          <Zap size={17} />
          <span>Flujo Pro</span>
        </button>
        <button className={`px-bottom-nav-item ${activeTab === "kardex" ? "is-active" : ""}`} onClick={() => setActiveTab("kardex")}>
          <FileText size={17} />
          <span>Kardex</span>
        </button>
      </nav>
    </>
  );
}