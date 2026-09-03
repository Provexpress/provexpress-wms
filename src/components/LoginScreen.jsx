import React, { useState } from "react";
import { 
  ShieldCheck, ScanLine, ClipboardCheck, TrendingUp, 
  Lock, ArrowRight, Sun, Moon, CheckCircle2, AlertCircle,
  Delete, User, Warehouse
} from "lucide-react";
import { ROLES_CONFIG, authService } from "../services/auth";

export function LoginScreen({ onLoginSuccess, isDark, setIsDark }) {
  const [selectedRoleKey, setSelectedRoleKey] = useState("OPERADOR");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedRole = ROLES_CONFIG[selectedRoleKey];

  const handleSelectRole = (roleKey) => {
    setSelectedRoleKey(roleKey);
    setError("");
    setPin(ROLES_CONFIG[roleKey].pinHint); // Pre-fill PIN for seamless UX, user can still edit
  };

  const handleKeypadPress = (val) => {
    setError("");
    if (val === "BACKSPACE") {
      setPin(prev => prev.slice(0, -1));
    } else if (val === "CLEAR") {
      setPin("");
    } else if (pin.length < 8) {
      setPin(prev => prev + val);
    }
  };

  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setError("Ingresa el PIN de seguridad para continuar.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authService.login(pin);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || "PIN incorrecto. Intenta con los dígitos indicados.");
      }
    } catch (err) {
      setError("Error validando credenciales.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={`px-theme ${isDark ? "px-theme--dark" : ""}`}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "var(--px-bg)",
        padding: "1.5rem 1rem",
        boxSizing: "border-box",
        position: "relative"
      }}
    >
      {/* Top Controls: Dark Mode Toggle & Live Badge */}
      <div style={{ position: "absolute", top: "1.2rem", right: "1.2rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          onClick={() => setIsDark(!isDark)}
          className="px-btn px-btn--ghost"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title={isDark ? "Modo Claro" : "Modo Oscuro"}
        >
          {isDark ? <Sun size={18} style={{ color: "var(--px-amber)" }} /> : <Moon size={18} style={{ color: "var(--px-muted)" }} />}
        </button>
      </div>

      <div style={{ position: "absolute", top: "1.2rem", left: "1.2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
          <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--px-text-strong)" }}>
            Dynamics 365 Cloud • Bodega Cota
          </span>
        </div>
      </div>

      {/* Main Login Card */}
      <div 
        className="px-card"
        style={{
          width: "100%",
          maxWidth: "760px",
          background: "var(--px-surface)",
          padding: "2.5rem 2rem",
          boxSizing: "border-box",
          borderRadius: "var(--px-radius-xl)",
          boxShadow: "var(--px-neu-raised)",
          border: "1px solid var(--px-border)"
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div 
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "var(--px-gradient-brand)",
              color: "#FFFFFF",
              boxShadow: "0 8px 20px rgba(37, 99, 235, 0.35)",
              marginBottom: "1rem"
            }}
          >
            <Warehouse size={28} />
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "800", color: "var(--px-text-strong)", margin: 0, letterSpacing: "-0.03em" }}>
            PROVEXPRESS WMS
          </h1>
          <p style={{ margin: "0.4rem 0 0 0", color: "var(--px-muted)", fontSize: "0.92rem" }}>
            Sistema de Gestión de Almacén e Inventario de Tóners • Bodega Cota
          </p>
        </div>

        {/* 1. Profile / Role Selector */}
        <div style={{ marginBottom: "1.75rem" }}>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: "700", color: "var(--px-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            1. Selecciona tu Perfil de Operación
          </label>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.85rem" }}>
            {/* Role Card: Operador */}
            <div 
              onClick={() => handleSelectRole("OPERADOR")}
              style={{
                cursor: "pointer",
                padding: "1rem",
                borderRadius: "var(--px-radius-md)",
                background: selectedRoleKey === "OPERADOR" ? "var(--px-surface-sunken)" : "var(--px-surface)",
                border: selectedRoleKey === "OPERADOR" ? "2px solid var(--px-green)" : "1px solid var(--px-border)",
                boxShadow: selectedRoleKey === "OPERADOR" ? "var(--px-neu-inset)" : "var(--px-neu-flat)",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.12)", color: "var(--px-green)" }}>
                    <ScanLine size={18} />
                  </div>
                  <strong style={{ fontSize: "0.92rem", color: "var(--px-text-strong)" }}>Operador</strong>
                </div>
                {selectedRoleKey === "OPERADOR" && <CheckCircle2 size={16} style={{ color: "var(--px-green)" }} />}
              </div>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--px-muted)", lineHeight: 1.35 }}>
                Recepción Zebra TC22, Despachos y Mapa de Estantes.
              </p>
              <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--px-green)", fontWeight: "700" }}>
                PIN sugerido: 1234
              </div>
            </div>

            {/* Role Card: Supervisor */}
            <div 
              onClick={() => handleSelectRole("SUPERVISOR")}
              style={{
                cursor: "pointer",
                padding: "1rem",
                borderRadius: "var(--px-radius-md)",
                background: selectedRoleKey === "SUPERVISOR" ? "var(--px-surface-sunken)" : "var(--px-surface)",
                border: selectedRoleKey === "SUPERVISOR" ? "2px solid var(--px-blue)" : "1px solid var(--px-border)",
                boxShadow: selectedRoleKey === "SUPERVISOR" ? "var(--px-neu-inset)" : "var(--px-neu-flat)",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(37, 99, 235, 0.12)", color: "var(--px-blue)" }}>
                    <ClipboardCheck size={18} />
                  </div>
                  <strong style={{ fontSize: "0.92rem", color: "var(--px-text-strong)" }}>Supervisor</strong>
                </div>
                {selectedRoleKey === "SUPERVISOR" && <CheckCircle2 size={16} style={{ color: "var(--px-blue)" }} />}
              </div>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--px-muted)", lineHeight: 1.35 }}>
                Catálogo, Conteo Físico, Kardex y Dynamics 365.
              </p>
              <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--px-blue)", fontWeight: "700" }}>
                PIN sugerido: 4321
              </div>
            </div>

            {/* Role Card: Gerencia */}
            <div 
              onClick={() => handleSelectRole("GERENCIA")}
              style={{
                cursor: "pointer",
                padding: "1rem",
                borderRadius: "var(--px-radius-md)",
                background: selectedRoleKey === "GERENCIA" ? "var(--px-surface-sunken)" : "var(--px-surface)",
                border: selectedRoleKey === "GERENCIA" ? "2px solid var(--px-purple)" : "1px solid var(--px-border)",
                boxShadow: selectedRoleKey === "GERENCIA" ? "var(--px-neu-inset)" : "var(--px-neu-flat)",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(124, 58, 237, 0.12)", color: "var(--px-purple)" }}>
                    <TrendingUp size={18} />
                  </div>
                  <strong style={{ fontSize: "0.92rem", color: "var(--px-text-strong)" }}>Gerencia</strong>
                </div>
                {selectedRoleKey === "GERENCIA" && <CheckCircle2 size={16} style={{ color: "var(--px-purple)" }} />}
              </div>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--px-muted)", lineHeight: 1.35 }}>
                Dashboard Ejecutivo, Valorización $91.4M COP y Auditoría.
              </p>
              <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--px-purple)", fontWeight: "700" }}>
                PIN sugerido: 9876
              </div>
            </div>
          </div>
        </div>

        {/* 2. Interactive PIN Section */}
        <form onSubmit={handleFormSubmit} style={{ maxWidth: "440px", margin: "0 auto" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", fontWeight: "700", color: "var(--px-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              <span>2. Ingresa PIN de Acceso ({selectedRole.title})</span>
              <span style={{ color: "var(--px-blue)", fontWeight: "800", cursor: "pointer" }} onClick={() => setPin(selectedRole.pinHint)}>
                Llenar PIN ({selectedRole.pinHint})
              </span>
            </label>

            <div style={{ position: "relative" }}>
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                autoFocus
                style={{
                  width: "100%",
                  height: "52px",
                  fontSize: "1.75rem",
                  textAlign: "center",
                  letterSpacing: "0.5em",
                  fontWeight: "800",
                  fontFamily: "var(--px-font-data, monospace)",
                  background: "var(--px-surface-sunken)",
                  border: "1px solid var(--px-border)",
                  borderRadius: "var(--px-radius-md)",
                  boxShadow: "var(--px-neu-inset)",
                  color: "var(--px-text-strong)",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem", color: "var(--px-red)", fontSize: "0.82rem", fontWeight: "600" }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* On-Screen Numeric Keypad (Optimized for Touch & Zebra TC22) */}
          <div 
            style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(3, 1fr)", 
              gap: "0.5rem", 
              marginBottom: "1.25rem" 
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(String(num))}
                className="px-btn"
                style={{
                  height: "44px",
                  fontSize: "1.15rem",
                  fontWeight: "700",
                  borderRadius: "var(--px-radius-sm)",
                  background: "var(--px-surface)",
                  boxShadow: "var(--px-neu-flat)",
                  color: "var(--px-text-strong)",
                  border: "1px solid var(--px-border)"
                }}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress("CLEAR")}
              className="px-btn"
              style={{
                height: "44px",
                fontSize: "0.78rem",
                fontWeight: "700",
                borderRadius: "var(--px-radius-sm)",
                background: "var(--px-surface)",
                boxShadow: "var(--px-neu-flat)",
                color: "var(--px-muted)",
                border: "1px solid var(--px-border)"
              }}
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress("0")}
              className="px-btn"
              style={{
                height: "44px",
                fontSize: "1.15rem",
                fontWeight: "700",
                borderRadius: "var(--px-radius-sm)",
                background: "var(--px-surface)",
                boxShadow: "var(--px-neu-flat)",
                color: "var(--px-text-strong)",
                border: "1px solid var(--px-border)"
              }}
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress("BACKSPACE")}
              className="px-btn"
              style={{
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--px-radius-sm)",
                background: "var(--px-surface)",
                boxShadow: "var(--px-neu-flat)",
                color: "var(--px-muted)",
                border: "1px solid var(--px-border)"
              }}
              title="Borrar dígito"
            >
              <Delete size={18} />
            </button>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="px-btn px-btn--primary"
            style={{
              width: "100%",
              height: "48px",
              fontSize: "1rem",
              fontWeight: "700",
              borderRadius: "var(--px-radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              boxShadow: "var(--px-neu-btn-primary)"
            }}
          >
            {loading ? "Validando..." : `Ingresar como ${selectedRole.title}`}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Footer Database Sync Indicator */}
        <div 
          style={{ 
            marginTop: "2rem", 
            paddingTop: "1.25rem", 
            borderTop: "1px solid var(--px-border)", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            flexWrap: "wrap",
            gap: "0.5rem",
            fontSize: "0.78rem",
            color: "var(--px-muted)"
          }}
        >
          <span>📦 Base Oficial: 124 Referencias (762 Unidades)</span>
          <span>⚡ Asentado en Dynamics 365</span>
        </div>
      </div>
    </div>
  );
}
