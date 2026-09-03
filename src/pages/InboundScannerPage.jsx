import React from "react";
import { ZebraScanner } from "../components/ZebraScanner";
import { useInventory } from "../context/InventoryContext";

export function InboundScannerPage() {
  const { products, selectedProductForZebra, setSelectedProductForZebra, refreshLocalData } = useInventory();

  return (
    <ZebraScanner 
      products={products}
      initialProduct={selectedProductForZebra}
      onClearInitialProduct={() => setSelectedProductForZebra(null)}
      onMovementRegistered={refreshLocalData}
    />
  );
}
