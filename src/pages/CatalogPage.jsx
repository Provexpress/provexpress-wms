import React from "react";
import { Catalog } from "../components/Catalog";
import { useInventory } from "../context/InventoryContext";

export function CatalogPage({ onNavigate }) {
  const { products, setSelectedProductForZebra } = useInventory();

  const handleOperateProduct = (product) => {
    setSelectedProductForZebra(product);
    onNavigate("inbound");
  };

  return (
    <Catalog 
      products={products}
      onSelectProduct={handleOperateProduct}
      onGoToZebra={() => onNavigate("inbound")}
    />
  );
}