import React from "react";
import { ProOrderFlow } from "../components/ProOrderFlow";
import { useInventory } from "../context/InventoryContext";

export function ProPipelinePage() {
  const { products, refreshLocalData } = useInventory();

  return (
    <ProOrderFlow 
      products={products}
      onOrderUpdated={refreshLocalData}
    />
  );
}