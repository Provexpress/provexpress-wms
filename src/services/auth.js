// Authentication & RBAC Service for Provexpress WMS
const AUTH_STORAGE_KEY = "px_wms_auth_user";

export const ROLES_CONFIG = {
  OPERADOR: {
    role: "OPERADOR",
    title: "Operador de Bodega",
    badgeColor: "var(--px-green)",
    defaultRoute: "inbound",
    allowedRoutes: ["inbound", "outbound", "map", "catalog"],
    description: "Recepción Zebra TC22, Despachos, Ubicación física en estantes y Consulta de referencias.",
    pinHint: "1234",
    permissions: ["SCAN", "ENTRADA", "DESPACHO", "VIEW_MAP", "VIEW_CATALOG"]
  },
  SUPERVISOR: {
    role: "SUPERVISOR",
    title: "Supervisor de Inventario",
    badgeColor: "var(--px-blue)",
    defaultRoute: "catalog",
    allowedRoutes: ["catalog", "map", "inbound", "outbound", "kardex", "pro", "dashboard"],
    description: "Control total de inventario, conteo físico, ajustes Kardex, exportaciones y sincronización Dynamics 365.",
    pinHint: "4321",
    permissions: ["SCAN", "ENTRADA", "DESPACHO", "VIEW_MAP", "VIEW_CATALOG", "CONTEO", "CREATE_ITEM", "EDIT_GTIN", "EXPORT", "KARDEX_MANAGE"]
  },
  GERENCIA: {
    role: "GERENCIA",
    title: "Gerencia y Auditoría",
    badgeColor: "var(--px-purple)",
    defaultRoute: "dashboard",
    allowedRoutes: ["dashboard", "catalog", "map", "kardex"],
    description: "Dashboard ejecutivo con valorización FIFO ($91.44M COP), KPIs de rotación, trazabilidad y auditoría.",
    pinHint: "9876",
    permissions: ["*"]
  }
};

export const authService = {
  async login(pin) {
    const cleanPin = String(pin || "").trim();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: cleanPin })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
          return { success: true, user: data.user };
        }
      }
    } catch (e) {
      console.warn("[Auth] API offline o en Vercel estático, usando autenticación segura local");
    }

    // Fallback autenticación local segura (Zebra offline o cliente Vercel)
    if (cleanPin === "1234") {
      const user = { 
        role: "OPERADOR", 
        name: "Operador Bodega Cota", 
        permissions: ROLES_CONFIG.OPERADOR.permissions 
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    }
    if (cleanPin === "4321") {
      const user = { 
        role: "SUPERVISOR", 
        name: "Supervisor de Inventario", 
        permissions: ROLES_CONFIG.SUPERVISOR.permissions 
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    }
    if (cleanPin === "9876") {
      const user = { 
        role: "GERENCIA", 
        name: "Gerencia y Auditoría", 
        permissions: ROLES_CONFIG.GERENCIA.permissions 
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    }

    return { success: false, error: "PIN de seguridad incorrecto. Intenta de nuevo." };
  },

  getCurrentUser() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    // Retorna null para exigir inicio de sesión explícito
    return null;
  },

  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  canAccessRoute(user, route) {
    if (!user || !user.role) return false;
    const config = ROLES_CONFIG[user.role];
    if (!config) return false;
    if (config.permissions.includes("*")) return true;
    return config.allowedRoutes.includes(route);
  },

  getDefaultRoute(role) {
    const config = ROLES_CONFIG[role];
    return config ? config.defaultRoute : "inbound";
  },

  hasPermission(perm) {
    const user = this.getCurrentUser();
    if (!user || !user.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }
};