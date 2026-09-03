import React from "react";
import { Dashboard } from "../components/Dashboard";
import { useInventory } from "../context/InventoryContext";

export function DashboardPage({ onNavigate }) {
  const { products, setSelectedProductForZebra } = useInventory();

  const handleOperateProduct = (product) => {
    setSelectedProductForZebra(product);
    onNavigate("inbound");
  };

  return (
    <Dashboard 
      products={products}
      onSelectProduct={() => onNavigate("catalog")}
      onGoToZebra={() => onNavigate("inbound")}
      onOperateProduct={handleOperateProduct}
      onGoToKardex={() => onNavigate("kardex")}
    />
  );
}