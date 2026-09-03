import React from "react";
import { Kardex } from "../components/Kardex";
import { useInventory } from "../context/InventoryContext";

export function KardexPage() {
  const { movements } = useInventory();

  return (
    <Kardex 
      movements={movements}
    />
  );
}