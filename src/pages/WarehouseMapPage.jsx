import React from "react";
import { WarehouseMap } from "../components/WarehouseMap";
import { useInventory } from "../context/InventoryContext";

export function WarehouseMapPage({ onNavigate }) {
  const { products, setSelectedProductForZebra } = useInventory();

  const handleSelectProduct = (product) => {
    setSelectedProductForZebra(product);
    onNavigate("inbound");
  };

  return (
    <WarehouseMap 
      products={products}
      onSelectProductForZebra={handleSelectProduct}
      onGoToZebra={() => onNavigate("inbound")}
    />
  );
}
