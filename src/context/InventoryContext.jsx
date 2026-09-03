import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { storageService } from "../services/storage";
import { bcService } from "../services/bc-api";
import { audioService } from "../services/audio";
import defaultProducts from "../data/products.json";

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  const [products, setProducts] = useState(() => storageService.getProducts());
  const [movements, setMovements] = useState(() => storageService.getKardex());
  const [currentRole, setCurrentRole] = useState(() => storageService.getUserRole());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState("");
  const [selectedProductForZebra, setSelectedProductForZebra] = useState(null);

  // 1. Fetch live canonical database from server immediately on mount
  const loadServerData = useCallback(async () => {
    try {
      // Fetch central Kardex movements
      const kRes = await fetch("/api/kardex");
      let serverKardex = [];
      if (kRes.ok) {
        const kData = await kRes.json();
        if (kData && Array.isArray(kData.movements) && kData.movements.length > 0) {
          serverKardex = kData.movements;
          setMovements(serverKardex);
          storageService.saveKardex(serverKardex);
        }
      }

      // Fetch central Products with computed stock
      const pRes = await fetch("/api/products");
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData && Array.isArray(pData.value) && pData.value.length > 0) {
          setProducts(pData.value);
          storageService.saveProducts(pData.value);
          setLastSyncTime(new Date().toLocaleTimeString("es-CO"));
          return;
        }
      }

      // Fallback: Recompute locally from default products and kardex
      const stockMap = {};
      serverKardex.forEach(m => {
        const sku = (m.sku || "").toUpperCase();
        const qty = Number(m.quantity) || 0;
        if (m.type === "ENTRADA") stockMap[sku] = (stockMap[sku] || 0) + qty;
        else if (m.type === "SALIDA") stockMap[sku] = Math.max(0, (stockMap[sku] || 0) - qty);
        else if (m.type === "CONTEO") stockMap[sku] = qty;
      });

      const updated = defaultProducts.map(p => {
        const sku = (p.sku || "").toUpperCase();
        const s = stockMap[sku] !== undefined ? stockMap[sku] : (Number(p.stock) || 0);
        return { ...p, stock: s, totalValue: s * (Number(p.unitCost) || 120000) };
      });
      setProducts(updated);
      storageService.saveProducts(updated);
    } catch (e) {
      console.warn("Could not load server database on mount:", e);
    }
  }, []);

  useEffect(() => {
    loadServerData();
  }, [loadServerData]);

  const refreshLocalData = useCallback(async () => {
    await loadServerData();
  }, [loadServerData]);

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await loadServerData();
      const res = await bcService.syncItems();
      setLastSyncTime(new Date().toLocaleTimeString("es-CO"));
      audioService.playSuccess();
    } catch (e) {
      console.error("Manual sync failed:", e);
      audioService.playError();
    } finally {
      setIsSyncing(false);
    }
  }, [loadServerData]);

  const updateRole = useCallback((newRole) => {
    setCurrentRole(newRole);
    storageService.setUserRole(newRole);
  }, []);

  return (
    <InventoryContext.Provider value={{
      products,
      movements,
      currentRole,
      updateRole,
      isSyncing,
      lastSyncTime,
      handleManualSync,
      refreshLocalData,
      selectedProductForZebra,
      setSelectedProductForZebra
    }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error("useInventory debe ser usado dentro de un InventoryProvider");
  }
  return context;
}