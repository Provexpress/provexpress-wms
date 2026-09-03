import React, { useState, useEffect } from "react";
import { RefreshCw, Moon, Sun, Shield, User, Lock, X, Check, Key, LayoutDashboard, Search, ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import { useInventory } from "../context/InventoryContext";
import { authService } from "../services/auth";

export function Navbar({ activeRoute, onNavigate, isDark, setIsDark }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString("es-CO"));
  const { products, isSyncing, handleManualSync } = useInventory();
  
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString("es-CO")), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    const res = await authService.login(pinInput);
    if (res.success) {
      setCurrentUser(res.user);
      setShowAuthModal(false);
      setPinInput("");
    } else {
      setAuthError(res.error || "PIN incorrecto");
    }
  };

  const getRoleBadgeColor = (role) => {
    if (role === "GERENCIA") return "var(--px-purple)";
    if (role === "SUPERVISOR") return "var(--px-blue)";
    return "var(--px-green)";
  };

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
          
          {/* Brand & Logo */}
          <div 
            style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexShrink: 0, cursor: "pointer" }} 
            onClick={() => onNavigate("dashboard")}
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
                  <span>BC Cloud ({products.length})</span>
                </span>
              </div>
              <div style={{ fontSize: "0.62rem", color: "var(--px-muted)", whiteSpace: "nowrap" }}>
                Bodega Cota • {time}
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs with Crisp Lucide Icons */}
          <nav className="px-tabs px-nav-tabs-desktop" style={{ margin: 0, display: "flex", gap: "0.3rem", flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none" }}>
            <button className={`px-tab ${activeRoute === "dashboard" ? "is-active" : ""}`} onClick={() => onNavigate("dashboard")} style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <LayoutDashboard size={14} /> Dashboard
            </button>
            <button className={`px-tab ${activeRoute === "catalog" ? "is-active" : ""}`} onClick={() => onNavigate("catalog")} style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <Search size={14} /> Catálogo
            </button>
            <button className={`px-tab ${activeRoute === "inbound" ? "is-active" : ""}`} onClick={() => onNavigate("inbound")} style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", background: activeRoute === "inbound" ? "var(--px-gradient-brand)" : "transparent", color: activeRoute === "inbound" ? "#fff" : "inherit", fontWeight: "700", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <ArrowDownLeft size={14} /> Entradas
            </button>
            <button className={`px-tab ${activeRoute === "outbound" ? "is-active" : ""}`} onClick={() => onNavigate("outbound")} style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <ArrowUpRight size={14} /> Despachos
            </button>
            <button className={`px-tab ${activeRoute === "kardex" ? "is-active" : ""}`} onClick={() => onNavigate("kardex")} style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <History size={14} /> Kardex
            </button>
          </nav>

          {/* Right Controls: Sync, Auth Role, Theme */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
            <button 
              className="px-btn px-btn--sm px-btn--ghost" 
              onClick={handleManualSync} 
              disabled={isSyncing}
              title="Sincronizar con Business Central"
              style={{ display: "flex", alignItems: "center", gap: "0.2rem", padding: "0.25rem 0.45rem", borderRadius: "8px", minHeight: "30px" }}
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span style={{ fontSize: "0.7rem", fontWeight: "600" }}>Sync</span>
            </button>

            {/* Authenticated User Button */}
            <button
              className="px-btn px-btn--sm px-btn--secondary"
              onClick={() => setShowAuthModal(true)}
              title="Cambiar Usuario / Rol Seguro"
              style={{ 
                padding: "0.25rem 0.55rem", 
                fontSize: "0.72rem", 
                fontWeight: "700", 
                borderRadius: "8px", 
                minHeight: "30px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                borderColor: getRoleBadgeColor(currentUser.role)
              }}
            >
              <Shield size={12} color={getRoleBadgeColor(currentUser.role)} />
              <span>{currentUser.role}</span>
            </button>

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

      {/* Mobile Bottom Dock (Zebra TC22 Optimized with Crisp Vectors) */}
      <nav className="px-mobile-bottom-nav">
        <button className={`px-mobile-bottom-nav__btn ${activeRoute === "inbound" ? "is-active" : ""}`} onClick={() => onNavigate("inbound")}>
          <ArrowDownLeft size={19} />
          <span>Entradas</span>
        </button>
        <button className={`px-mobile-bottom-nav__btn ${activeRoute === "catalog" ? "is-active" : ""}`} onClick={() => onNavigate("catalog")}>
          <Search size={19} />
          <span>Catálogo</span>
        </button>
        <button className={`px-mobile-bottom-nav__btn ${activeRoute === "outbound" ? "is-active" : ""}`} onClick={() => onNavigate("outbound")}>
          <ArrowUpRight size={19} />
          <span>Despachos</span>
        </button>
        <button className={`px-mobile-bottom-nav__btn ${activeRoute === "kardex" ? "is-active" : ""}`} onClick={() => onNavigate("kardex")}>
          <History size={19} />
          <span>Kardex</span>
        </button>
      </nav>

      {/* Modal de Autenticación / Cambio de Rol por PIN */}
      {showAuthModal && (
        <div className="px-drawer-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="px-drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: "800", fontSize: "1rem", color: "var(--px-text-strong)" }}>
                <Lock size={17} color="var(--px-blue)" /> Control de Acceso WMS
              </div>
              <button className="px-btn px-btn--sm px-btn--icon" onClick={() => setShowAuthModal(false)}>
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--px-muted)", margin: "0 0 0.85rem 0" }}>
              Ingresa el PIN correspondiente para cambiar de perfil o desbloquear permisos:
            </p>

            <div style={{ background: "rgba(244, 247, 255, 0.8)", padding: "0.6rem", borderRadius: "10px", marginBottom: "0.85rem", fontSize: "0.72rem", textAlign: "left" }}>
              <div>• <strong>Operador:</strong> PIN 1234 (Escaneo y Recepción)</div>
              <div>• <strong>Supervisor:</strong> PIN 4321 (Creación de SKU y Ajustes)</div>
              <div>• <strong>Gerencia:</strong> PIN 9876 (Auditoría Contable Total)</div>
            </div>

            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <input 
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                placeholder="Ingresa PIN (4 dígitos)..."
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                style={{ height: "46px", fontSize: "1.3rem", fontWeight: "800", textAlign: "center", letterSpacing: "0.3em", borderRadius: "10px" }}
              />

              {authError && (
                <div style={{ color: "var(--px-red)", fontSize: "0.75rem", fontWeight: "700" }}>
                  ⚠️ {authError}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem" }}>
                <button type="button" className="px-btn px-btn--secondary" onClick={() => setShowAuthModal(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="px-btn px-btn--primary" style={{ flex: 1, background: "var(--px-gradient-brand)" }}>
                  Validar PIN →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}