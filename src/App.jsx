import React, { useState, useEffect } from "react";
import { InventoryProvider } from "./context/InventoryContext";
import { MainLayout } from "./layouts/MainLayout";
import { LoginScreen } from "./components/LoginScreen";
import { DashboardPage } from "./pages/DashboardPage";
import { CatalogPage } from "./pages/CatalogPage";
import { WarehouseMapPage } from "./pages/WarehouseMapPage";
import { InboundScannerPage } from "./pages/InboundScannerPage";
import { OutboundPickingPage } from "./pages/OutboundPickingPage";
import { ProPipelinePage } from "./pages/ProPipelinePage";
import { KardexPage } from "./pages/KardexPage";
import { authService, ROLES_CONFIG } from "./services/auth";

function AppContent() {
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [activeRoute, setActiveRoute] = useState(() => {
    const user = authService.getCurrentUser();
    return user ? authService.getDefaultRoute(user.role) : "inbound";
  });
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.body.classList.add("px-theme--dark");
    } else {
      document.body.classList.remove("px-theme--dark");
    }
  }, [isDark]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    const defRoute = authService.getDefaultRoute(user.role);
    setActiveRoute(defRoute);
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  // Safe navigation checking permissions
  const handleNavigate = (targetRoute) => {
    if (authService.canAccessRoute(currentUser, targetRoute)) {
      setActiveRoute(targetRoute);
    } else {
      console.warn(`[RBAC] Acceso denegado a la ruta ${targetRoute} para el rol ${currentUser?.role}`);
    }
  };

  // 1. Mandatory Login Gate
  if (!currentUser) {
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess}
        isDark={isDark}
        setIsDark={setIsDark}
      />
    );
  }

  // Fallback if route is not accessible by role
  const currentRouteSafe = authService.canAccessRoute(currentUser, activeRoute) 
    ? activeRoute 
    : authService.getDefaultRoute(currentUser.role);

  return (
    <MainLayout 
      currentUser={currentUser}
      onLogout={handleLogout}
      activeRoute={currentRouteSafe}
      onNavigate={handleNavigate}
      isDark={isDark}
      setIsDark={setIsDark}
    >
      {currentRouteSafe === "dashboard" && <DashboardPage onNavigate={handleNavigate} />}
      {currentRouteSafe === "map" && <WarehouseMapPage onNavigate={handleNavigate} />}
      {currentRouteSafe === "catalog" && <CatalogPage onNavigate={handleNavigate} />}
      {currentRouteSafe === "inbound" && <InboundScannerPage />}
      {currentRouteSafe === "outbound" && <OutboundPickingPage onNavigate={handleNavigate} />}
      {currentRouteSafe === "pro" && <ProPipelinePage />}
      {currentRouteSafe === "kardex" && <KardexPage />}
    </MainLayout>
  );
}

export default function App() {
  return (
    <InventoryProvider>
      <AppContent />
    </InventoryProvider>
  );
}
