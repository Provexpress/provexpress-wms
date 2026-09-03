import React, { useState } from "react";
import { 
  LayoutDashboard, Boxes, Search, ArrowDownLeft, ArrowUpRight, 
  FileSpreadsheet, RefreshCw, Sun, Moon, 
  Shield, Check, X, Menu, PanelLeftClose, PanelLeftOpen,
  LogOut, User, Warehouse
} from "lucide-react";
import { useInventory } from "../context/InventoryContext";
import { ROLES_CONFIG, authService } from "../services/auth";

export function MainLayout({ currentUser, onLogout, activeRoute, onNavigate, isDark, setIsDark, children }) {
  const { products, isSyncing, handleManualSync } = useInventory();
  const [globalSearch, setGlobalSearch] = useState("");
  
  // Collapsible sidebar state (persisted or default expanded on desktop)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Mobile drawer open state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const roleConfig = ROLES_CONFIG[currentUser?.role] || ROLES_CONFIG.OPERADOR;
  const allowedRoutes = roleConfig.allowedRoutes || ["inbound", "outbound", "map", "catalog"];

  const getRoleBadgeColor = (role) => {
    if (role === "GERENCIA") return "var(--px-purple)";
    if (role === "SUPERVISOR") return "var(--px-blue)";
    return "var(--px-green)";
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  return (
    <div className={`px-app-layout px-theme ${isDark ? "px-theme--dark" : ""}`}>
      
      {/* Mobile Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div 
          style={{ position: "fixed", inset: 0, zIndex: 94, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* 1. LEFT ENTERPRISE SIDEBAR (Full Height 100vh & Collapsible) */}
      <aside className={`px-sidebar ${isSidebarCollapsed ? "is-collapsed" : ""} ${isMobileDrawerOpen ? "is-mobile-open" : ""}`}>
        
        {/* Brand Header & Collapse Button */}
        <div className="px-sidebar-header">
          <div 
            onClick={() => { onNavigate(roleConfig.defaultRoute); setIsMobileDrawerOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: "0.55rem", cursor: "pointer", overflow: "hidden" }}
          >
            <div style={{
              width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px",
              background: "var(--px-gradient-brand)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: "800", fontSize: "0.95rem",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)"
            }}>
              PX
            </div>
            {!isSidebarCollapsed && (
              <div style={{ whiteSpace: "nowrap" }}>
                <div style={{ fontWeight: "800", fontSize: "0.92rem", color: "var(--px-text-strong)", letterSpacing: "-0.02em" }}>
                  Provexpress WMS
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--px-muted)" }}>
                  Bodega Cota • Dynamics 365
                </div>
              </div>
            )}
          </div>

          {/* Toggle button on desktop */}
          <button 
            className="px-btn px-btn--ghost px-btn--icon"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? "Expandir barra lateral" : "Ocultar / Colapsar barra lateral"}
            style={{ width: "30px", height: "30px", minHeight: "30px", padding: 0 }}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Navigation Menu (Filtered by Role Congruence) */}
        <nav className="px-sidebar-nav">
          {!isSidebarCollapsed && (
            <div style={{ fontSize: "0.68rem", fontWeight: "800", color: "var(--px-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 0.5rem 0.35rem 0.5rem" }}>
              Módulos {roleConfig.title}
            </div>
          )}

          {/* Dashboard (Solo Supervisor y Gerencia) */}
          {allowedRoutes.includes("dashboard") && (
            <button 
              className={`px-sidebar-link ${activeRoute === "dashboard" ? "is-active" : ""}`}
              onClick={() => { onNavigate("dashboard"); setIsMobileDrawerOpen(false); }}
              title="Dashboard Ejecutivo"
            >
              <LayoutDashboard size={18} />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </button>
          )}

          {/* Recepción Zebra TC22 (Operador y Supervisor) */}
          {allowedRoutes.includes("inbound") && (
            <button 
              className={`px-sidebar-link ${activeRoute === "inbound" ? "is-active" : ""}`}
              onClick={() => { onNavigate("inbound"); setIsMobileDrawerOpen(false); }}
              title="Recepción (Zebra TC22)"
            >
              <ArrowDownLeft size={18} />
              {!isSidebarCollapsed && <span>Recepción (Zebra)</span>}
            </button>
          )}

          {/* Despachos Picking (Operador y Supervisor) */}
          {allowedRoutes.includes("outbound") && (
            <button 
              className={`px-sidebar-link ${activeRoute === "outbound" ? "is-active" : ""}`}
              onClick={() => { onNavigate("outbound"); setIsMobileDrawerOpen(false); }}
              title="Despachos (Picking)"
            >
              <ArrowUpRight size={18} />
              {!isSidebarCollapsed && <span>Despachos (Picking)</span>}
            </button>
          )}

          {/* Mapa Físico de Bodega (Todos) */}
          {allowedRoutes.includes("map") && (
            <button 
              className={`px-sidebar-link ${activeRoute === "map" ? "is-active" : ""}`}
              onClick={() => { onNavigate("map"); setIsMobileDrawerOpen(false); }}
              title="Mapa de Bodega"
            >
              <Boxes size={18} />
              {!isSidebarCollapsed && <span>Mapa de Bodega</span>}
            </button>
          )}

          {/* Catálogo Maestro (Todos) */}
          {allowedRoutes.includes("catalog") && (
            <button 
              className={`px-sidebar-link ${activeRoute === "catalog" ? "is-active" : ""}`}
              onClick={() => { onNavigate("catalog"); setIsMobileDrawerOpen(false); }}
              title={currentUser.role === "OPERADOR" ? "Consulta de Referencias" : "Catálogo Maestro"}
            >
              <Search size={18} />
              {!isSidebarCollapsed && <span>{currentUser.role === "OPERADOR" ? "Consulta Tóners" : "Catálogo Maestro"}</span>}
            </button>
          )}

          {/* Kardex Auditoría (Supervisor y Gerencia) */}
          {allowedRoutes.includes("kardex") && (
            <button 
              className={`px-sidebar-link ${activeRoute === "kardex" ? "is-active" : ""}`}
              onClick={() => { onNavigate("kardex"); setIsMobileDrawerOpen(false); }}
              title="Kardex Auditoría"
            >
              <FileSpreadsheet size={18} />
              {!isSidebarCollapsed && <span>Kardex Auditoría</span>}
            </button>
          )}
        </nav>

        {/* Sidebar Footer: Anchored to Bottom with Active Profile & Logout */}
        <div className="px-sidebar-footer">
          {!isSidebarCollapsed ? (
            <>
              {/* User Profile Card */}
              <div 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between", 
                  padding: "0.55rem 0.7rem", 
                  background: "var(--px-surface-sunken)", 
                  borderRadius: "var(--px-radius-md)", 
                  border: "1px solid var(--px-border)",
                  marginBottom: "0.5rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                  <div 
                    style={{
                      width: "28px", 
                      height: "28px", 
                      borderRadius: "50%",
                      background: getRoleBadgeColor(currentUser.role),
                      color: "#fff", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      fontSize: "0.75rem", 
                      fontWeight: "800",
                      flexShrink: 0
                    }}
                  >
                    {currentUser.role.charAt(0)}
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: "0.76rem", fontWeight: "800", color: "var(--px-text-strong)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                      {currentUser.name || currentUser.role}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: getRoleBadgeColor(currentUser.role), fontWeight: "700" }}>
                      {currentUser.role}
                    </div>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                className="px-btn px-btn--secondary"
                onClick={onLogout}
                style={{ 
                  width: "100%", 
                  justifyContent: "center", 
                  padding: "0.45rem 0.65rem", 
                  fontSize: "0.75rem", 
                  color: "var(--px-red)", 
                  borderColor: "rgba(239, 68, 68, 0.2)",
                  background: "rgba(239, 68, 68, 0.05)"
                }}
                title="Cerrar Sesión Segura"
              >
                <LogOut size={14} />
                <span>Cerrar Sesión</span>
              </button>
            </>
          ) : (
            <button
              className="px-btn px-btn--secondary px-btn--icon"
              onClick={onLogout}
              title={`Cerrar Sesión (${currentUser.role})`}
              style={{ width: "36px", height: "36px", color: "var(--px-red)" }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>

      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className={`px-main-container ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
        
        {/* TOPBAR */}
        <header className="px-topbar">
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {/* Hamburger button to toggle sidebar */}
            <button 
              className="px-btn px-btn--ghost px-btn--icon"
              onClick={() => {
                if (window.innerWidth <= 1024) {
                  setIsMobileDrawerOpen(prev => !prev);
                } else {
                  toggleSidebar();
                }
              }}
              title="Mostrar / Ocultar menú lateral"
              style={{ width: "34px", height: "34px", minHeight: "34px" }}
            >
              <Menu size={18} />
            </button>

            {/* Desktop Search Box in Topbar */}
            <div className="px-topbar-search-desktop" style={{ position: "relative", width: "100%", maxWidth: "320px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--px-muted)" }} />
              <input 
                type="text" 
                className="px-input" 
                placeholder="Buscar SKU, producto, serial..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && globalSearch.trim()) {
                    onNavigate("catalog");
                  }
                }}
                style={{ paddingLeft: "2rem", height: "34px", fontSize: "0.8rem" }}
              />
            </div>
          </div>

          {/* Topbar Right Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            
            {/* Sync Button */}
            <button 
              className="px-btn px-btn--secondary px-btn--sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Sincronizar existencias con Business Central Cloud"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.55rem" }}
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span style={{ fontSize: "0.74rem" }}>{isSyncing ? "Sync..." : "Sync"}</span>
            </button>

            {/* Dark / Light Mode Toggle */}
            <button 
              className="px-btn px-btn--secondary px-btn--sm"
              onClick={() => setIsDark(!isDark)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.55rem", fontSize: "0.74rem" }}
              title="Alternar Modo Claro / Modo Oscuro"
            >
              {isDark ? <Sun size={12} color="var(--px-amber)" /> : <Moon size={12} color="var(--px-blue)" />}
              <span>{isDark ? "Claro" : "Oscuro"}</span>
            </button>

            {/* User Profile Badge */}
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "3px 8px",
                borderRadius: "var(--px-radius-pill)",
                background: "var(--px-surface-sunken)",
                border: "1px solid var(--px-border)"
              }}
            >
              <div style={{
                width: "22px", height: "22px", borderRadius: "50%",
                background: getRoleBadgeColor(currentUser.role),
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", fontWeight: "800"
              }}>
                {currentUser.role.charAt(0)}
              </div>
              <span style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--px-text-strong)" }}>
                {currentUser.role}
              </span>
            </div>

            {/* Topbar Logout Button */}
            <button
              onClick={onLogout}
              className="px-btn px-btn--ghost px-btn--icon"
              title="Cerrar Sesión"
              style={{ width: "32px", height: "32px", minHeight: "32px", color: "var(--px-red)" }}
            >
              <LogOut size={16} />
            </button>

          </div>
        </header>

        {/* Page Content View */}
        <main style={{ flex: 1, width: "100%", overflowX: "hidden" }}>
          {children}
        </main>

        {/* Footer */}
        <footer className="px-footer">
          Provexpress SAS • WMS Bodega Cota • Microsoft Dynamics 365 Business Central Cloud
        </footer>

      </div>

      {/* 3. MOBILE BOTTOM NAV (Filtered by Role Congruence) */}
      <nav className="px-mobile-bottom-nav">
        {allowedRoutes.includes("dashboard") && (
          <button className={`px-mobile-bottom-nav__btn ${activeRoute === "dashboard" ? "is-active" : ""}`} onClick={() => onNavigate("dashboard")}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>
        )}
        {allowedRoutes.includes("inbound") && (
          <button className={`px-mobile-bottom-nav__btn ${activeRoute === "inbound" ? "is-active" : ""}`} onClick={() => onNavigate("inbound")}>
            <ArrowDownLeft size={18} />
            <span>Recepción</span>
          </button>
        )}
        {allowedRoutes.includes("outbound") && (
          <button className={`px-mobile-bottom-nav__btn ${activeRoute === "outbound" ? "is-active" : ""}`} onClick={() => onNavigate("outbound")}>
            <ArrowUpRight size={18} />
            <span>Despachos</span>
          </button>
        )}
        {allowedRoutes.includes("map") && (
          <button className={`px-mobile-bottom-nav__btn ${activeRoute === "map" ? "is-active" : ""}`} onClick={() => onNavigate("map")}>
            <Boxes size={18} />
            <span>Estantes</span>
          </button>
        )}
        {allowedRoutes.includes("catalog") && (
          <button className={`px-mobile-bottom-nav__btn ${activeRoute === "catalog" ? "is-active" : ""}`} onClick={() => onNavigate("catalog")}>
            <Search size={18} />
            <span>Catálogo</span>
          </button>
        )}
        {allowedRoutes.includes("kardex") && (
          <button className={`px-mobile-bottom-nav__btn ${activeRoute === "kardex" ? "is-active" : ""}`} onClick={() => onNavigate("kardex")}>
            <FileSpreadsheet size={18} />
            <span>Kardex</span>
          </button>
        )}
      </nav>

    </div>
  );
}
