import React from "react";
import { OutboundFlow } from "../components/OutboundFlow";
import { useInventory } from "../context/InventoryContext";

export function OutboundPickingPage({ onNavigate }) {
  const { products, refreshLocalData } = useInventory();

  return (
    <OutboundFlow 
      products={products}
      onOrderDispatched={refreshLocalData}
      onGoToZebra={() => onNavigate("inbound")}
    />
  );
}